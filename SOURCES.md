# Quellen und Aktualisieren

Die Ordner in `skills/` sind Kopien vom 03.11.2026. Für die aktuelle Version die Originalquelle benutzen.
`npx skills add <owner/repo>` installiert aus einem GitHub-Repo, `npx skills update` aktualisiert installierte Skills.
Ein Skill aus einem Sammel-Repo (`emilkowalski/skills`) wird im Installer einzeln ausgewählt.

| Skill | Quelle (GitHub) | Installieren | Herkunft der Angabe |
| --- | --- | --- | --- |
| animate, animation-performance, animation-vocabulary, apple-design, break-ui, emil-design-eng, find-animation-opportunities, improve-animations, mobile-native, remove-animations, review-animations | https://github.com/emilkowalski/skills | `npx skills add emilkowalski/skills` | `skills-lock.json` |
| animate-expo, ask-sonner | https://github.com/emilkowalski/skills | `npx skills add emilkowalski/skills` | `skills-lock.json` (vor dem Entfernen) |
| design-taste-frontend | https://github.com/Leonxlnx/taste-skill | `npx skills add Leonxlnx/taste-skill` | `skills-lock.json` |
| impeccable (Version 4.8.0) | https://github.com/pbakaus/impeccable | `npx skills add pbakaus/impeccable` | Verweis in der `SKILL.md` |
| task-observer | https://github.com/rebelytics/one-skill-to-rule-them-all | `npx skills add rebelytics/one-skill-to-rule-them-all` | Verweis in der `SKILL.md` |
| apple-liquid-glass | https://github.com/naplesblue/apple-design-skill | `npx skills add naplesblue/apple-design-skill` | von Ihnen genannt, Ordner dort geklont und gelesen |
| liquid-glass-web | https://github.com/gentpan/liquidglass (Ordner `skill/liquid-glass-web`) | `npx skills add gentpan/liquidglass` | von Ihnen genannt, Ordner dort geklont und gelesen |
| hallmark | https://github.com/nutlope/hallmark | `npx skills add nutlope/hallmark` | von Ihnen genannt |
| unslop | https://github.com/heydamir/unslop | `npx skills add heydamir/unslop` | von Ihnen genannt (Autor laut `SKILL.md`: Damir Sokolovsky) |
| ponytail | https://github.com/DietrichGebert/ponytail (Datei `skills/ponytail/SKILL.md`) | `npx skills add DietrichGebert/ponytail` | von Ihnen genannt |
| swiftui-expert-skill | https://github.com/AvdLee/SwiftUI-Agent-Skill | `npx skills add AvdLee/SwiftUI-Agent-Skill` | von Ihnen genannt (Skill ist gelöscht, Kopie liegt hier) |
| write-swift, pick-ui-library, prototype | Quelle nicht bekannt | – | keine Angabe gefunden (Skills sind gelöscht, Kopie liegt hier) |
| mobile-check, publish-artifact | eigene Skills für „Mein Haushalt“ | – | Projekt `Basilikumraucher/mein-haushalt` |

`mods/` sind eigene Erweiterungen ohne öffentliche Quelle.

Die Spalte „Installieren“ folgt dem Muster `npx skills add <owner/repo>`, das bei `hallmark` funktioniert hat. Für die übrigen Zeilen habe ich den Befehl nicht ausgeführt. Ob der Installer im jeweiligen Repo genau diese Skills anbietet, ist nicht geprüft.
