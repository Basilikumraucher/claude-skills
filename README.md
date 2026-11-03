# Claude Skills

Meine Claude-Code-Skills an einem Ort, zum Mitnehmen in Projekte.

## Benutzen

Skill in ein Projekt kopieren (gilt nur dort):

```bash
cp -r skills/<name> <projekt>/.claude/skills/
```

Oder für alle Projekte (global):

```bash
cp -r skills/<name> ~/.claude/skills/
```

Alle auf einmal global: `cp -r skills/* ~/.claude/skills/`

## Inhalt

**skills/**: 27 Skills, je ein Ordner mit `SKILL.md`.

| Gruppe | Skills |
| --- | --- |
| Projekt „Mein Haushalt“ | `mobile-check`, `publish-artifact` |
| Glas und Apple-Look | `apple-liquid-glass`, `liquid-glass-web`, `apple-design` |
| Design und Qualität | `impeccable`, `design-taste-frontend`, `unslop`, `emil-design-eng`, `break-ui`, `mobile-native`, `hallmark` |
| Bewegung | `animate`, `animation-performance`, `animation-vocabulary`, `find-animation-opportunities`, `improve-animations`, `remove-animations`, `review-animations` |
| Arbeitsweise | `ponytail`, `task-observer` |
| Swift, Expo, Bibliotheken | `swiftui-expert-skill`, `write-swift`, `animate-expo`, `ask-sonner`, `pick-ui-library`, `prototype` |

**mods/**: 5 eigene Claude-Erweiterungen (Plugins mit Hooks, keine Skills): `cache-anzeige`, `chat-anzeige`, `chat-team`, `dashboard`, `modell-sparen`.

## Quellen und Aktualisieren

Herkunft, GitHub-Links und 
px-Befehle je Skill: siehe [SOURCES.md](SOURCES.md).

## Hinweise

- `impeccable` bringt seine Programmdatei (`scripts/bin/windows-x64/impeccable.exe`, 20 MB) selbst mit. Sie ist hier bewusst nicht enthalten. Beim Installieren über das Plugin wird sie mitgeliefert.
- Einige Skills stammen von anderen Autoren und stehen unter deren Lizenz (siehe Ordner), zum Beispiel `apple-liquid-glass` (naplesblue/apple-design-skill), `liquid-glass-web` (gentpan/liquidglass) und `hallmark` (nutlope/hallmark). Das Repo ist deshalb privat.
- Skills können Skripte enthalten. Vor dem Einsatz in einem fremden Projekt die `SKILL.md` lesen.

