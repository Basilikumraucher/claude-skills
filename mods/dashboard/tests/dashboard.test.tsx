import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const START = 1_800_000_000_000
const PANE = {
  plugin: 'dashboard',
  component: 'Pane',
  requestId: 'dashboard',
  props: {
    title: 'Dashboard',
    isFocused: false,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

function welt(on: On) {
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('tool.register', (_$, e) => ({ value: { tool: `mcp__dashboard__${e.name}` } }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.status', () => ({ value: undefined }) as never)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
}

async function start($: Engine, on: On) {
  const uhr = mock.clock(on, { now: START })
  mock.store(on)
  welt(on)
  await $.session.start({ cwd: '/Users/t', surface: 'terminal', isInteractive: true })

  return uhr
}

test('/todo und /antworten tragen ein, das Fenster zeigt beides, auf jeder Oberfläche', async ($, on) => {
  await start($, on)
  expect((await $.command.run({ command: 'todo', args: 'Rechnung an Müller schicken' } as never)).text).toBe(
    'To-do eingetragen: Rechnung an Müller schicken',
  )
  await $.command.run({ command: 'antworten', args: 'Anna: Angebot nachfassen' } as never)

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    // Offene Punkte sind Knoepfe: ein Klick hakt sie ab.
    expect(await ui.find({ type: 'Button', text: /Rechnung an Müller/ })).toBeDefined()
    expect(await ui.find({ type: 'Button', text: /Anna: Angebot nachfassen/ })).toBeDefined()
    await ui.unmount()
  }
})

test('Klick hakt ab, abgehakt bleibt einen Tag sichtbar', async ($, on) => {
  const uhr = await start($, on)
  await $.command.run({ command: 'todo', args: 'Steuer-Unterlagen sortieren' } as never)
  const lesen = async () => String((await $.tool.call({ tool: 'mcp__dashboard__lesen' } as never)).result)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const knopf = await ui.find({ type: 'Button', text: /Steuer-Unterlagen/ })
  await ui.press({ key: String(knopf?.key) })
  expect(await lesen()).toContain('To-dos (0 offen)')
  expect(await ui.find({ type: 'Text', text: /✓ Steuer-Unterlagen/ })).toBeDefined()
  await ui.unmount()

  await uhr.advance(25 * 60 * 60_000)
  const spaeter = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await spaeter.find({ type: 'Text', text: /Steuer-Unterlagen/ })).toBeUndefined()
  await spaeter.unmount()
})

test('Eingabefeld im Fenster trägt ein', async ($, on) => {
  await start($, on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.input({ key: 'neu-antwort', text: 'Steuerberater: Termin bestätigen' })
  await ui.unmount()
  expect(String((await $.tool.call({ tool: 'mcp__dashboard__lesen' } as never)).result)).toContain('○ Steuerberater: Termin bestätigen')
})

test('Claude trägt ein und hakt ab', async ($, on) => {
  await start($, on)
  const ein = await $.tool.call({ tool: 'mcp__dashboard__eintragen', art: 'antwort', text: 'Jonas: Rückruf wegen Website' } as never)
  expect(String(ein.result)).toBe('Eingetragen unter Antworten: Jonas: Rückruf wegen Website')
  const ab = await $.tool.call({ tool: 'mcp__dashboard__abhaken', suche: 'jonas' } as never)
  expect(String(ab.result)).toBe('Abgehakt: Jonas: Rückruf wegen Website')
  expect(String((await $.tool.call({ tool: 'mcp__dashboard__lesen' } as never)).result)).toContain('Antworten (0 offen)')
})
