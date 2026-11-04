import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { AgentRow } from '../types'

const PANE = 'panel-agentes'
const TITLE = 'Agentes'

// Cambia la etiqueta si cambian los campos de AgentRow: así se descarta lo que
// guardó una versión anterior, que sobrevive a una recarga.
const agents = atom({ plugin: 'panel-agentes', key: 'agents' } as const, [], {
  shape: 'agents-1',
})
const now = atom({ plugin: 'panel-agentes', key: 'now' } as const, 0)

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

/** Frase corta en castellano de lo que hace una llamada a herramienta. */
function describe(tool: string, args: Record<string, unknown>): string {
  switch (tool) {
    case 'Read':
      return `Leyendo ${base(args.file_path)}`
    case 'Edit':
    case 'MultiEdit':
      return `Editando ${base(args.file_path)}`
    case 'Write':
      return `Escribiendo ${base(args.file_path)}`
    case 'NotebookEdit':
      return `Editando ${base(args.notebook_path)}`
    case 'Bash':
      return `Ejecutando: ${cut(args.description ?? args.command, 48)}`
    case 'Grep':
      return `Buscando "${cut(args.pattern, 32)}"`
    case 'Glob':
      return `Buscando archivos ${cut(args.pattern, 32)}`
    case 'WebSearch':
      return `Buscando en la web: ${cut(args.query, 36)}`
    case 'WebFetch':
      return `Leyendo web ${cut(args.url, 40)}`
    case 'Agent':
      return `Delegando: ${cut(args.description, 40)}`
    case 'TaskCreate':
    case 'TaskUpdate':
      return 'Actualizando tareas'
    default:
      return `Usando ${tool}`
  }
}

function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'agentes',
      description: 'Abre el panel que muestra qué hace cada agente',
    })
    void $.ui.open({ id: PANE, title: TITLE })

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

  // Un agente arranca: apuntamos tipo, modelo resuelto y tarea.
  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    if (r.deny !== undefined || !r.agentId) return r
    const t = await $.clock.now()
    const row: AgentRow = {
      id: r.agentId,
      toolUseId: e.tool_use_id,
      type: e.subagentType,
      model: shortModel(r.model),
      description: cut(e.description, 80),
      status: 'trabajando',
      startedAt: t,
      activity: 'Empezando…',
      actions: 0,
    }
    await update($, agents, list => [...list.filter(a => a.id !== row.id), row].slice(-100))
    await update($, now, () => t)

    return r
  })

  // Lo que hace cada agente, y el final de la llamada que lo lanzó.
  on('tool.call', async ($, e, next) => {
    if (e.agentId) {
      const id = e.agentId
      const text = describe(e.tool, e as unknown as Record<string, unknown>)
      await update($, agents, list =>
        list.map(a =>
          a.id === id && a.status === 'trabajando'
            ? { ...a, activity: text, actions: a.actions + 1 }
            : a,
        ),
      )
    }

    const ran = await next(e)

    if (e.tool === 'Agent' && !(e as { run_in_background?: boolean }).run_in_background) {
      const failed = ran.deny !== undefined || ran.isError === true
      const t = await $.clock.now()
      await update($, agents, list =>
        list.map(a =>
          a.toolUseId === e.tool_use_id && a.status === 'trabajando'
            ? { ...a, status: failed ? 'error' : 'terminado', endedAt: t, activity: '' }
            : a,
        ),
      )
      await update($, now, () => t)
    }

    return ran
  })

  // Final de un agente, también de los que corren en segundo plano.
  on('classic.SubagentStop', async ($, e, next) => {
    const t = await $.clock.now()
    await update($, agents, list =>
      list.map(a =>
        a.id === e.agent_id && a.status === 'trabajando'
          ? { ...a, status: 'terminado', endedAt: t, activity: '' }
          : a,
      ),
    )
    await update($, now, () => t)

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const list = await read($, agents)
    const t = await read($, now)
    const width = Math.max(20, e.props.bodyColumns ?? 40)

    const running = list.filter(a => a.status === 'trabajando')
    const done = list.filter(a => a.status !== 'trabajando').slice().reverse()

    const counts = new Map<string, number>()
    for (const a of list) counts.set(a.type, (counts.get(a.type) ?? 0) + 1)
    const summary = [...counts.entries()].map(([k, n]) => `${k} ${n}`).join(' · ')

    const ver = (id: string) => () => {
      void $.ui.view({ agentId: id })
    }
    const limpiar = () => {
      void update($, agents, l => l.filter(a => a.status === 'trabajando'))
    }

    return (
      <Box flexDirection="column" width={width}>
        {list.length === 0 && (
          <Box flexDirection="column">
            <Text dimColor>Ningún agente todavía.</Text>
            <Text dimColor>Cuando el coordinador delegue una tarea, aparecerá aquí.</Text>
          </Box>
        )}

        {running.length > 0 && (
          <Box flexDirection="column" marginBottom={1}>
            <Text color="claude" weight="semibold">
              Trabajando ({running.length})
            </Text>
            {running.map(a => (
              <Box key={'r-' + a.id} flexDirection="column" marginTop={1}>
                <Button key={'ver:' + a.id} plain onPress={ver(a.id)}>
                  <Text color="warning">● </Text>
                  {a.type} <Text dimColor>({a.model}) · {clock((t || a.startedAt) - a.startedAt)}</Text>
                </Button>
                <Text>{a.description}</Text>
                <Text dimColor>
                  ↳ {a.activity} · {a.actions} {a.actions === 1 ? 'acción' : 'acciones'}
                </Text>
              </Box>
            ))}
          </Box>
        )}

        {done.length > 0 && (
          <Box flexDirection="column">
            <Text weight="semibold">Terminados</Text>
            {done.slice(0, 15).map(a => (
              <Box key={'d-' + a.id} flexDirection="column" marginTop={1}>
                <Button key={'ver:' + a.id} plain onPress={ver(a.id)}>
                  <Text color={a.status === 'error' ? 'error' : 'success'}>
                    {a.status === 'error' ? '✗ ' : '✓ '}
                  </Text>
                  {a.type}{' '}
                  <Text dimColor>
                    ({a.model}) · {clock((a.endedAt ?? a.startedAt) - a.startedAt)} · {a.actions}{' '}
                    {a.actions === 1 ? 'acción' : 'acciones'}
                  </Text>
                </Button>
                <Text dimColor>{a.description}</Text>
              </Box>
            ))}
            {done.length > 15 && <Text dimColor>… y {done.length - 15} más</Text>}
          </Box>
        )}

        {list.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>Total: {summary}</Text>
            <Text dimColor>Pulsa un agente para ver su conversación.</Text>
            {done.length > 0 && (
              <Button key="limpiar" plain onPress={limpiar}>
                <Text dimColor>[ limpiar terminados ]</Text>
              </Button>
            )}
          </Box>
        )}
      </Box>
    )
  })
}
