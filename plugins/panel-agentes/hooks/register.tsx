import { atom, read, update } from 'claude-code'
import type { ElementConstructor, EngineInterface, Register, SvgProps } from 'claude-code'

import type { AgentRow, AgentStep, Limites, PeriodoConsumo, PlanState, ResumenConsumo } from '../types'
import {
  CABECERA,
  costeDe,
  dinero,
  fechaLocal,
  lineaCsv,
  mesesRecientes,
  resumir,
} from './consumo'
import type { Precios, Tokens } from './consumo'

const PANE = 'panel-agentes'
const TITLE = 'Agentes'
const PANE_CONSUMO = 'panel-consumo'
const TITLE_CONSUMO = 'Consumo'
const MAX_STEPS = 40
const STEPS_SHOWN = 5

// Cambia la etiqueta si cambian los campos guardados: así se descarta lo que
// guardó una versión anterior, que sobrevive a una recarga.
const agents = atom({ plugin: 'panel-agentes', key: 'agents' } as const, [], {
  shape: 'agents-2',
})
const now = atom({ plugin: 'panel-agentes', key: 'now' } as const, 0)
const open = atom({ plugin: 'panel-agentes', key: 'open' } as const, [])
const full = atom({ plugin: 'panel-agentes', key: 'full' } as const, [])
const plan = atom(
  { plugin: 'panel-agentes', key: 'plan' } as const,
  { title: '', parts: [] },
  { shape: 'plan-1' },
)
const lastPrompt = atom({ plugin: 'panel-agentes', key: 'lastPrompt' } as const, '')
const limites = atom({ plugin: 'panel-agentes', key: 'limites' } as const, {}, {
  shape: 'limites-1',
})
const resumen = atom({ plugin: 'panel-agentes', key: 'resumen' } as const, null, {
  shape: 'resumen-1',
})

// Estado del registro de consumo (se recalcula en cada carga del módulo).
let precios: Precios = {}
let offsetMin = -new Date().getTimezoneOffset()
let carpeta: string | undefined
let cola: Promise<void> = Promise.resolve()

// ---------- colores ----------

// El panel no sabe si la app está en modo claro u oscuro, así que:
// - el texto usa colores del tema ('inactive', 'success'…), que la app adapta;
// - no se pintan fondos oscuros fijos;
// - los colores fijos (dibujos, avatares, bordes) son tonos medios que se ven
//   bien sobre blanco y sobre negro.
const C = {
  // Colores del tema, para texto y bordes.
  dim: 'inactive',
  ok: 'success',
  warn: 'warning',
  line: 'inactive',
  link: 'suggestion',
  // Colores fijos, para dibujos y etiquetas con fondo propio.
  okHex: '#22a06b',
  warnHex: '#e8960c',
  trackHex: 'rgba(128,128,128,0.3)',
  onColor: '#ffffff',
}

type Look = { name: string; letter: string; color: string }
const LOOKS: Record<string, Look> = {
  haiku: { name: 'Haiku', letter: 'H', color: '#22a06b' },
  sonnet: { name: 'Sonnet', letter: 'S', color: '#3b82f6' },
  opus: { name: 'Opus', letter: 'O', color: '#a855f7' },
  fable: { name: 'Fable', letter: 'F', color: '#db2777' },
  mythos: { name: 'Mythos', letter: 'M', color: '#db2777' },
}
function look(model: string): Look {
  return LOOKS[model] ?? { name: model, letter: (model[0] ?? '?').toUpperCase(), color: '#808080' }
}

// ---------- utilidades ----------

/** "claude-haiku-5-5" -> "haiku"; si no reconoce la familia, el id tal cual. */
function shortModel(model: string | undefined): string {
  if (!model) return '?'
  const m = /(haiku|sonnet|opus|fable|mythos)/i.exec(model)
  return m?.[1] ? m[1].toLowerCase() : model
}

function base(path: unknown): string {
  if (typeof path !== 'string' || path === '') return ''
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] || path
}

function cut(text: unknown, max: number): string {
  if (typeof text !== 'string') return ''
  const one = text.replace(/\s+/g, ' ').trim()
  return one.length > max ? one.slice(0, max - 1) + '…' : one
}

/** Primer párrafo con contenido de una respuesta, sin marcas de markdown. */
function firstParagraph(text: unknown): string | undefined {
  if (typeof text !== 'string') return undefined
  const para = text
    .split(/\n\s*\n/)
    .map(p =>
      p
        .replace(/^\s*(#{1,6}|>)\s*/gm, '')
        .replace(/\*\*|__|`/g, '')
        .trim(),
    )
    .find(p => p.length > 0)
  return para ? cut(para, 160) : undefined
}

type Said = { now: string; past: string; icon: string }

/** Lo que hace una llamada a herramienta: en gerundio, en pasado y su icono. */
function describe(tool: string, a: Record<string, unknown>): Said {
  const s = (now: string, past: string, icon: string): Said => ({ now, past, icon })
  switch (tool) {
    case 'Read':
      return s(`Leyendo ${base(a.file_path)}`, `Leído ${base(a.file_path)}`, '📄')
    case 'Edit':
    case 'MultiEdit':
      return s(`Editando ${base(a.file_path)}`, `Editado ${base(a.file_path)}`, '✏️')
    case 'Write':
      return s(`Escribiendo ${base(a.file_path)}`, `Escrito ${base(a.file_path)}`, '✏️')
    case 'NotebookEdit':
      return s(`Editando ${base(a.notebook_path)}`, `Editado ${base(a.notebook_path)}`, '✏️')
    case 'Bash': {
      const what = cut(a.description ?? a.command, 48)
      return s(`Ejecutando: ${what}`, `Ejecutado: ${what}`, '⚙️')
    }
    case 'Grep':
      return s(`Buscando "${cut(a.pattern, 32)}"`, `Buscado "${cut(a.pattern, 32)}"`, '🔍')
    case 'Glob':
      return s(`Buscando archivos ${cut(a.pattern, 32)}`, `Buscados archivos ${cut(a.pattern, 32)}`, '🔍')
    case 'WebSearch':
      return s(`Buscando en la web: ${cut(a.query, 36)}`, `Buscado en la web: ${cut(a.query, 36)}`, '🌐')
    case 'WebFetch':
      return s(`Leyendo web ${cut(a.url, 40)}`, `Leída web ${cut(a.url, 40)}`, '🌐')
    case 'Agent':
      return s(`Delegando: ${cut(a.description, 40)}`, `Delegado: ${cut(a.description, 40)}`, '🤝')
    case 'TaskCreate':
    case 'TaskUpdate':
      return s('Actualizando tareas', 'Actualizadas las tareas', '☑️')
    default:
      return s(`Usando ${tool}`, `Usado ${tool}`, '•')
  }
}

function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

function acciones(n: number): string {
  return `${n} ${n === 1 ? 'acción' : 'acciones'}`
}

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter(x => x !== id) : [...list, id]
}

// ---------- consumo ----------

function porcentaje(n: number | undefined): string {
  return n === undefined ? '?' : `${Math.round(n)}%`
}

/** Carpeta del registro: ~/.claude/consumo (en Windows, %USERPROFILE%\.claude\consumo). */
async function carpetaConsumo($: EngineInterface): Promise<string> {
  if (carpeta !== undefined) return carpeta
  const isWindows = (await $.env.get('OS')) === 'Windows_NT'
  const home = isWindows
    ? ((await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')))
    : ((await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE')))
  const sep = isWindows ? '\\' : '/'
  carpeta = `${home ?? '.'}${sep}.claude${sep}consumo`

  return carpeta
}

function rutaMes(dir: string, mes: string): string {
  const sep = dir.includes('\\') ? '\\' : '/'

  return `${dir}${sep}consumo-${mes}.csv`
}

/** Desfase horario local, para agrupar por día con la hora de aquí. */
async function detectarOffset($: EngineInterface): Promise<void> {
  try {
    if ((await $.env.get('OS')) === 'Windows_NT') {
      const r = await $.process.run(
        ['powershell', '-NoProfile', '-Command', '[int][TimeZoneInfo]::Local.GetUtcOffset([DateTime]::Now).TotalMinutes'],
        { timeoutMs: 20_000 },
      )
      const n = Number.parseInt(r.stdout.trim(), 10)
      if (Number.isFinite(n)) offsetMin = n
    } else {
      const r = await $.process.run(['date', '+%z'], { timeoutMs: 5_000 })
      const m = /^([+-])(\d{2})(\d{2})/.exec(r.stdout.trim())
      if (m) offsetMin = (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]))
    }
  } catch {
    // Se queda con el desfase que da el propio entorno.
  }
}

async function cargarPrecios($: EngineInterface): Promise<void> {
  try {
    const sep = $.plugin.root.includes('\\') ? '\\' : '/'
    const text = (await $.fs.read(`${$.plugin.root}${sep}precios.json`)) as string
    const json = JSON.parse(text) as { modelos?: Precios }
    precios = json.modelos ?? {}
  } catch {
    precios = {}
  }
}

/** Añade una línea al CSV del mes. Va en cola para no pisar escrituras. */
function anotar($: EngineInterface, mes: string, linea: string): Promise<void> {
  cola = cola
    .then(async () => {
      const path = rutaMes(await carpetaConsumo($), mes)
      let previo = (await $.fs.exists(path)) ? ((await $.fs.read(path)) as string) : ''
      if (previo === '') previo = `\uFEFF${CABECERA}\n`
      if (!previo.endsWith('\n')) previo += '\n'
      await $.fs.write(path, `${previo}${linea}\n`)
    })
    .catch(() => {
      // Si no se puede escribir, no se interrumpe nada.
    })

  return cola
}

async function leerLimites($: EngineInterface): Promise<void> {
  try {
    const u = await $.session.usage()
    const semana = u.rateLimits.find(r => r.kind === 'seven_day')
    const cinco = u.rateLimits.find(r => r.kind === 'five_hour')
    if (!semana && !cinco) return
    await update($, limites, prev => ({
      semana: semana?.percentUsed ?? prev.semana,
      semanaReinicio: semana?.resetsAt ?? prev.semanaReinicio,
      cincoHoras: cinco?.percentUsed ?? prev.cincoHoras,
    }))
  } catch {
    // Sin datos de límites (por ejemplo, con clave de API).
  }
}

async function calcularResumen($: EngineInterface): Promise<void> {
  const dir = await carpetaConsumo($)
  const t = await $.clock.now()
  const textos: string[] = []
  for (const mes of mesesRecientes(t, offsetMin)) {
    const path = rutaMes(dir, mes)
    try {
      if (await $.fs.exists(path)) textos.push((await $.fs.read(path)) as string)
    } catch {
      // Un archivo ilegible no impide ver el resto.
    }
  }
  const r = resumir(textos, t, offsetMin)
  const nuevo: ResumenConsumo = { ...r, carpeta: dir, calculado: t }
  await update($, resumen, () => nuevo)
}

/** Registra lo que costó un turno (de la sesión principal o de un subagente). */
async function registrar($: EngineInterface, agentId: string | undefined, u: Tokens & { model: string }): Promise<void> {
  if (agentId === undefined) await leerLimites($)
  const tokens: Tokens = {
    input_tokens: u.input_tokens,
    output_tokens: u.output_tokens,
    cache_creation_input_tokens: u.cache_creation_input_tokens,
    cache_read_input_tokens: u.cache_read_input_tokens,
  }
  const coste = costeDe(u.model, tokens, precios)
  let agente = 'principal'
  if (agentId !== undefined) {
    const fila = (await read($, agents)).find(a => a.id === agentId)
    agente = fila?.type ?? 'subagente'
    if (fila && coste !== undefined) {
      await update($, agents, list =>
        list.map(a => (a.id === agentId ? { ...a, costUsd: (a.costUsd ?? 0) + coste } : a)),
      )
    }
  }

  const t = await $.clock.now()
  const { fecha, hora, mes } = fechaLocal(t, offsetMin)
  const equipo = (await $.env.get('COMPUTERNAME')) ?? (await $.env.get('HOSTNAME')) ?? ''
  const proyecto = base(await $.session.root())
  const lim = await read($, limites)
  await anotar(
    $,
    mes,
    lineaCsv({ fecha, hora, equipo, proyecto, agente, modelo: u.model, tokens, coste, limite: lim.semana }),
  )
}

function reparto(p: PeriodoConsumo): string {
  const nombres: Record<string, string> = {
    principal: 'principal',
    rapido: 'rápido',
    experto: 'experto',
    otros: 'otros',
  }

  return ['principal', 'rapido', 'experto', 'otros']
    .filter(k => (p.porAgente[k] ?? 0) > 0)
    .map(k => `${nombres[k]} ${dinero(p.porAgente[k] ?? 0)}`)
    .join(' · ')
}

function lineaLimites(l: Limites): string | undefined {
  if (l.semana === undefined && l.cincoHoras === undefined) return undefined

  return `Límite semanal ${porcentaje(l.semana)} · 5 horas ${porcentaje(l.cincoHoras)}`
}

// ---------- dibujos (solo en escritorio, web y móvil) ----------

function ringSvg(done: number, going: number): string {
  const r = 24
  const c = 2 * Math.PI * r
  const d = c * done
  const g = c * going
  const arc = (len: number, off: number, color: string) =>
    len <= 0
      ? ''
      : `<circle cx="29" cy="29" r="${r}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${len.toFixed(1)} ${c.toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}" transform="rotate(-90 29 29)"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="58" height="58" viewBox="0 0 58 58"><circle cx="29" cy="29" r="${r}" fill="none" stroke="${C.trackHex}" stroke-width="6"/>${arc(d, 0, C.okHex)}${arc(g, d, C.warnHex)}</svg>`
}

function segmentsSvg(states: string[]): string {
  const w = 240
  const gap = 4
  const n = Math.max(1, states.length)
  const sw = (w - gap * (n - 1)) / n
  const rects = states
    .map((st, i) => {
      const color = st === 'completed' ? C.okHex : st === 'in_progress' ? C.warnHex : C.trackHex
      return `<rect x="${(i * (sw + gap)).toFixed(1)}" y="0" width="${sw.toFixed(1)}" height="6" rx="3" fill="${color}"/>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="6" viewBox="0 0 ${w} 6">${rects}</svg>`
}

function distSvg(parts: { n: number; color: string }[]): string {
  const w = 300
  const total = parts.reduce((s, p) => s + p.n, 0) || 1
  const gap = 2
  const usable = w - gap * Math.max(0, parts.length - 1)
  let x = 0
  const rects = parts
    .map(p => {
      const pw = (usable * p.n) / total
      const r = `<rect x="${x.toFixed(1)}" y="0" width="${pw.toFixed(1)}" height="8" fill="${p.color}"/>`
      x += pw + gap
      return r
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="8" viewBox="0 0 ${w} 8"><clipPath id="r"><rect width="${w}" height="8" rx="4"/></clipPath><g clip-path="url(#r)">${rects}</g></svg>`
}

function avatarSvg(l: Look, size: number): string {
  const h = size / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${h}" cy="${h}" r="${h}" fill="${l.color}"/><text x="${h}" y="${h + size * 0.17}" text-anchor="middle" fill="${C.onColor}" font-size="${Math.round(size * 0.45)}" font-weight="800" font-family="system-ui,sans-serif">${l.letter}</text></svg>`
}

// ---------- hooks ----------

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'agentes',
      description: 'Abre el panel que muestra qué hace cada agente',
    })
    await $.command.register({
      name: 'consumo',
      description: 'Abre el panel con el consumo estimado por día y por semana',
    })
    void $.ui.open({ id: PANE, title: TITLE })
    void cargarPrecios($)
    void detectarOffset($)

    // Reloj del panel: solo escribe mientras algún agente está trabajando.
    $.clock.every(1000, () => {
      void (async () => {
        const list = await read($, agents)
        if (!list.some(a => a.status === 'trabajando')) return
        const t = await $.clock.now()
        await update($, now, () => t)
      })()
    })

    return next(e)
  })

  on('command.run', { command: 'agentes' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Panel de agentes abierto.' }
  })

  on('command.run', { command: 'consumo' }, async $ => {
    await calcularResumen($)
    await $.ui.open({ id: PANE_CONSUMO, title: TITLE_CONSUMO })

    return { text: 'Panel de consumo abierto.' }
  })

  // Lo que escribe la persona: da título al plan que venga después.
  on('prompt.submit', async ($, e, next) => {
    if (!e.command && !e.isMeta && e.text.trim()) {
      const text = cut(e.text, 48)
      await update($, lastPrompt, () => text)
    }

    return next(e)
  })

  // Un agente arranca: apuntamos tipo, modelo resuelto y tarea.
  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    if (r.deny !== undefined || !r.agentId) return r
    const t = await $.clock.now()
    const row: AgentRow = {
      id: r.agentId,
      toolUseId: e.tool_use_id,
      // Los agentes de un plugin llegan como "reparto:rapido": se muestra "rapido".
      type: e.subagentType.replace(/^[^:]+:/, ''),
      model: shortModel(r.model),
      description: cut(e.description, 80),
      status: 'trabajando',
      startedAt: t,
      activity: 'Empezando…',
      actions: 0,
      steps: [],
    }
    await update($, agents, list => [...list.filter(a => a.id !== row.id), row].slice(-100))
    await update($, now, () => t)

    return r
  })

  on('tool.call', async ($, e, next) => {
    const args = e as unknown as Record<string, unknown>

    // Lo que hace cada agente.
    if (e.agentId) {
      const id = e.agentId
      const said = describe(e.tool, args)
      const t = await $.clock.now()
      await update($, agents, list =>
        list.map(a => {
          if (a.id !== id) return a
          const step: AgentStep = { at: t - a.startedAt, icon: said.icon, text: said.past }
          // Si ya estaba terminado y vuelve a actuar, es que lo han retomado.
          return {
            ...a,
            status: 'trabajando',
            endedAt: undefined,
            activity: said.now,
            actions: a.actions + 1,
            steps: [...a.steps, step].slice(-MAX_STEPS),
          }
        }),
      )
    }

    const ran = await next(e)

    // Si la llamada a Agent falla, el agente no llega a trabajar.
    // (Su final normal lo marca turn.complete, más abajo: la herramienta Agent
    // puede volver al instante con "Async agent launched" mientras el agente
    // sigue trabajando en segundo plano.)
    if (e.tool === 'Agent' && (ran.deny !== undefined || ran.isError === true)) {
      const t = await $.clock.now()
      await update($, agents, list =>
        list.map(a =>
          a.toolUseId === e.tool_use_id && a.status === 'trabajando'
            ? { ...a, status: 'error', endedAt: t, activity: '' }
            : a,
        ),
      )
    }

    // El plan: la lista de tareas del coordinador.
    if (!e.agentId && ran.deny === undefined && ran.isError !== true) {
      if (e.tool === 'TaskCreate') {
        const id = /#?(\d+)/.exec(ran.text ?? '')?.[1]
        const subject = cut(args.subject, 60)
        if (id) {
          const title = await read($, lastPrompt)
          await update($, plan, (p): PlanState => {
            const fresh = p.parts.length === 0 || p.parts.every(x => x.status === 'completed')
            const parts = fresh ? [] : p.parts.filter(x => x.id !== id)
            return {
              title: fresh ? title || 'Plan' : p.title,
              parts: [...parts, { id, subject, status: 'pending' }],
            }
          })
        }
      } else if (e.tool === 'TaskUpdate') {
        const id = String(args.taskId ?? '')
        const st = args.status
        await update($, plan, (p): PlanState => {
          if (st === 'deleted') return { ...p, parts: p.parts.filter(x => x.id !== id) }
          if (st !== 'pending' && st !== 'in_progress' && st !== 'completed') return p
          return { ...p, parts: p.parts.map(x => (x.id === id ? { ...x, status: st } : x)) }
        })
      }
    }

    return ran
  })

  // Final de cada agente (primer plano o segundo plano), con su respuesta, y
  // registro de consumo: cada turno de la sesión principal y cada subagente
  // dejan una línea en ~/.claude/consumo/consumo-AAAA-MM.csv. No pasa por el modelo.
  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.usage) await registrar($, e.agentId, e.usage)
    if (!e.agentId) return r
    const id = e.agentId
    const failed = e.reason !== 'answer'
    const result = firstParagraph(e.answer)
    const t = await $.clock.now()
    await update($, agents, list =>
      list.map(a =>
        a.id === id
          ? {
              ...a,
              status: failed ? 'error' : 'terminado',
              endedAt: t,
              activity: '',
              result: result ?? a.result,
            }
          : a,
      ),
    )
    await update($, now, () => t)

    return r
  })

  // Respaldo: el aviso clásico de fin, por si turn.complete no llegara.
  on('classic.SubagentStop', async ($, e, next) => {
    const t = await $.clock.now()
    const result = firstParagraph(e.last_assistant_message)
    await update($, agents, list =>
      list.map(a =>
        a.id === e.agent_id && a.status === 'trabajando'
          ? { ...a, status: 'terminado', endedAt: t, activity: '', result: result ?? a.result }
          : a,
      ),
    )
    await update($, now, () => t)

    return next(e)
  })

  // ---------- el panel ----------

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const kit = $.ui.resolve(e)
    const { Box, Text, Button } = kit
    // El terminal no dibuja Svg: allí se usan barras de texto.
    const Svg = (kit as { Svg?: ElementConstructor<SvgProps> }).Svg
    const rich = e.surface !== 'terminal' && typeof Svg === 'function'
    const list = await read($, agents)
    const t = await read($, now)
    const opened = await read($, open)
    const fully = await read($, full)
    const p = await read($, plan)
    const lim = lineaLimites(await read($, limites))
    const width = Math.max(24, e.props.bodyColumns ?? 40)

    const running = list.filter(a => a.status === 'trabajando')
    const done = list.filter(a => a.status !== 'trabajando').slice().reverse()
    const totalActions = list.reduce((s, a) => s + a.actions, 0)

    // La app solo deja abrir la conversación de los agentes que sigue
    // listando; de los que ya no tiene, el enlace no se muestra.
    let viewable = new Set<string>()
    try {
      viewable = new Set((await $.agent.list()).map(x => x.id))
    } catch {
      // Sin lista: se muestra el enlace y, si falla, se explica por qué.
      viewable = new Set(list.map(a => a.id))
    }
    const ver = (id: string) => () => {
      void $.ui.view({ agentId: id }).then(shown => {
        if (shown.deny) $.ui.toast(`No se puede abrir esa conversación: ${shown.deny}`)
      })
    }
    const abrir = (id: string) => () => {
      void update($, open, l => toggle(l, id))
    }
    const todo = (id: string) => () => {
      void update($, full, l => toggle(l, id))
    }
    const consumo = () => {
      void (async () => {
        await calcularResumen($)
        await $.ui.open({ id: PANE_CONSUMO, title: TITLE_CONSUMO })
      })()
    }
    const limpiar = () => {
      void update($, agents, l => l.filter(a => a.status === 'trabajando'))
      void update($, open, () => [])
      void update($, full, () => [])
    }

    const avatar = (a: AgentRow, size: number) => {
      const l = look(a.model)
      return rich && Svg ? (
        <Svg source={avatarSvg(l, size)} alt={l.name} width={size} height={size} />
      ) : (
        <Text backgroundColor={l.color} color={C.onColor} weight="bold">
          {` ${l.letter} `}
        </Text>
      )
    }

    const section = (label: string) => (
      <Box marginTop={1}>
        <Text size="caption" color={C.dim} weight="semibold">
          {label.toUpperCase()}
        </Text>
      </Box>
    )

    // --- cabecera ---
    const header = (
      <Box flexDirection="row" justifyContent="space-between">
        <Text weight="bold" size="heading">
          ⚡ Agentes
        </Text>
        {running.length > 0 ? (
          <Text backgroundColor={C.warnHex} color={C.onColor} weight="bold" size="caption">
            {` ● ${running.length} EN VIVO `}
          </Text>
        ) : (
          <Text color={C.dim} size="caption">
            en reposo
          </Text>
        )}
      </Box>
    )

    // --- plan ---
    const parts = p.parts
    const nDone = parts.filter(x => x.status === 'completed').length
    const nGoing = parts.filter(x => x.status === 'in_progress').length
    const pct = parts.length ? Math.round((nDone / parts.length) * 100) : 0
    const planBox =
      parts.length >= 2 ? (
        <Box
          flexDirection="row"
          gap={1}
          alignItems="center"
          borderStyle="round"
          borderColor={C.line}
          paddingX={1}
        >
          {rich && Svg && (
            <Svg
              source={ringSvg(nDone / parts.length, nGoing / parts.length)}
              alt={`${pct}% del plan hecho`}
              width={44}
              height={44}
            />
          )}
          {/* El porcentaje va como texto, no dentro del dibujo, para que la
              app le dé el color del tema (claro u oscuro). */}
          <Text weight="bold" size="title">
            {`${pct}%`}
          </Text>
          <Box flexDirection="column" flexGrow={1}>
            <Box flexDirection="row" justifyContent="space-between">
              <Text size="caption" color={C.dim}>
                {nDone === parts.length ? 'PLAN TERMINADO' : 'PLAN EN CURSO'}
              </Text>
              <Text size="caption" color={C.dim}>
                {`${nDone} / ${parts.length} partes`}
              </Text>
            </Box>
            <Text weight="bold">{p.title || 'Plan'}</Text>
            {rich && Svg ? (
              <Svg
                source={segmentsSvg(parts.map(x => x.status))}
                alt={`${nDone} hechas, ${nGoing} en marcha, ${parts.length - nDone - nGoing} pendientes`}
              />
            ) : (
              <Text>
                {parts.map((x, i) => (
                  <Text
                    key={'seg' + i}
                    color={x.status === 'completed' ? C.ok : x.status === 'in_progress' ? C.warn : C.line}
                  >
                    ██
                  </Text>
                ))}
              </Text>
            )}
          </Box>
        </Box>
      ) : null

    // --- casillas ---
    const tile = (n: number, label: string, color?: string) => (
      <Box
        flexDirection="column"
        flexGrow={1}
        borderStyle="round"
        borderColor={C.line}
        paddingX={1}
      >
        <Text weight="bold" size="title" color={color}>
          {String(n)}
        </Text>
        <Text size="caption" color={C.dim}>
          {label}
        </Text>
      </Box>
    )
    const tiles =
      list.length > 0 ? (
        <Box flexDirection="row" gap={1}>
          {tile(running.length, "trabajando", C.warn)}
          {tile(done.length, "terminados", C.ok)}
          {tile(totalActions, "acciones")}
        </Box>
      ) : null

    // --- tarjetas de los que trabajan ---
    const cards = running.map(a => {
      const l = look(a.model)
      return (
        <Box
          key={'r-' + a.id}
          flexDirection="row"
          gap={1}
          marginTop={1}
          borderStyle="round"
          borderColor={l.color}
          paddingX={1}
        >
          {avatar(a, 30)}
          <Box flexDirection="column" flexGrow={1}>
            <Box flexDirection="row" justifyContent="space-between">
              <Button key={'ver:' + a.id} plain onPress={ver(a.id)}>
                <Text weight="semibold">{a.type}</Text>
                <Text color={C.dim}>{` · ${l.name}`}</Text>
              </Button>
              <Text color={C.dim} tabular>{`⏱ ${clock((t || a.startedAt) - a.startedAt)}`}</Text>
            </Box>
            <Text weight="bold">{a.description}</Text>
            <Box flexDirection="row" justifyContent="space-between">
              <Text color={C.warn}>
                {` ● ${a.activity} `}
              </Text>
              <Text color={C.dim} size="caption">
                {acciones(a.actions)}
              </Text>
            </Box>
          </Box>
        </Box>
      )
    })

    // --- terminados, con desplegable ---
    const rows = done.slice(0, 15).map(a => {
      const l = look(a.model)
      const isOpen = opened.includes(a.id)
      const showAll = fully.includes(a.id)
      const shown = showAll ? a.steps : a.steps.slice(0, STEPS_SHOWN)
      const hidden = a.actions - shown.length
      const failed = a.status === 'error'
      return (
        <Box
          key={'d-' + a.id}
          flexDirection="column"
          marginTop={1}
          borderStyle="round"
          borderColor={isOpen ? l.color : C.line}
          paddingX={1}
        >
          <Box flexDirection="row" gap={1} alignItems="center">
            {avatar(a, 20)}
            <Box flexGrow={1}>
              <Button key={'abrir:' + a.id} plain onPress={abrir(a.id)}>
                <Text color={C.dim}>{isOpen ? '▼ ' : '▶ '}</Text>
                <Text weight={isOpen ? 'bold' : 'regular'}>{a.description}</Text>
              </Button>
            </Box>
            <Text color={failed ? 'error' : C.dim} tabular>
              {`${failed ? '✗' : '✓'} ${clock((a.endedAt ?? a.startedAt) - a.startedAt)} · ${a.actions} acc.${a.costUsd !== undefined ? ` · ${dinero(a.costUsd)}` : ''}`}
            </Text>
          </Box>

          {isOpen && (
            <Box flexDirection="column" marginTop={1} paddingLeft={2}>
              <Text size="caption" color={C.dim}>{`${a.type} · ${l.name}`}</Text>
              {shown.length === 0 && <Text color={C.dim}>Sin acciones registradas.</Text>}
              {shown.map((s, i) => (
                <Text key={'s' + i}>
                  <Text color={l.color}>{i === shown.length - 1 && hidden <= 0 ? '└ ' : '├ '}</Text>
                  <Text color={C.dim} mono tabular>{`${clock(s.at)} `}</Text>
                  <Text>{`${s.icon} `}</Text>
                  <Text color={C.dim}>{s.text}</Text>
                </Text>
              ))}
              {(hidden > 0 || showAll) && a.steps.length > STEPS_SHOWN && (
                <Button key={'todo:' + a.id} plain onPress={todo(a.id)}>
                  <Text color={C.link}>
                    {showAll
                      ? '− ver menos'
                      : `+ ${Math.min(hidden, a.steps.length - shown.length)} acciones más`}
                  </Text>
                </Button>
              )}
              {!showAll && a.steps.length <= STEPS_SHOWN && hidden > 0 && (
                <Text color={C.dim}>{`… ${hidden} acciones anteriores`}</Text>
              )}
              {a.result && (
                <Box
                  marginTop={1}
                  borderStyle="round"
                  borderColor={failed ? 'error' : C.ok}
                  paddingX={1}
                >
                  <Text>{`${failed ? '✗' : '✓'} ${a.result}`}</Text>
                </Box>
              )}
              {viewable.has(a.id) && (
                <Button key={'conv:' + a.id} plain onPress={ver(a.id)}>
                  <Text color={C.link}>↗ ver conversación</Text>
                </Button>
              )}
            </Box>
          )}
        </Box>
      )
    })

    // --- reparto por modelo ---
    const counts = new Map<string, number>()
    for (const a of list) counts.set(a.model, (counts.get(a.model) ?? 0) + 1)
    const order = ['haiku', 'sonnet', 'opus']
    const models = [...counts.keys()].sort(
      (x, y) => (order.indexOf(x) + 1 || 99) - (order.indexOf(y) + 1 || 99),
    )
    const foot =
      list.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          {rich && Svg ? (
            <Svg
              source={distSvg(models.map(m => ({ n: counts.get(m) ?? 0, color: look(m).color })))}
              alt={models.map(m => `${look(m).name} ${counts.get(m)}`).join(', ')}
            />
          ) : (
            <Text>
              {models.map(m => (
                <Text key={'b-' + m} color={look(m).color}>
                  {'█'.repeat(Math.max(1, counts.get(m) ?? 0))}
                </Text>
              ))}
            </Text>
          )}
          <Box flexDirection="row" justifyContent="space-between">
            <Text>
              {models.map(m => (
                <Text key={'l-' + m}>
                  <Text color={look(m).color}>● </Text>
                  <Text color={C.dim}>{`${look(m).name} ${counts.get(m)}   `}</Text>
                </Text>
              ))}
            </Text>
            {done.length > 0 && (
              <Button key="limpiar" plain onPress={limpiar}>
                <Text color={C.dim}>limpiar</Text>
              </Button>
            )}
          </Box>
        </Box>
      ) : null

    return (
      <Box flexDirection="column" width={width}>
        {header}
        <Box flexDirection="row" justifyContent="space-between">
          <Text size="caption" color={C.dim}>
            {lim ?? ''}
          </Text>
          <Button key="consumo" plain onPress={consumo}>
            <Text size="caption" color={C.link}>
              ver consumo
            </Text>
          </Button>
        </Box>
        {list.length === 0 && parts.length < 2 && (
          <Box flexDirection="column" marginTop={1}>
            <Text color={C.dim}>Ningún agente todavía.</Text>
            <Text color={C.dim}>Cuando se delegue una tarea, aparecerá aquí.</Text>
          </Box>
        )}
        {planBox && <Box marginTop={1}>{planBox}</Box>}
        {tiles && <Box marginTop={1}>{tiles}</Box>}
        {running.length > 0 && section("Trabajando")}
        {cards}
        {done.length > 0 && section("Terminados")}
        {rows}
        {done.length > 15 && <Text color={C.dim}>{`… y ${done.length - 15} más`}</Text>}
        {foot}
      </Box>
    )
  })

  // ---------- el panel de consumo ----------

  on('ui.render', { component: 'Pane', requestId: PANE_CONSUMO }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const r = await read($, resumen)
    const lim = await read($, limites)
    const width = Math.max(24, e.props.bodyColumns ?? 40)

    const actualizar = () => {
      void calcularResumen($)
    }

    const section = (label: string) => (
      <Box marginTop={1}>
        <Text size="caption" color={C.dim} weight="semibold">
          {label.toUpperCase()}
        </Text>
      </Box>
    )

    const periodo = (p: PeriodoConsumo, key: string, mostrarLimite: boolean) => (
      <Box key={key} flexDirection="column" marginTop={1}>
        <Text>
          <Text>{`${p.etiqueta}  `}</Text>
          <Text weight="bold">{dinero(p.total)}</Text>
          <Text color={C.dim}>
            {`${p.total > 0 ? ` · Opus ${Math.round((p.opus / p.total) * 100)}%` : ''}${
              mostrarLimite && p.limiteMax !== undefined ? ` · límite ${Math.round(p.limiteMax)}%` : ''
            }`}
          </Text>
        </Text>
        <Text color={C.dim} size="caption">
          {reparto(p)}
        </Text>
      </Box>
    )

    const reinicio = lim.semanaReinicio ? fechaLocal(Date.parse(lim.semanaReinicio), offsetMin) : undefined

    return (
      <Box flexDirection="column" width={width}>
        <Text weight="bold" size="heading">
          Consumo
        </Text>

        {lim.semana !== undefined && (
          <Box flexDirection="column" marginTop={1}>
            <Text>
              <Text>Límite semanal: </Text>
              <Text weight="bold">{porcentaje(lim.semana)}</Text>
              <Text color={C.dim}>
                {reinicio
                  ? ` (se reinicia ${reinicio.fecha.slice(8, 10)}/${reinicio.fecha.slice(5, 7)} ${reinicio.hora})`
                  : ''}
              </Text>
            </Text>
            {lim.cincoHoras !== undefined && (
              <Text color={C.dim}>{`Límite de 5 horas: ${porcentaje(lim.cincoHoras)}`}</Text>
            )}
          </Box>
        )}

        {r === null && <Text color={C.dim}>Calculando…</Text>}

        {r !== null && r.dias.length === 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text color={C.dim}>Todavía no hay consumo registrado.</Text>
            <Text color={C.dim}>Se apunta solo al terminar cada respuesta y cada subagente.</Text>
          </Box>
        )}

        {r !== null && r.dias.length > 0 && section('Últimos 14 días')}
        {r !== null && r.dias.map((p, i) => periodo(p, 'd-' + i, false))}

        {r !== null && r.semanas.length > 0 && section('Últimas 8 semanas')}
        {r !== null && r.semanas.map((p, i) => periodo(p, 's-' + i, true))}

        {r !== null && (
          <Box flexDirection="column" marginTop={1}>
            <Text color={C.dim} size="caption">
              Coste estimado con precios de la API: sirve para comparar, no es lo que pagas.
            </Text>
            <Text color={C.dim} size="caption">{`Archivos: ${r.carpeta}`}</Text>
            <Button key="actualizar" plain onPress={actualizar}>
              <Text color={C.link}>actualizar</Text>
            </Button>
          </Box>
        )}
      </Box>
    )
  })
}
