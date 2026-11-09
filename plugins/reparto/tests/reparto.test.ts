import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const SALIDA_CON_ERRORES = [
  'Analyzing app...',
  "  error • Undefined name 'foo' • lib/main.dart:10:5 • undefined_identifier",
  '   info • Prefer const • lib/main.dart:3:1 • prefer_const_constructors',
  "error - The method 'bar' isn't defined - lib/home.dart:4:2 - undefined_method",
  '2 issues found.',
].join('\n')

function base(on: On, salida: () => string) {
  mock.env(on, { OS: 'Windows_NT' })
  on('fs.exists', (_, e) => ({
    // Bajo test el motor resuelve las rutas sobre Linux: se compara el final.
    value: String((e as { path: string }).path).replace(/\\/g, '/').endsWith('C:/p/app/pubspec.yaml'),
  }))
  on('tool.call', () => ({ result: {} }))
  on('classic.Stop', () => ({}))
  on('prompt.submit', (_, e) => e)
  const calls: string[][] = []
  on('process.run', (_, e) => {
    calls.push([...(e as { argv: string[] }).argv])
    return { value: { exitCode: 1, stdout: salida(), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  return calls
}

test('sin editar .dart no ejecuta nada', async ($, on) => {
  const calls = base(on, () => SALIDA_CON_ERRORES)
  await $.tool.call({ tool: 'Edit', file_path: 'C:/p/app/README.md', old_string: 'a', new_string: 'b' })
  const r = await $.classic.Stop({ stop_hook_active: false })
  expect(calls.length).toBe(0)
  expect(r.block).toBeUndefined()
})

test('con errores los devuelve a Claude, y para tras dos intentos', async ($, on) => {
  const calls = base(on, () => SALIDA_CON_ERRORES)
  await $.tool.call({ tool: 'Edit', file_path: 'C:/p/app/lib/main.dart', old_string: 'a', new_string: 'b' })

  const r1 = await $.classic.Stop({ stop_hook_active: false })
  expect(calls[0]).toEqual(['cmd', '/c', 'flutter', 'analyze'])
  expect(r1.block).toContain('2 errores')
  expect(r1.block).toContain("Undefined name 'foo'")
  expect(r1.block).toContain("The method 'bar' isn't defined")
  expect(r1.block).not.toContain('Prefer const')

  const r2 = await $.classic.Stop({ stop_hook_active: true })
  expect(r2.block).toContain('2 errores')

  const r3 = await $.classic.Stop({ stop_hook_active: true })
  expect(r3.block).toBeUndefined()

  // Ya se ha dado por terminado: no vuelve a analizar sin cambios nuevos.
  const r4 = await $.classic.Stop({ stop_hook_active: false })
  expect(r4.block).toBeUndefined()
  expect(calls.length).toBe(3)
})

test('sin errores deja terminar y limpia lo pendiente', async ($, on) => {
  const calls = base(on, () => 'Analyzing app...\nNo issues found!')
  await $.tool.call({ tool: 'Write', file_path: 'C:\\p\\app\\lib\\x.dart', content: 'x' })
  const r = await $.classic.Stop({ stop_hook_active: false })
  expect(r.block).toBeUndefined()
  await $.classic.Stop({ stop_hook_active: false })
  expect(calls.length).toBe(1)
})

test('añade las reglas de reparto delante de las instrucciones del usuario', async ($, on) => {
  on('fs.read', (_, e) => ({ value: e.path.endsWith('reglas.md') ? '# Reparto del trabajo\nreglas' : '' }))
  const input = {
    blocks: [{ name: 'claudeMd', text: 'proyecto' }, { name: 'currentDate', text: 'hoy' }],
    instructionFiles: [{ path: '/p/app/CLAUDE.md', kind: 'project' as const, content: 'proyecto' }],
  }
  on('prompt.context', (_, e) => ({ blocks: e.blocks }))

  const r = await $.prompt.context(input)
  const files = r.instructionFiles ?? []
  expect(files.length).toBe(2)
  expect(files[0]?.kind).toBe('user')
  expect(files[0]?.path.endsWith('reglas.md')).toBe(true)
  expect(files[0]?.content).toContain('# Reparto del trabajo')
  expect(files[1]?.path).toBe('/p/app/CLAUDE.md')
})

test('sin ningún CLAUDE.md, las reglas van como bloque propio', async ($, on) => {
  on('fs.read', () => ({ value: '# Reparto del trabajo' }))
  on('prompt.context', () => ({ blocks: [{ name: 'currentDate', text: 'hoy' }] }))

  const r = await $.prompt.context({ blocks: [] })
  expect(r.blocks.map(b => b.name)).toEqual(['currentDate', 'reparto'])
  expect(r.blocks[1]?.text).toBe('# Reparto del trabajo')
})

