export type TeamStatus = 'arbeitet' | 'wartet' | 'beendet'

export type TeamEintrag = {
  /** Sitzungs-ID, zugleich Dateiname und Adresse fuer Nachrichten. */
  id: string
  /** Rolle im Team, klein geschrieben. null bis /rolle. */
  rolle: string | null
  /** Letzter Teil des Arbeitsordners. */
  ordner: string
  status: TeamStatus
  /** Letztes Lebenszeichen, ms seit Epoch. */
  aktualisiert: number
}

declare module 'claude-code' {
  interface PluginState {
    'chat-team': { ich: TeamEintrag | null; team: TeamEintrag[]; ordnerPfad: string | null }
  }
}
