/** Estado de un subagente en el panel. */
export type AgentStatusEs = 'trabajando' | 'terminado' | 'error'

/** Una acción del agente, para la línea de tiempo del desplegable. */
export type AgentStep = {
  /** Milisegundos desde que empezó el agente. */
  at: number
  /** Icono del tipo de acción. */
  icon: string
  /** Lo que hizo, en pasado: "Leído main.dart". */
  text: string
}

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
  /** Lo que está haciendo ahora, en gerundio. */
  activity: string
  /** Número de acciones (llamadas a herramientas) que ha hecho. */
  actions: number
  /** Las últimas acciones, en orden. */
  steps: AgentStep[]
  /** Primer párrafo de su respuesta final, si se conoce. */
  result?: string
}

export type PlanPart = {
  id: string
  subject: string
  status: 'pending' | 'in_progress' | 'completed'
}

/** El plan del coordinador, sacado de su lista de tareas. */
export type PlanState = {
  title: string
  parts: PlanPart[]
}

declare module 'claude-code' {
  interface PluginState {
    'panel-agentes': {
      agents: Shaped<AgentRow[]>
      now: number
      /** Agentes terminados con el desplegable abierto. */
      open: string[]
      /** Agentes con la lista de acciones completa a la vista. */
      full: string[]
      plan: Shaped<PlanState>
      /** Lo último que escribió la persona, para titular el plan. */
      lastPrompt: string
    }
  }
}
