import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import type { TeamEintrag } from '../types'

const START = 1_800_000_000_000
const ORDNER = '/Users/t/.claude/chat-team'

// Ein zweiter Chat, der schon laeuft und die Rolle entwurf hat.
const ENTWURF: TeamEintrag = { id: 'b', rolle: 'entwurf', ordner: 'texte', status: 'wartet', aktualisiert: START }

// Die Welt unter der Mod: ein Dateisystem im Speicher, Sitzung "a", und ein
// Postfach, das festhaelt, was an andere Chats ging.
function welt(on: On) {
  const dateien = new Map<string, string>([[`${ORDNER}/b.json`, JSON.stringify(ENTWURF)]])
  const post: { to: unknown; text: string }[] = []
  on('fs.write', (_$, e) => (dateien.set(e.path, e.text), { value: undefined }))
  on('fs.read', (_$, e) => ({ value: dateien.get(e.path) ?? '' }))
  on('fs.list', (_$, e) => ({
    value: [...dateien.keys()]
      .filter(p => p.startsWith(`${e.path}/`))
      .map(p => ({ name: p.slice(e.path.length + 1), kind: 'file' as const, size: 1, mtimeMs: START, isLink: false })),
  }))
  on('session.id', () => ({ value: 'a' }))
  on('session.send', (_$, e) => (post.push({ to: e.to, text: e.text }), { isDelivered: true }) as never)
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('tool.register', (_$, e) => ({ value: { tool: `mcp__chat-team__${e.name}` } }) as never)
  on('ui.status', () => ({ value: undefined }) as never)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }) as never)
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'Du bist Claude Code.', scope: 'shared' }] }) as never)

  return { post, eigen: () => JSON.parse(dateien.get(`${ORDNER}/a.json`) ?? 'null') as TeamEintrag | null }
}

async function start($: Engine, on: On) {
  mock.clock(on, { now: START })
  mock.store(on)
  mock.env(on, { HOME: '/Users/t' })
  const w = welt(on)
  await $.session.start({ cwd: '/Users/t/projekte/kampagne', surface: 'terminal', isInteractive: true })

  return w
}

test('/rolle chef traegt den Chat ein und nennt das Team', async ($, on) => {
  const w = await start($, on)
  const antwort = await $.command.run({ command: 'rolle', args: 'Chef' } as never)
  expect(antwort.text).toContain('Dieser Chat ist jetzt chef.')
  expect(antwort.text).toContain('Im Team: entwurf')
  expect(w.eigen()?.rolle).toBe('chef')
})

test('die Rolle steht im Systemprompt, ohne Rolle nichts', async ($, on) => {
  await start($, on)
  const anfrage = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: ['terminal'], tools: [], outputStyle: null, traits: [] }
  const ohne = await $.prompt.compose(anfrage as never)
  expect(ohne.sections.map(s => s.id)).toEqual(['intro'])

  await $.command.run({ command: 'rolle', args: 'chef' } as never)
  const mit = await $.prompt.compose(anfrage as never)
  const rolle = mit.sections.find(s => s.id === 'chat-team:rolle')
  expect(rolle?.scope).toBe('session')
  expect(rolle?.text).toContain('Du bist der Chef.')
})

test('an_rolle stellt beim Chat mit der Rolle zu, mit Absender', async ($, on) => {
  const w = await start($, on)
  await $.command.run({ command: 'rolle', args: 'recherche' } as never)
  const lief = await $.tool.call({ tool: 'mcp__chat-team__an_rolle', rolle: 'Entwurf', nachricht: 'Drei Quellen zum Thema Wärmepumpe: ...' } as never)
  expect(String(lief.result)).toContain('Zugestellt an entwurf')
  // Die Engine schreibt die Adresse { sessionId } beim Senden als Text.
  expect(w.post).toEqual([{ to: 'b', text: '[Team · von recherche] Drei Quellen zum Thema Wärmepumpe: ...' }])
})

test('an_rolle ohne passenden Chat sagt, welche Rollen offen sind', async ($, on) => {
  const w = await start($, on)
  const lief = await $.tool.call({ tool: 'mcp__chat-team__an_rolle', rolle: 'chef', nachricht: 'fertig' } as never)
  expect(String(lief.result)).toBe('Kein Chat hat gerade die Rolle "chef". Offen: entwurf.')
  expect(w.post).toEqual([])
})

test('/rolle aus nimmt den Chat raus, beendete Chats zaehlen nicht', async ($, on) => {
  const w = await start($, on)
  await $.command.run({ command: 'rolle', args: 'chef' } as never)
  await $.command.run({ command: 'rolle', args: 'aus' } as never)
  expect(w.eigen()?.rolle).toBe(null)
  await $.session.end({ sessionId: 'a', reason: 'exit' } as never)
  expect(w.eigen()?.status).toBe('beendet')
})
