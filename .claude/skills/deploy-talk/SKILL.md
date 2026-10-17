---
name: deploy-talk
description: Publish a Keystone deck as a read-only talk, into a website's public folder or as a standalone static folder. Use when the user asks to deploy, publish or export a deck or talk, put a talk on the site, or update a published talk.
---

# Deploy a talk

Keystone publishes one deck at a time with `tools/deploy.mjs` into the website's talk format; `public/reader/` is the
reader the visitor uses. Format, paths and allowlist: Keystone `CLAUDE.md`, "Publishing", and the script's header.

## 1. Before deploying

1. **Settings.** Read the deck's `deck.json`. It needs a `publish` block:
   ```json
   "publish": { "slug": "deferred", "title": "Deferred rendering, step by step", "description": "…", "author": "Jane Doe",
                "event": "", "date": "", "sourceLang": "fr", "languages": ["en", "fr"],
                "first": "anatomie-frame", "skip": ["demo-unreal"], "cover": "anatomie-frame", "requires": "webgl" }
   ```
   Optional `"listed": false`: published, but kept out of `talks/index.json` and of links from other talks.
   Links to other decks (`deck:<id>#<n>`) are kept only to published, listed decks; the deploy prints each removed
   link and each link to a talk not deployed in that folder yet: tell the user (deploy the target deck too).
   If it is missing or incomplete, ask the user for `slug`, `title`, `description`, `languages` and `cover`.
   Never write the public text (title, description) yourself without their approval. Public text is in
   the brand tone (`library/brand.md`: no banned words).
2. **Slides.** List the slides in the published range (`first` onwards, less `skip`):
   - no `slide.html` → skipped by the deploy: tell the user;
   - `status: "todo"` in `brief.json` → the brief changed after styling: tell the user;
   - a published language with no `slide.<lang>.json` → that language shows the source slide: tell the user;
   - “Translation outdated” in the presenter overview (the deploy prints `slide.<lang>.json is outdated`) → parts
     of that slide show in the source language: tell the user.
   Let the user decide whether to fix first or deploy anyway.
3. **Layout.** With the deck served, `npm run shots` (and `DECK_LANG=en npm run shots` for English) and look at the
   screenshots, as for any slide change (PowerShell: `$env:DECK_LANG="en"; npm run shots`).

## 2. Deploy

- Website: `node tools/deploy.mjs <deck> --out <the website's public folder> [--url <site address>]` (a
  `CLAUDE.md` of `decks/` can name the folder and the address of your own site).
- Standalone: `node tools/deploy.mjs <deck> --out <empty folder>`. Any static server at that folder's root runs it.
- Test first when unsure: deploy into the scratchpad, check it (step 3), then deploy to the real target.

Read the output: `skipped`, `missing:` (a referenced file does not exist) and `no slide.<lang>.json` / `outdated` lines are all
worth reporting. `missing:` is a real problem: the slide will show a broken image or a failed script.

## 3. Check

```
node .claude/skills/deploy-talk/check.mjs <out folder> <slug> <scratchpad>/check-<slug>
```

It opens the talk as a visitor (every language, every slide, the end card, one phone view) and prints JS errors and
failed requests. Exit 1 = problems. Then look at a sample of the screenshots: the first slide, a 3D or animated
slide, the end card, the phone view. Report what you saw, not only the exit code.

## 4. Website follow-up (ask before each step: they are outward-facing)

- The deploy writes `talks/index.json` (every talk deployed there): the website's talk list can read it.
- Commit and deploy the website only when the user asks.

## Notes

- Re-deploying a talk replaces `talks/<slug>/` entirely and updates its entry in `talks/index.json`.
  `talks/_shared/` is only added to, never cleared, because other talks use it.
- The site name and the reader links that belong to the host (home, talk list, contact, follow links) are in
  `public/reader/site.json` (yours: `decks/public/reader/site.json`).
- PNG images become lossy WebP (quality .9) because Chrome cannot write lossless WebP; check diagram sharpness.
