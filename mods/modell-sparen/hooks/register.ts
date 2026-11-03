import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { SparStand } from '../types'
import { echteKosten, einstufen, hauptKosten, modellName, rechnen } from './einstufen'

// Modell sparen: einfache Aufgaben (uebersetzen, zusammenfassen, umformulieren)
// laufen automatisch ueber das guenstige Modell, alles andere bleibt beim
// Hauptmodell. Vor jedem Wechsel rechnet der Mod nach, ob er sich lohnt.

const LEER: SparStand = { wartend: null, zug: null, letzteHauptanfrage: null, antworten: 0, gespartUsd: 0 }
const stand = atom({ plugin: 'modell-sparen', key: 'stand' } as const, LEER)

const STANDARD_BILLIG = 'claude-haiku-5-5'
const MODELLE: Record<string, string> = { haiku: 'claude-haiku-5-5', sonnet: 'claude-sonnet-5-5' }
const MINUTE = 60_000

function geld(usd: number) {
  if (usd < 0.01) return 'unter 0,01 $'

  return `${usd.toFixed(2).replace('.', ',')} $`
}

async function einstellungen($: EngineInterface) {
  const an = ((await $.store.get('an')) ?? true) as boolean
  const billig = ((await $.store.get('billig')) ?? STANDARD_BILLIG) as string

  return { an, billig }
}

/** Mit Abo haelt der Cache eine Stunde, mit API-Schluessel fuenf Minuten. */
async function cacheStunde($: EngineInterface) {
  return (await $.session.usage()).rateLimits.length > 0
}

async function zeichnen($: EngineInterface) {
  const { an, billig } = await einstellungen($)
  const s = await read($, stand)
  if (!an) {
    $.ui.status('Sparmodus aus · /sparen an')

    return
  }
  const zuletzt = s.zug?.modell != null ? `diese Antwort: ${modellName(s.zug.modell)}` : 'diese Antwort: Hauptmodell'
  const bilanz = s.antworten > 0 ? ` · ${s.antworten}× ${modellName(billig)}, ca. ${geld(s.gespartUsd)} gespart` : ''
  $.ui.status(`Sparmodus · ${s.zug === null ? 'bereit' : zuletzt}${bilanz}`)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'sparen',
      description: 'Modell sparen: Stand anzeigen, an, aus, haiku oder sonnet als günstiges Modell',
      argumentHint: 'an | aus | haiku | sonnet',
    })
    await zeichnen($)

    return next(e)
  })

  // Der Prompt wird eingestuft, sobald er abgeschickt ist.
  on('prompt.submit', async ($, e, next) => {
    if (e.command === undefined && e.isMeta !== true) {
      const einstufung = einstufen(e.text)
      await update($, stand, alt => ({ ...alt, wartend: einstufung }))
    }

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      await update($, stand, alt => ({
        ...alt,
        wartend: null,
        // Ein Zug ohne frischen Prompt (Weitermachen, Nachricht eines anderen
        // Chats) bleibt beim Hauptmodell.
        zug: {
          turnId: e.turnId,
          einstufung: alt.wartend ?? { stufe: 'normal', grund: 'kein neuer Prompt' },
          modell: null,
          begruendung: '',
        },
      }))
    }

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const s = await read($, stand)
    const { an, billig } = await einstellungen($)
    const zug = s.zug
    const imHauptchat = e.agentId === undefined && zug !== null && zug.turnId === e.turnId
    const stunde = await cacheStunde($)
    const jetzt = await $.clock.now()
    const hauptWarm = s.letzteHauptanfrage !== null && jetzt - s.letzteHauptanfrage < (stunde ? 60 : 5) * MINUTE

    if (!imHauptchat || !an || e.model.includes(billig)) {
      if (e.agentId === undefined) await update($, stand, alt => ({ ...alt, letzteHauptanfrage: jetzt }))

      return yield* next(e)
    }

    // Beim ersten Schritt des Zugs wird entschieden, danach gilt es fuer den ganzen Zug.
    let modell = zug.modell
    if (e.index === 0) {
      let begruendung = zug.einstufung.grund
      modell = null
      if (zug.einstufung.stufe === 'einfach') {
        const kontext = (await $.session.usage()).context.tokens ?? 0
        const r = rechnen(e.model, billig, kontext, hauptWarm, stunde)
        begruendung = `${zug.einstufung.grund}, ${r.grund}`
        if (r.lohnt) modell = billig
      }
      const gewaehlt = modell
      await update($, stand, alt => (alt.zug === null ? alt : { ...alt, zug: { ...alt.zug, modell: gewaehlt, begruendung } }))
    }

    if (modell === null) {
      await update($, stand, alt => ({ ...alt, letzteHauptanfrage: jetzt }))

      return yield* next(e)
    }

    // Einfache Aufgabe: guenstiges Modell mit mittlerem Nachdenken. Mit "low"
    // gab Haiku 5.5 im echten Lauf am 29.10.2026 Uebersetzungen unuebersetzt zurueck.
    const ergebnis = yield* next({ ...e, model: modell, effort: 'medium' })
    if (ergebnis.usage !== null) {
      const nutzung = ergebnis.usage
      const ersparnis = Math.max(0, hauptKosten(e.model, nutzung, hauptWarm, stunde) - echteKosten(nutzung.model, nutzung, stunde))
      await update($, stand, alt => ({
        ...alt,
        antworten: alt.antworten + (e.index === 0 ? 1 : 0),
        gespartUsd: alt.gespartUsd + ersparnis,
      }))
    }

    return ergebnis
  })

  on('turn.complete', async ($, e, next) => {
    const ergebnis = await next(e)
    if (e.agentId === undefined) await zeichnen($)

    return ergebnis
  })

  on('command.run', { command: 'sparen' }, async ($, e) => {
    const wunsch = e.args.trim().toLowerCase()
    if (wunsch === 'an' || wunsch === 'aus') {
      await $.store.set('an', wunsch === 'an')
      await zeichnen($)

      return { text: wunsch === 'an' ? 'Sparmodus an.' : 'Sparmodus aus. Alles läuft über dein Hauptmodell.' }
    }
    const modell = MODELLE[wunsch]
    if (modell !== undefined) {
      await $.store.set('billig', modell)
      await zeichnen($)

      return { text: `Günstiges Modell: ${modellName(modell)}` }
    }
    if (wunsch !== '') return { text: 'Unbekannt. Möglich: /sparen, /sparen an, /sparen aus, /sparen haiku, /sparen sonnet' }

    const { an, billig } = await einstellungen($)
    const s = await read($, stand)
    const zeilen = [
      `Sparmodus ${an ? 'an' : 'aus'}, günstiges Modell: ${modellName(billig)}`,
      s.zug === null
        ? 'Noch keine Antwort in dieser Sitzung.'
        : `Letzte Antwort: ${s.zug.modell === null ? 'Hauptmodell' : modellName(s.zug.modell)} (${s.zug.begruendung || s.zug.einstufung.grund})`,
      `Diese Sitzung: ${s.antworten} Antworten mit ${modellName(billig)}, ca. ${geld(s.gespartUsd)} gespart (API-Preis)`,
      'Einfach heißt: übersetzen, zusammenfassen, korrigieren, umformulieren, kürzen, formatieren, Begriffe, kurze Rechnungen. Im Zweifel bleibt das Hauptmodell.',
      'Mit Abo zahlst du das nicht direkt, du sparst Limit. Die Beträge zeigen, was dieselbe Arbeit über die API gekostet hätte.',
    ]

    return { text: zeilen.join('\n') }
  })
}
