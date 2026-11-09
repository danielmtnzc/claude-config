declare module 'claude-code' {
  interface PluginState {
    reparto: {
      /** Carpetas de proyectos Flutter con archivos .dart editados sin revisar. */
      pendientes: string[]
      /** Veces seguidas que se han devuelto errores a Claude en esta tarea. */
      intentos: number
    }
  }
}
