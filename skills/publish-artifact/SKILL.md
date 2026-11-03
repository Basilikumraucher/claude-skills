---
name: publish-artifact
description: Commit, push and publish the household app to its Claude artifact, only the files that changed. Use when the user says to publish, release or ship the household app.
disable-model-invocation: true
---

# Publish the household app

The app is published as a private Claude artifact: https://claude.ai/artifact/5zRNc3UT7YfKW75pBjmmWc
This sends content out of the repo, so **ask for a clear yes before the publish step**, every time.

## Steps

1. **Look at what changed.** `git status -sb` and `git diff --stat`. If nothing changed, say so and stop.
2. **Check the phone layout** if CSS, layout or `index.html` changed: run the `mobile-check` skill. Do not publish with a FAIL.
3. **Syntax.** `node --check` on every changed `.mjs`. The hooks do this on edit, but files written by scripts bypass them.
4. **Commit** only the intended files with a short message in English and the trailer from the session's attribution reminder:
   `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Never `--no-verify`, never amend a pushed commit, never force-push.
5. **Push** to `origin main`. If GitHub rejects the push over the private e-mail address, stop and tell the user; do not rewrite history on your own.
6. **Ask** whether to publish, naming the files and what they change.
7. **Publish** with the Artifact tool:
   - `url`: the artifact URL above, `file_path`: the absolute path of `index.html`, `root`: the project folder.
   - `files`: a map `{"path": "path"}` of every changed file that the page serves, found with `git diff --name-only artifact-latest..HEAD`.
   - Leave `capabilities` out. It carries the database rules; changing it can lock the owner out of the data.
   - Never publish `seed.json` changes without asking: it holds the real household data.
   - Do not publish: `.claude/`, `tools/`, `CLAUDE.md`, `.mcp.json`, `README.md`.
8. **Move the marker:** `git tag -f artifact-latest` (local only, do not push the tag).
9. **Report** the new version number and the link. Say that the page itself was not opened, because the artifact needs the owner's Claude login.

## If something looks wrong
- A rejected publish usually means the artifact changed elsewhere: read it with the Artifact tool, merge, publish again. Never use `force`.
- The service worker (`sw.js`) is not active inside the artifact. Do not rely on it for testing.
