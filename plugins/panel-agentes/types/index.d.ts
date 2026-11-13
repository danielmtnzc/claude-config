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
  /** Tipo de agente, sin el prefijo del plugin: rapido, experto, Explore... */
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
  /** Coste estimado en dólares: solo se usa para calcular su porcentaje del límite semanal. */
  costUsd?: number
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

/** Uso de los límites de la cuenta, como los da la última respuesta. */
export type Limites = {
  /** Porcentaje usado del límite semanal. */
  semana?: number
  /** Cuándo se reinicia el límite semanal (ISO 8601). */
  semanaReinicio?: string
  /** Porcentaje usado del límite de 5 horas. */
  cincoHoras?: number
  /** Puntos del límite semanal que cuesta cada dólar estimado, para convertir coste en porcentaje. */
  pctPorDolar?: number
}

/** Lo que ha gastado en esta sesión el agente principal (el que escribe el usuario), por modelo. */
export type PrincipalState = {
  /** Coste estimado en dólares por modelo corto (sonnet, opus...). */
  costes: Record<string, number>
  /** Respuestas del agente principal. */
  turnos: number
}

/** Lo que se guarda de cada sesión para recuperarlo al volver a abrirla. */
export type Instantanea = {
  agents: AgentRow[]
  plan: PlanState
  principal: PrincipalState
  lastPrompt: string
}

/** Coste de un periodo (un día o una semana), por agente. */
export type PeriodoConsumo = {
  /** Etiqueta para mostrar: "lu 09/11" o "sem. 03/11". */
  etiqueta: string
  /** Coste total estimado en dólares (solo para repartir el porcentaje). */
  total: number
  /** Puntos del límite semanal gastados en el periodo. */
  pct: number
  /** Coste (en dólares) por agente: principal, rapido, experto, otros. */
  porAgente: Record<string, number>
  /** Coste de Opus, para ver qué parte se lleva. */
  opus: number
  /** Mayor porcentaje del límite semanal registrado en el periodo. */
  limiteMax?: number
}

/** Lo que muestra el panel de consumo. */
export type ResumenConsumo = {
  dias: PeriodoConsumo[]
  semanas: PeriodoConsumo[]
  /** Carpeta donde están los archivos de registro. */
  carpeta: string
  /** Cuándo se calculó, en milisegundos. */
  calculado: number
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
      limites: Shaped<Limites>
      principal: Shaped<PrincipalState>
      resumen: Shaped<ResumenConsumo | null>
    }
  }
}
