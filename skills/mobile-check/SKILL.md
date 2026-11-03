---
name: mobile-check
description: Measure the household app on a phone-sized screen with and without safe-area insets (no sideways scroll, text at least 12px, touch targets at least 44px, space under the dock). Use after any CSS, layout or index.html change, and before publishing.
---

# Phone layout check

The app is mostly used on a phone, inside the Claude viewer or as a home-screen shortcut. The page there gets **no** home-indicator inset (`env(safe-area-inset-bottom)` is 0 in the viewer), so bottom elements must keep their own clearance. This check covers both cases.

## Run

```bash
node tools/mobile-check.mjs
```

It needs Node 22+ and Edge or Chrome, starts its own local server (`tools/dev-server.mjs`) and a headless browser, and installs nothing. It takes about a minute.

It opens all 13 views at 390x844 in two setups and checks:

| Check | Limit |
|---|---|
| Page width | no sideways scroll |
| Exactly one `h1` per view | 1 |
| Text size | nothing under 12px |
| Touch targets | buttons, links, inputs at least 44px (calendar days, switches, status chips and info buttons are exempt) |
| Dock | at least 30px above the screen bottom |
| Page end | at least 24px between the footer and the dock |
| Top bar | 60px plus the status-bar inset |
| Entry sheet | last button at least 30px above the bottom |

Exit code 1 means at least one FAIL, each listed with the view.

## Fixing

- Put new rules at the **end** of `finance.css` inside the right media query. `glisse/controls.css` often uses `!important`; override with `html body ...` and `!important` only where needed.
- Bottom spacing uses `var(--safe-bottom)` (at least 30px, or the real inset when larger). Do not use `env(safe-area-inset-bottom)` alone.
- Run again until it prints "Alles in Ordnung".

## Not covered
The check does not judge looks, glass refraction or the real keyboard. For those, look at screenshots from the in-app browser or ask the user for a phone screenshot.
