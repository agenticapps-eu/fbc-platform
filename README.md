# fbc-platform

Plattform des **Fair Business Club (FBC)** — soziales Business-Netzwerk für Unternehmer, Experten und Investoren mit intelligentem Matching (Suche ⇄ Biete).

Teil der **factiv**-Familie (siehe `~/Sourcecode/factiv`).

## Status

Phase 0 — Requirements & Design. Vor dem Prototyp-Build (Phase 1) klären wir Umfang, Annahmen und Designrichtung.

## Inhalt

- **`docs/`** — Requirements- & Design-Fragebogen für Detlev, gehostet als **GitHub Page**.
  Live: `https://agenticapps-eu.github.io/fbc-platform/`
  Rücklauf der Antworten über Formspree (Endpoint in `docs/index.html` → `FORMSPREE_ENDPOINT`).

## Roadmap

| Phase | Inhalt | Dauer |
|---|---|---|
| 1 · Prototyp | Profil, Matching-Hub, Feed/Events, gestaffelte Zugänge | ~1 Monat |
| 2 · Launch Stuttgart | Stripe-Abos, volle Rechte, Academy/Library, DSGVO, Migration | ~1 Monat |
| 3 · Skalierung | Multi-City, Mobile, tieferes Matching | laufend |

## Geplanter Stack

React + Vite · Supabase (Auth/DB/RLS/Realtime/Storage) · Stripe (ab Phase 2) · Cloudflare Pages · Video-Embed (YouTube/Vimeo). EU-Hosting (Frankfurt).
