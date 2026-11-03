import type { Einstufung } from '../types'

// Einstufen: ist ein Prompt eine einfache Aufgabe, die das guenstige Modell
// genauso gut erledigt? Im Zweifel nein. Ein Wort aus SCHWER schlaegt jedes
// Wort aus EINFACH, damit "uebersetz und bau daraus eine Seite" beim
// Hauptmodell bleibt.

// Wortanfang auch vor Umlauten: \b kennt nur a bis z.
const wort = (muster: string) => new RegExp(`(?<!\\p{L})(?:${muster})`, 'iu')

const EINFACH: ReadonlyArray<readonly [RegExp, string]> = [
  [wort('übersetz|uebersetz|translate'), 'übersetzen'],
  [wort('fass\\p{L}*\\s.*zusammen|zusammenfass|summari[sz]e'), 'zusammenfassen'],
  [wort('korrigier|rechtschreib|tippfehler|grammatik|proofread'), 'korrigieren'],
  [wort('(?:formulier|schreib)\\p{L}*\\s.*(?:um|neu|kürzer|kuerzer|freundlicher|höflicher|hoeflicher|lockerer)(?!\\p{L})|umformulier|rephrase'), 'umformulieren'],
  [wort('kürz|kuerz|shorten'), 'kürzen'],
  [wort('betreff|überschrift|ueberschrift|titelvorschl|synonym'), 'kurzer Text'],
  [wort('was (?:heißt|heisst|bedeutet)|wie schreibt man|what does .* mean'), 'Begriff'],
  [wort('rechne|umrechn|convert|wie viel (?:ist|sind)'), 'rechnen'],
  [wort('formatier|als liste|als tabelle|sortier|alphabetisch'), 'formatieren'],
  [wort('emoji|hashtag'), 'kurzer Text'],
]

const SCHWER = wort(
  '(?:bau|implementier|programmier|refactor|debug|fehler|bug|warum|wieso|analys|plan|architektur|recherch|prüf|pruef|test|deploy|migrier|sicherheit|review|entwickl|install|konfigur|einricht|optimier|strategie|entscheid|vergleich|datei|ordner|repo|commit|vertrag|rechtlich|rechtsfrage|steuer|code|skript|script|funktion)\\p{L}*',
)

/** Laenger als das ist keine einfache Aufgabe mehr. */
const MAX_ZEICHEN = 400

export function einstufen(roh: string): Einstufung {
  const text = roh.trim()
  if (text === '') return { stufe: 'normal', grund: 'kein Text' }
  if (text.startsWith('/')) return { stufe: 'normal', grund: 'Befehl' }
  if (text.length > MAX_ZEICHEN) return { stufe: 'normal', grund: 'lange Aufgabe' }
  if (text.includes('```') || text.split('\n').length > 4) return { stufe: 'normal', grund: 'Code oder viel Text' }

  const schwer = SCHWER.exec(text)
  if (schwer !== null) return { stufe: 'normal', grund: `„${schwer[0]}“ braucht das Hauptmodell` }

  for (const [muster, art] of EINFACH) {
    if (muster.test(text)) return { stufe: 'einfach', grund: art }
  }

  return { stufe: 'normal', grund: 'nicht eindeutig einfach' }
}

// Listenpreise in US-Dollar pro Million Tokens: Input, Output, Cache-Lesen.
// Cache-Schreiben kostet bei einer Stunde das Doppelte des Inputs, bei fuenf
// Minuten das 1,25-fache. Haiku 5.5 kostet ab 100.000 Tokens im Prompt mehr.
// Quelle: Anthropic-Preistabelle, Stand 06.10.2026.
type Preis = { name: string; input: number; output: number; lesen: number }

const PREISE: ReadonlyArray<readonly [string, Preis]> = [
  ['claude-fable-5-1', { name: 'Fable 5.1', input: 10, output: 50, lesen: 0.25 }],
  ['claude-mythos-5-1', { name: 'Mythos 5.1', input: 10, output: 50, lesen: 0.25 }],
  ['claude-fable-5', { name: 'Fable 5', input: 10, output: 50, lesen: 1 }],
  ['claude-opus-5-5', { name: 'Opus 5.5', input: 4, output: 20, lesen: 0.2 }],
  ['claude-opus-5', { name: 'Opus 5', input: 5, output: 25, lesen: 0.5 }],
  ['claude-opus-4', { name: 'Opus 4', input: 5, output: 25, lesen: 0.5 }],
  ['claude-sonnet-5-5', { name: 'Sonnet 5.5', input: 2, output: 10, lesen: 0.2 }],
  ['claude-sonnet-5', { name: 'Sonnet 5', input: 2, output: 10, lesen: 0.2 }],
  ['claude-sonnet-4', { name: 'Sonnet 4', input: 3, output: 15, lesen: 0.3 }],
  ['claude-haiku-5-5', { name: 'Haiku 5.5', input: 0.1, output: 0.5, lesen: 0.01 }],
  ['claude-haiku-4-5', { name: 'Haiku 4.5', input: 1, output: 5, lesen: 0.1 }],
]

const HAIKU_55_GRENZE = 100_000
const HAIKU_55_LANG: Preis = { name: 'Haiku 5.5', input: 0.5, output: 2.5, lesen: 0.05 }

export function preisFuer(modell: string, kontext = 0): Preis | undefined {
  const treffer = PREISE.filter(([kennung]) => modell.includes(kennung)).sort((a, b) => b[0].length - a[0].length)[0]
  if (treffer === undefined) return undefined
  if (treffer[0] === 'claude-haiku-5-5' && kontext > HAIKU_55_GRENZE) return HAIKU_55_LANG

  return treffer[1]
}

export function modellName(modell: string) {
  return preisFuer(modell)?.name ?? modell
}

/** So viele Tokens schreibt eine einfache Antwort ungefaehr. */
export const ANTWORT_TOKENS = 1500

export type Rechnung = { lohnt: boolean; hauptUsd: number; billigUsd: number; grund: string }

/**
 * Lohnt der Wechsel? Das Hauptmodell liest den Kontext guenstig aus seinem
 * Cache, wenn er warm ist. Das guenstige Modell muss ihn erst neu schreiben.
 * Bei langem Kontext frisst das die Ersparnis bei der Antwort auf.
 */
export function rechnen(haupt: string, billig: string, kontext: number, hauptWarm: boolean, stunde: boolean): Rechnung {
  const h = preisFuer(haupt, kontext)
  const b = preisFuer(billig, kontext)
  if (h === undefined || b === undefined) return { lohnt: false, hauptUsd: 0, billigUsd: 0, grund: 'Preis unbekannt' }

  const schreiben = stunde ? 2 : 1.25
  const m = 1_000_000
  const hauptUsd = (kontext * (hauptWarm ? h.lesen : h.input * schreiben) + ANTWORT_TOKENS * h.output) / m
  const billigUsd = (kontext * b.input * schreiben + ANTWORT_TOKENS * b.output) / m
  const lohnt = billigUsd < hauptUsd

  return {
    lohnt,
    hauptUsd,
    billigUsd,
    grund: lohnt ? `${b.name} ist hier günstiger` : `bei ${Math.round(kontext / 1000)}k Kontext wäre ${b.name} teurer`,
  }
}

/** Was der Zug auf dem Hauptmodell ungefaehr gekostet haette, aus der echten Nutzung. */
export function hauptKosten(
  haupt: string,
  nutzung: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number },
  hauptWarm: boolean,
  stunde: boolean,
) {
  const kontext = nutzung.input_tokens + nutzung.cache_read_input_tokens + nutzung.cache_creation_input_tokens
  const h = preisFuer(haupt, kontext)
  if (h === undefined) return 0
  const schreiben = stunde ? 2 : 1.25

  return (kontext * (hauptWarm ? h.lesen : h.input * schreiben) + nutzung.output_tokens * h.output) / 1_000_000
}

/** Was der Zug auf dem guenstigen Modell wirklich gekostet hat. */
export function echteKosten(
  modell: string,
  nutzung: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number },
  stunde: boolean,
) {
  const kontext = nutzung.input_tokens + nutzung.cache_read_input_tokens + nutzung.cache_creation_input_tokens
  const p = preisFuer(modell, kontext)
  if (p === undefined) return 0

  return (
    (nutzung.input_tokens * p.input +
      nutzung.cache_read_input_tokens * p.lesen +
      nutzung.cache_creation_input_tokens * p.input * (stunde ? 2 : 1.25) +
      nutzung.output_tokens * p.output) /
    1_000_000
  )
}
