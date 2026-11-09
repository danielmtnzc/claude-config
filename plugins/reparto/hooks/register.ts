import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

/** Veces seguidas que se devuelven errores antes de dejarlo estar. */
const MAX_INTENTOS = 2
/** Líneas de error que se pasan a Claude, como mucho. */
const MAX_LINEAS = 20

const pendientes = atom({ plugin: 'reparto', key: 'pendientes' } as const, [])
const intentos = atom({ plugin: 'reparto', key: 'intentos' } as const, 0)

const EDITORES = new Set(['Edit', 'Write', 'MultiEdit'])

function padre(path: string): string | undefined {
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  if (cut <= 0) return undefined
  const dir = path.slice(0, cut)
  // "C:" sin barra no es una carpeta.
  return /^[A-Za-z]:$/.test(dir) ? undefined : dir
}

/** Líneas de error de la salida de `flutter analyze` (formatos con • y con -). */
export function errores(salida: string): string[] {
  return salida
    .split(/\r?\n/)
    .filter(l => /^\s*error\s+[•\-]\s+/i.test(l))
    .map(l => l.trim())
}

/** Las reglas de reparto, como si fueran un CLAUDE.md del usuario. */
async function reglas($: EngineInterface): Promise<{ path: string; content: string } | undefined> {
  const sep = $.plugin.root.includes('\\') ? '\\' : '/'
  const path = `${$.plugin.root}${sep}reglas.md`
  try {
    return { path, content: (await $.fs.read(path)) as string }
  } catch {
    return undefined
  }
}

export const register: Register = on => {
  // Reglas de reparto: se añaden a las instrucciones del usuario (las de
  // ~/.claude/CLAUDE.md), al principio, igual que antes hacía el instalador.
  on('prompt.context', async ($, e, next) => {
    const r = await next(e)
    const own = await reglas($)
    if (!own) return r

    // Sin instructionFiles en la respuesta, siguen los que llegaron.
    const current = r.instructionFiles ?? e.instructionFiles
    const hasClaudeMd = r.blocks.some(b => b.name === 'claudeMd')
    if (current !== undefined && hasClaudeMd) {
      const files = current.filter(f => f.path !== own.path)

      return { ...r, instructionFiles: [{ path: own.path, kind: 'user', content: own.content }, ...files] }
    }

    // Sin CLAUDE.md que ampliar: van como un bloque propio.
    return { ...r, blocks: [...r.blocks.filter(b => b.name !== 'reparto'), { name: 'reparto', text: own.content }] }
  })

  // Sonnet como modelo por defecto, solo si no has elegido otro en ningún sitio.
  on('settings.read', async ($, e, next) => {
    const s = await next(e)
    if (e.source !== undefined || (s as { model?: unknown }).model !== undefined) return s

    return { ...s, model: 'sonnet' }
  })

  // Apunta el proyecto de cada .dart editado, por Claude o por un subagente.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    const tool = String(e.tool)
    const path = (e as unknown as { file_path?: unknown }).file_path
    if (!EDITORES.has(tool) || typeof path !== 'string' || !path.endsWith('.dart')) {
      return ran
    }
    if (ran.deny !== undefined || ran.isError === true) return ran

    let dir = padre(path)
    for (let i = 0; dir !== undefined && i < 20; i++) {
      if (await $.fs.exists(`${dir}/pubspec.yaml`)) {
        const root = dir
        await update($, pendientes, list => (list.includes(root) ? list : [...list, root]))
        break
      }
      dir = padre(dir)
    }

    return ran
  })

  // Cada mensaje nuevo del usuario empieza la cuenta de intentos de cero.
  on('prompt.submit', async ($, e, next) => {
    await update($, intentos, () => 0)

    return next(e)
  })

  // Al terminar la respuesta: analiza los proyectos con cambios.
  on('classic.Stop', async ($, e, next) => {
    const r = await next(e)
    const list = await read($, pendientes)
    if (list.length === 0) return r

    const isWindows = (await $.env.get('OS')) === 'Windows_NT'
    const argv = isWindows ? ['cmd', '/c', 'flutter', 'analyze'] : ['flutter', 'analyze']
    const encontrados: string[] = []
    for (const root of list) {
      try {
        const res = await $.process.run(argv, { cwd: root, timeoutMs: 180_000 })
        const lines = errores(`${res.stdout}\n${res.stderr}`)
        if (lines.length > 0) {
          const nombre = root.split(/[\\/]/).pop() ?? root
          encontrados.push(`[${nombre}]`, ...lines)
        }
      } catch {
        // Sin Flutter instalado o se pasó de tiempo: no bloquea nada.
      }
    }

    const n = await read($, intentos)
    if (encontrados.length === 0 || n >= MAX_INTENTOS) {
      await update($, pendientes, () => [])
      await update($, intentos, () => 0)
      if (encontrados.length > 0) {
        void $.ui.toast('flutter analyze sigue con errores; revísalos a mano.')
      }

      return r
    }

    await update($, intentos, () => n + 1)
    const total = encontrados.filter(l => !l.startsWith('[')).length
    const shown = encontrados.slice(0, MAX_LINEAS)
    const more = encontrados.length > MAX_LINEAS ? `\n… y más (${total} errores en total).` : ''

    return {
      ...r,
      block:
        `flutter analyze ha encontrado ${total} error${total === 1 ? '' : 'es'} en archivos que has editado. ` +
        `Corrígelos antes de terminar:\n${shown.join('\n')}${more}`,
    }
  })
}
