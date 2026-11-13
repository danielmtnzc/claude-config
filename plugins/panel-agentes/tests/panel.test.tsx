import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'panel-agentes',
  component: 'Pane',
  requestId: 'panel-agentes',
  props: {
    title: 'Agentes',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const SPAWN = {
  prompt: 'Busca dónde se usa LoginButton',
  description: 'Buscar LoginButton',
  subagentType: 'rapido',
  tool_use_id: 'tu-1',
} as never

test('vacío: explica que aún no hay agentes', async $ => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /Ningún agente/ }))?.text).toBe(
      'Ningún agente todavía.',
    )
    await ui.unmount()
  }
})

test('un agente lanzado sale en su tarjeta, con modelo, tarea y acción', async ($, on) => {
  on('clock.now', () => ({ value: 1_000 }))
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'ag-1' }))
  on('tool.call', () => ({ result: {} }))

  await $.agent.spawn(SPAWN)
  await $.tool.call({ tool: 'Read', file_path: '/app/lib/main.dart', agentId: 'ag-1' })

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /EN VIVO/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Buscar LoginButton/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Haiku/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Leyendo main\.dart/ })).toBeDefined()
    await ui.unmount()
  }
})

test('al terminar, el desplegable muestra sus acciones y el resultado', async ($, on) => {
  on('clock.now', () => ({ value: 1_000 }))
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'ag-1' }))
  on('tool.call', (_, e) =>
    e.tool === 'Agent'
      ? { result: {}, text: 'Async agent launched successfully. agentId: ag-1' }
      : { result: {} },
  )
  on('turn.complete', (_, e) => ({ text: e.answer }))

  await $.agent.spawn(SPAWN)
  // La herramienta Agent vuelve al momento si el agente va en segundo plano:
  // eso no debe marcarlo como terminado.
  await $.tool.call({
    tool: 'Agent',
    description: 'Buscar LoginButton',
    prompt: 'x',
    subagent_type: 'rapido',
    run_in_background: true,
    tool_use_id: 'tu-1',
  } as never)
  {
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    expect(await ui.find({ type: 'Text', text: /EN VIVO/ })).toBeDefined()
    await ui.unmount()
  }
  await $.tool.call({ tool: 'Grep', pattern: 'LoginButton', agentId: 'ag-1' })
  await $.turn.complete({
    agentId: 'ag-1',
    turnId: 't-1',
    reason: 'answer',
    answer: 'LoginButton se usa en login_screen.dart.\n\nDetalles…',
    durationMs: 1000,
    isAborted: false,
  } as never)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /TERMINADOS/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Buscado "LoginButton"/ })).toBeUndefined()

    await ui.press({ key: 'abrir:ag-1' })
    expect(await ui.find({ type: 'Text', text: /Buscado "LoginButton"/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /se usa en login_screen/ })).toBeDefined()

    await ui.press({ key: 'abrir:ag-1' })
    await ui.unmount()
  }
})

test('las tareas del coordinador forman el plan', async ($, on) => {
  let n = 0
  on('tool.call', (_, e) =>
    e.tool === 'TaskCreate' ? { result: {}, text: `Task #${++n} created successfully` } : { result: {} },
  )

  await $.tool.call({ tool: 'TaskCreate', subject: 'Login', description: 'x' } as never)
  await $.tool.call({ tool: 'TaskCreate', subject: 'Listado', description: 'x' } as never)
  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'completed' } as never)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /1 \/ 2 partes/ })).toBeDefined()
    await ui.unmount()
  }
})

const CONSUMO = { ...PANE, requestId: 'panel-consumo', props: { ...PANE.props, title: 'Consumo' } } as const

// 9 de noviembre de 2026, 10:30 UTC (un lunes).
const AHORA = Date.UTC(2026, 10, 9, 10, 30)

const PRECIOS = JSON.stringify({
  modelos: {
    opus: { entrada: 4, salida: 20, cache_escritura: 5, cache_lectura: 0.2 },
    sonnet: { entrada: 2, salida: 10, cache_escritura: 2.5, cache_lectura: 0.1 },
    haiku: { entrada: 0.1, salida: 0.5, cache_escritura: 0.125, cache_lectura: 0.01 },
  },
})

/** Un sistema de archivos en memoria y lo que hace falta para arrancar la sesión. */
function mundo(on: On, archivos: Record<string, string> = {}) {
  const fs: Record<string, string> = { ...archivos }
  mock.env(on, { OS: 'Linux', HOME: '/home/dani', HOSTNAME: 'portatil' })
  on('clock.now', () => ({ value: AHORA }))
  on('clock.every', () => ({ value: undefined }))
  on('command.register', (_, e) => ({ value: { command: (e as { name: string }).name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('session.root', () => ({ value: '/proyectos/mi-app' }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { window: 1_000_000 },
      rateLimits: [
        { kind: 'seven_day', percentUsed: 42.5, resetsAt: '2026-11-12T08:00:00Z' },
        { kind: 'five_hour', percentUsed: 12 },
      ],
    },
  }))
  // Desfase horario: UTC+1.
  on('process.run', () => ({
    value: { exitCode: 0, stdout: '+0100\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  // En Windows el motor devuelve rutas como C:\home\dani\...: se comparan sin unidad y con /.
  const k = (path: string) => path.replace(/^[A-Za-z]:/, '').replaceAll('\\', '/')
  on('fs.exists', (_, e) => ({ value: k(e.path) in fs }))
  on('fs.read', (_, e) => {
    if (e.path.endsWith('precios.json')) return { value: PRECIOS }
    const text = fs[k(e.path)]
    if (text === undefined) throw new Error('ENOENT')

    return { value: text }
  })
  on('fs.write', (_, e) => {
    fs[k(e.path)] = e.text

    return { value: undefined }
  })
  on('turn.complete', (_, e) => ({ text: e.answer }))

  return fs
}

const TOKENS = { input_tokens: 100_000, output_tokens: 50_000, cache_creation_input_tokens: 0, cache_read_input_tokens: 1_000_000 }

test('cada turno deja una línea en el CSV del mes, con coste y límite', async ($, on) => {
  const fs = mundo(on)
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: 'ag-9' }))
  await $.session.start({ cwd: '/proyectos/mi-app', surface: 'desktop', isInteractive: true })

  // Turno de la sesión principal (Sonnet).
  await $.turn.complete({
    answer: 'hecho', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer',
    usage: { ...TOKENS, model: 'claude-sonnet-5-5' },
  })
  // Un experto (Opus) que termina.
  await $.agent.spawn({ prompt: 'Diagnostica', description: 'Diagnóstico', subagentType: 'reparto:experto' } as never)
  await $.turn.complete({
    answer: 'plan', durationMs: 10, isAborted: false, turnId: 't2', reason: 'answer', agentId: 'ag-9',
    usage: { ...TOKENS, model: 'claude-opus-5-5' },
  })

  const csv = fs['/home/dani/.claude/consumo/consumo-2026-11.csv']
  expect(csv).toBeDefined()
  const lineas = (csv ?? '').replace(/^﻿/, '').trim().split('\n')
  expect(lineas[0]).toBe(
    'fecha;hora;equipo;proyecto;agente;modelo;entrada;salida;cache_escritura;cache_lectura;coste_usd;limite_semanal_pct',
  )
  // Sonnet: 100000*2 + 50000*10 + 1000000*0,1 = 800000 / 1e6 = 0,8 $; hora local UTC+1.
  expect(lineas[1]).toBe('2026-11-09;11:30;portatil;mi-app;principal;claude-sonnet-5-5;100000;50000;0;1000000;0,8000;42,5')
  // Opus: 100000*4 + 50000*20 + 1000000*0,2 = 1,6 $.
  expect(lineas[2]).toBe('2026-11-09;11:30;portatil;mi-app;experto;claude-opus-5-5;100000;50000;0;1000000;1,6000;42,5')

  // El panel muestra el límite y lo que costó el experto.
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /Límite semanal 43% · 5 horas 12%/ })).toBeDefined()
    // 42,5% de la semana entre 0,8 $ registrados = 53,1 puntos por dólar: el experto (1,6 $) es ≈85%.
    expect(await ui.find({ type: 'Text', text: /≈85%/ })).toBeDefined()
    // La sesión principal (Sonnet) también aparece, con lo suyo (0,8 $ → ≈43%).
    expect(await ui.find({ type: 'Text', text: /^principal$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /≈43%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /\$/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('/consumo resume por día y semana, con el límite semanal', async ($, on) => {
  const previo = [
    '﻿fecha;hora;equipo;proyecto;agente;modelo;entrada;salida;cache_escritura;cache_lectura;coste_usd;limite_semanal_pct',
    '2026-11-03;10:00;p;a;principal;claude-sonnet-5-5;1;1;0;0;1,5000;30,0',
    '2026-11-03;11:00;p;a;experto;claude-opus-5-5;1;1;0;0;0,5000;31,0',
    '2026-11-04;09:00;p;a;rapido;claude-haiku-5-5;1;1;0;0;0,0200;33,0',
    '2026-11-09;09:00;p;a;principal;claude-sonnet-5-5;1;1;0;0;2,0000;40,0',
    '',
  ].join('\n')
  mundo(on, { '/home/dani/.claude/consumo/consumo-2026-11.csv': previo })
  await $.session.start({ cwd: '/proyectos/mi-app', surface: 'desktop', isInteractive: true })
  // Un turno para conocer los límites.
  await $.turn.complete({
    answer: '', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer',
    usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, model: 'claude-sonnet-5-5' },
  })

  const r = await $.command.run({ command: 'consumo' } as never)
  expect(r.text).toBe('Panel de consumo abierto.')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...CONSUMO, surface })
    expect(await ui.find({ type: 'Text', text: /Límite semanal: 43%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /se reinicia 12\/11 09:00/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /lu 09\/11\s+9,5% del límite semanal/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /ma 03\/11\s+1% del límite semanal · Opus 25%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /principal 0,8% · experto 0,3%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /sem\. 09\/11\s+43% del límite semanal/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /sem\. 02\/11\s+33% del límite semanal · Opus 25%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /principal 25% · rápido 0,3% · experto 8,2%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /\$/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('los agentes de un plugin se muestran sin el prefijo', async ($, on) => {
  on('clock.now', () => ({ value: 1_000 }))
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'ag-1' }))
  await $.agent.spawn({ ...(SPAWN as object), subagentType: 'reparto:rapido' } as never)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /^rapido$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /reparto:/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('lo de un chat se guarda al cerrarlo, se recupera al reabrirlo y un /clear deja el panel vacío', async ($, on) => {
  mundo(on)
  const store: Record<string, unknown> = {}
  let id = 'chat-viejo'
  on('session.id', () => ({ value: id }))
  on('store.get', (_, e) => ({ value: store[(e as { key: string }).key] }))
  on('store.set', (_, e) => {
    store[(e as { key: string }).key] = (e as { value: unknown }).value

    return { value: undefined }
  })
  on('store.delete', () => ({ value: undefined }))
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'ag-1' }))
  await $.session.start({ cwd: '/proyectos/mi-app', surface: 'desktop', isInteractive: true })
  await $.agent.spawn({ ...(SPAWN as object), subagentType: 'reparto:rapido' } as never)
  await $.turn.complete({
    answer: 'listo', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer', agentId: 'ag-1',
    usage: { ...TOKENS, model: 'claude-haiku-5-5' },
  })

  // /clear: el chat que acaba se guarda y el panel queda vacío para el nuevo.
  await $.session.end({ reason: 'clear', sessionId: 'chat-viejo', resume: { id: 'chat-viejo' } } as never)
  expect(store['chat:chat-viejo']).toBeDefined()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /^rapido$/ })).toBeUndefined()
  await ui.unmount()

  // Al volver a abrir el chat viejo, vuelve su lista.
  await $.session.start({ cwd: '/proyectos/mi-app', surface: 'desktop', isInteractive: true })
  const ui2 = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui2.find({ type: 'Text', text: /Ningún agente todavía/ })).toBeUndefined()
  await ui2.unmount()
  id = 'chat-nuevo'
})
