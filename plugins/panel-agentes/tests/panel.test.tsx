import { expect, test } from 'claude-code/testing'

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
