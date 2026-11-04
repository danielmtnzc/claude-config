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

test('vacío: explica que aún no hay agentes', async $ => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /Ningún agente/ }))?.text).toBe(
      'Ningún agente todavía.',
    )
    await ui.unmount()
  }
})

test('un agente lanzado aparece trabajando, con su modelo y su tarea', async ($, on) => {
  on('clock.now', () => ({ value: 1_000 }))
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'ag-1' }))

  await $.agent.spawn({
    prompt: 'Busca dónde se usa LoginButton',
    description: 'Buscar LoginButton',
    subagentType: 'rapido',
  })

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /Trabajando \(1\)/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Buscar LoginButton/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /\(haiku\)/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Empezando/ })).toBeDefined()
    await ui.unmount()
  }
})
