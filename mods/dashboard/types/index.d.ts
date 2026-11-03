export type Art = 'todo' | 'antwort'

export type Punkt = {
  id: string
  art: Art
  text: string
  /** Wann abgehakt, ms seit Epoch; null solange offen. */
  erledigt: number | null
  /** Wann eingetragen, ms seit Epoch. */
  seit: number
}

declare module 'claude-code' {
  interface PluginState {
    dashboard: { punkte: Punkt[] }
  }
}
