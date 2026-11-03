export type Stufe = 'einfach' | 'normal'

export type Einstufung = {
  stufe: Stufe
  /** Kurz, warum: das Wort, an dem es hing. */
  grund: string
}

/** Was fuer den laufenden Zug im Hauptchat gilt. */
export type Zug = {
  turnId: string
  einstufung: Einstufung
  /** Modell, das der Mod fuer diesen Zug gesetzt hat; null heisst Hauptmodell. */
  modell: string | null
  /** Warum gewechselt oder nicht, fuer /sparen. */
  begruendung: string
}

export type SparStand = {
  /** Einstufung des zuletzt abgeschickten Prompts, bis sein Zug startet. */
  wartend: Einstufung | null
  zug: Zug | null
  /** Letzte Anfrage auf dem Hauptmodell, ms seit Epoch: ist sein Cache noch warm. */
  letzteHauptanfrage: number | null
  /** Antworten dieser Sitzung mit dem guenstigen Modell. */
  antworten: number
  /** Geschaetzte Ersparnis dieser Sitzung in US-Dollar (API-Preis). */
  gespartUsd: number
}

declare module 'claude-code' {
  interface PluginState {
    'modell-sparen': { stand: SparStand }
  }
}
