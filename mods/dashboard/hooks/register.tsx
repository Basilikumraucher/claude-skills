import { atom, read, update } from 'claude-code'
import type { ElementConstructor, EngineInterface, InputProps, Register, ResolveInput } from 'claude-code'

import type { Art, Punkt } from '../types'

// Dashboard: ein Fenster neben dem Chat mit deinen To-dos und den Nachrichten,
// die du noch beantworten musst. Die Liste liegt im Speicher der Mod und gilt
// fuer jeden Chat. Eintragen per /todo, /antworten, im Fenster oder indem du
// Claude bittest, abhaken per Klick.

const punkte = atom({ plugin: 'dashboard', key: 'punkte' } as const, [])

const PANE = 'dashboard'
const TAG = 24 * 60 * 60_000
// Abgehakt bleibt ein Punkt einen Tag sichtbar und eine Woche gespeichert.
const SICHTBAR_MS = TAG
const BEHALTEN_MS = 7 * TAG
const UEBERSCHRIFT: Record<Art, string> = { todo: 'To-dos', antwort: 'Antworten' }
const LEER: Record<Art, string> = {
  todo: 'Nichts offen.',
  antwort: 'Keine offenen Nachrichten.',
}

async function laden($: EngineInterface) {
  const jetzt = await $.clock.now()
  const gespeichert = ((await $.store.get('punkte')) ?? []) as Punkt[]
  const frisch = gespeichert.filter(p => p.erledigt === null || jetzt - p.erledigt < BEHALTEN_MS)
  await update($, punkte, () => frisch)

  return frisch
}

async function aendern($: EngineInterface, fn: (alt: Punkt[]) => Punkt[]) {
  // Erst frisch laden: ein anderer Chat kann inzwischen etwas eingetragen haben.
  await laden($)
  await update($, punkte, fn)
  const neu = await read($, punkte)
  await $.store.set('punkte', neu)
  await statuszeile($)

  return neu
}

async function eintragen($: EngineInterface, art: Art, roh: string) {
  const text = roh.replace(/\s+/g, ' ').trim().slice(0, 200)
  if (text === '') return null
  const jetzt = await $.clock.now()
  const punkt: Punkt = { id: `${jetzt.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`, art, text, erledigt: null, seit: jetzt }
  await aendern($, alt => [...alt, punkt])

  return punkt
}

async function umschalten($: EngineInterface, id: string) {
  const jetzt = await $.clock.now()
  await aendern($, alt => alt.map(p => (p.id === id ? { ...p, erledigt: p.erledigt === null ? jetzt : null } : p)))
}

/** Findet einen offenen Punkt ueber die ID oder ein Stueck seines Textes. */
function finden(alle: Punkt[], suche: string) {
  const s = suche.trim().toLowerCase()
  if (s === '') return undefined

  return alle.find(p => p.erledigt === null && (p.id === s || p.text.toLowerCase().includes(s)))
}

async function statuszeile($: EngineInterface) {
  const alle = await read($, punkte)
  const todos = alle.filter(p => p.art === 'todo' && p.erledigt === null).length
  const antworten = alle.filter(p => p.art === 'antwort' && p.erledigt === null).length
  $.ui.status(todos + antworten === 0 ? undefined : `Dashboard: ${todos} To-dos, ${antworten} Antworten offen · /heute`)
}

function alsText(alle: Punkt[]) {
  const teil = (art: Art) => {
    const offen = alle.filter(p => p.art === art && p.erledigt === null)

    return [`${UEBERSCHRIFT[art]} (${offen.length} offen):`, ...(offen.length === 0 ? [`  ${LEER[art]}`] : offen.map(p => `  ○ ${p.text}`))]
  }

  return [...teil('todo'), ...teil('antwort')].join('\n')
}

function datum(ms: number) {
  const d = new Date(ms)
  const tage = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

  return `${tage[d.getDay()]}, ${d.getDate()}.${d.getMonth() + 1}.`
}

async function zeichnen($: EngineInterface, e: ResolveInput & { surface: string }) {
  const { Box, Text, Button } = $.ui.resolve(e)
  const elemente = $.ui.resolve(e) as Record<string, unknown>
  const mitFeld = 'Input' in elemente
  // Das Handy zeichnet noch kein Eingabefeld, dort fehlt Input in der Tabelle.
  const Input = elemente.Input as ElementConstructor<InputProps>
  const jetzt = await $.clock.now()
  const alle = await read($, punkte)

  const abschnitt = (art: Art) => {
    const offen = alle.filter(p => p.art === art && p.erledigt === null)
    const fertig = alle.filter(p => p.art === art && p.erledigt !== null && jetzt - p.erledigt < SICHTBAR_MS)

    return (
      <Box flexDirection="column" key={`abschnitt-${art}`} marginTop={1}>
        <Text>
          <Text bold>{UEBERSCHRIFT[art]}</Text>
          <Text dimColor> · {offen.length} offen</Text>
        </Text>
        {offen.length === 0 && <Text dimColor>{LEER[art]}</Text>}
        {offen.map(p => (
          <Button key={`p-${p.id}`} onPress={() => umschalten($, p.id)}>
            ○ {p.text}
          </Button>
        ))}
        {fertig.map(p => (
          <Button key={`p-${p.id}`} onPress={() => umschalten($, p.id)}>
            <Text dimColor>✓ {p.text}</Text>
          </Button>
        ))}
        {mitFeld && (
          <Input
            key={`neu-${art}`}
            placeholder={art === 'todo' ? 'Neues To-do, Enter' : 'Wem musst du antworten? Enter'}
            submitLabel="eintragen"
            onSubmit={(wert: string) => void eintragen($, art, wert)}
          />
        )}
      </Box>
    )
  }

  return (
    <Box flexDirection="column" key="dashboard">
      <Text dimColor>{datum(jetzt)}</Text>
      {abschnitt('todo')}
      {abschnitt('antwort')}
      <Box marginTop={1}>
        <Text dimColor>Abhaken per Klick. Oder sag Claude: „Trag mir ein, wem ich noch antworten muss.“</Text>
      </Box>
    </Box>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await laden($)
    await $.command.register({ name: 'heute', description: 'Dashboard mit To-dos und offenen Antworten öffnen' })
    await $.command.register({ name: 'todo', description: 'Dashboard: To-do eintragen', argumentHint: 'was zu tun ist' })
    await $.command.register({ name: 'antworten', description: 'Dashboard: Nachricht eintragen, die du noch beantworten musst', argumentHint: 'wem, worum' })
    await $.tool.register({
      name: 'eintragen',
      description:
        'Trägt etwas ins Dashboard des Nutzers ein: art "todo" für Aufgaben, art "antwort" für Nachrichten, die er noch beantworten muss (Text wie "Anna: Angebot nachfassen").',
      inputSchema: {
        type: 'object',
        properties: {
          art: { type: 'string', enum: ['todo', 'antwort'] },
          text: { type: 'string', description: 'kurz, höchstens ein Satz' },
        },
        required: ['art', 'text'],
      },
      isDeferred: false,
    })
    await $.tool.register({
      name: 'abhaken',
      description: 'Hakt einen offenen Punkt im Dashboard ab. suche ist ein Stück seines Textes.',
      inputSchema: { type: 'object', properties: { suche: { type: 'string' } }, required: ['suche'] },
      isDeferred: false,
    })
    await $.tool.register({
      name: 'lesen',
      description: 'Liest die offenen To-dos und Antworten aus dem Dashboard des Nutzers.',
      inputSchema: { type: 'object', properties: {} },
      isDeferred: false,
    })
    await statuszeile($)
    // Unaufgefordert zeichnet Claude Code das Fenster erst ab 144 Spalten Breite.
    void $.ui.open({ id: PANE, title: 'Dashboard' })

    return next(e)
  })

  on('command.run', { command: 'heute' }, async $ => {
    await laden($)
    await $.ui.open({ id: PANE, title: 'Dashboard' })

    return { text: 'Dashboard geöffnet.' }
  })

  on('command.run', { command: 'todo' }, async ($, e) => {
    const p = await eintragen($, 'todo', e.args)
    if (p === null) {
      await $.ui.open({ id: PANE, title: 'Dashboard' })

      return { text: 'Dashboard geöffnet. Eintragen: /todo was zu tun ist' }
    }

    return { text: `To-do eingetragen: ${p.text}` }
  })

  on('command.run', { command: 'antworten' }, async ($, e) => {
    const p = await eintragen($, 'antwort', e.args)
    if (p === null) return { text: alsText(await laden($)) }

    return { text: `Eingetragen: ${p.text}` }
  })

  on('tool.call', { tool: 'mcp__dashboard__eintragen' }, async ($, e) => {
    const roh = e as unknown as { art?: unknown; text?: unknown }
    const art: Art = roh.art === 'antwort' ? 'antwort' : 'todo'
    const p = await eintragen($, art, typeof roh.text === 'string' ? roh.text : '')

    return { result: p === null ? 'Kein Text, nichts eingetragen.' : `Eingetragen unter ${UEBERSCHRIFT[art]}: ${p.text}` }
  })

  on('tool.call', { tool: 'mcp__dashboard__abhaken' }, async ($, e) => {
    const suche = (e as unknown as { suche?: unknown }).suche
    const p = finden(await laden($), typeof suche === 'string' ? suche : '')
    if (p === undefined) return { result: 'Kein offener Punkt passt dazu.' }
    await umschalten($, p.id)

    return { result: `Abgehakt: ${p.text}` }
  })

  on('tool.call', { tool: 'mcp__dashboard__lesen' }, async $ => ({ result: alsText(await laden($)) }))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => zeichnen($, e))
}
