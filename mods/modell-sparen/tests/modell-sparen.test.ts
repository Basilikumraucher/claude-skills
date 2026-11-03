import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { einstufen, rechnen } from '../hooks/einstufen'

const START = 1_800_000_000_000
const HAUPT = 'claude-opus-5-5'

// Die Welt unter der Mod: ein Abo (Nutzungsfenster gemeldet, also eine Stunde
// Cache), ein Kontext der gewuenschten Groesse, und ein Modell, das antwortet
// und meldet, mit welchem Modell und wie viel.
function welt(on: On, kontext: number) {
  const gesendet: { model: string; effort?: string | number }[] = []
  on('session.usage', () => ({
    value: {
      startedAt: START,
      context: { tokens: kontext, window: 1_000_000, percent: 1 },
      rateLimits: [{ window: 'five_hour', utilization: 0.1 }],
    },
  }) as never)
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.status', () => ({ value: undefined }) as never)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }) as never)
  on('turn.step', async function* (_$, e) {
    gesendet.push({ model: e.model, effort: e.effort })

    return {
      turnId: e.turnId,
      index: e.index,
      answer: 'ok',
      toolUses: [],
      stopReason: 'end_turn',
      usage: { model: e.model, input_tokens: 5, output_tokens: 300, cache_read_input_tokens: 0, cache_creation_input_tokens: kontext },
    } as never
  })

  return gesendet
}

async function zug($: Engine, text: string, turnId: string) {
  await $.prompt.submit({ text, origin: { kind: 'composer' } } as never)
  await $.turn.start({ text, turnId })
  const strom = $.turn.step({ turnId, index: 0, model: HAUPT, effort: 'high', messageCount: 3 })
  for await (const _ of strom) {
    // nur durchlesen
  }

  return strom.result
}

async function start($: Engine, on: On, kontext = 30_000) {
  mock.clock(on, { now: START })
  mock.store(on)
  const gesendet = welt(on, kontext)
  await $.session.start({ cwd: '/Users/t/projekt', surface: 'terminal', isInteractive: true })

  return gesendet
}

test('stuft einfache Aufgaben ein, im Zweifel nicht', () => {
  expect(einstufen('Übersetz „Guten Morgen, wie geht es dir?“ ins Englische').stufe).toBe('einfach')
  expect(einstufen('Fass mir diese Mail in drei Sätzen zusammen').stufe).toBe('einfach')
  expect(einstufen('Korrigier die Rechtschreibfehler: Ich hab das gestern gemmacht').stufe).toBe('einfach')
  expect(einstufen('Formulier das freundlicher um: Schick mir endlich die Rechnung').stufe).toBe('einfach')
  expect(einstufen('Bau mir eine Landingpage für mein Café').stufe).toBe('normal')
  expect(einstufen('Übersetz die Datei readme.md und prüf die Links').stufe).toBe('normal')
  expect(einstufen('Warum schlägt der Test fehl?').stufe).toBe('normal')
  expect(einstufen('mach weiter').stufe).toBe('normal')
  expect(einstufen('/sparen').stufe).toBe('normal')
})

test('rechnet: bis 100.000 Tokens lohnt Haiku 5.5, darüber nicht', () => {
  expect(rechnen(HAUPT, 'claude-haiku-5-5', 40_000, true, true).lohnt).toBe(true)
  expect(rechnen(HAUPT, 'claude-haiku-5-5', 150_000, true, true).lohnt).toBe(false)
  // Sonnet als guenstiges Modell: nur bei kaltem Cache des Hauptmodells
  expect(rechnen(HAUPT, 'claude-sonnet-5-5', 40_000, false, true).lohnt).toBe(true)
})

test('einfache Aufgabe läuft über Haiku 5.5 mit mittlerem Nachdenken', async ($, on) => {
  const gesendet = await start($, on)
  await zug($, 'Übersetz „Danke für deine schnelle Antwort“ ins Englische', 't1')
  expect(gesendet[0]).toEqual({ model: 'claude-haiku-5-5', effort: 'medium' })
})

test('normale Aufgabe bleibt beim Hauptmodell', async ($, on) => {
  const gesendet = await start($, on)
  await zug($, 'Bau mir ein Kontaktformular mit Spamschutz', 't1')
  expect(gesendet[0]).toEqual({ model: HAUPT, effort: 'high' })
})

test('bei langem Kontext und warmem Cache bleibt auch die einfache Aufgabe beim Hauptmodell', async ($, on) => {
  const gesendet = await start($, on, 150_000)
  await zug($, 'Bau mir ein Kontaktformular mit Spamschutz', 't1')
  await zug($, 'Übersetz „Bis morgen“ ins Englische', 't2')
  expect(gesendet[1]?.model).toBe(HAUPT)
})

test('bei langem Kontext und kaltem Cache ist Haiku trotzdem günstiger', async ($, on) => {
  const gesendet = await start($, on, 150_000)
  await zug($, 'Übersetz „Bis morgen“ ins Englische', 't1')
  expect(gesendet[0]?.model).toBe('claude-haiku-5-5')
})

test('/sparen aus schaltet den Wechsel ab, /sparen zeigt die Bilanz', async ($, on) => {
  const gesendet = await start($, on)
  await zug($, 'Übersetz „Guten Abend“ ins Spanische', 't1')
  const bilanz = await $.command.run({ command: 'sparen', args: '' } as never)
  expect(bilanz.text).toContain('1 Antworten mit Haiku 5.5')

  await $.command.run({ command: 'sparen', args: 'aus' } as never)
  await zug($, 'Übersetz „Gute Nacht“ ins Spanische', 't2')
  expect(gesendet[1]?.model).toBe(HAUPT)
})
