/** Estado de un subagente en el panel. */
export type AgentStatusEs = 'trabajando' | 'terminado' | 'error'

/** Una fila del panel: un subagente lanzado en esta sesión. */
export type AgentRow = {
  /** id del subagente (el agentId de su bucle). */
  id: string
  /** id de la llamada a la herramienta Agent que lo lanzó. */
  toolUseId: string
  /** Tipo de agente: rapido, normal, experto, Explore... */
  type: string
  /** Modelo en versión corta: haiku, sonnet, opus... */
  model: string
  /** Descripción corta de la tarea. */
  description: string
  status: AgentStatusEs
  startedAt: number
  endedAt?: number
  /** Lo último que está haciendo (herramienta y objetivo). */
  activity: string
  /** Número de acciones (llamadas a herramientas) que ha hecho. */
  actions: number
}

declare module 'claude-code' {
  interface PluginState {
    'panel-agentes': {
      agents: Shaped<AgentRow[]>
      now: number
    }
  }
}
