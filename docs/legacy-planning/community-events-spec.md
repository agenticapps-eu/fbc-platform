# Community, Events, Video & Demo — FBC Platform (Phase 1, Woche 4)

> **Für Claude Code:** Verbindliche Spezifikation für Woche 4 — Issues **AGE-250** (Community-Feed), **AGE-251** (Events), **AGE-252** (Video-Embed), **AGE-254** (Demo-Daten), **AGE-255** (Abnahme).
> Schema (`posts`, `comments`, `post_likes`, `events`, `event_registrations`) und RLS existieren aus Woche 1 — W4 **nutzt** sie. Look: **Schwarz & Gold** (`docs/design-system.md`).
> AGE-253 (Deploy auf `fbc-platform.pages.dev`) ist bereits erledigt; offen bleibt nur die Custom-Domain-Anbindung (separater Follow-up, wenn DNS verfügbar).

**Leitprinzip:** „Qualität vor Reichweite" — LinkedIn-ähnlich, ruhig, hochwertig; **nicht** Facebook-chaotisch.

---

## 1. Community-Feed (AGE-250)

Integriert in `/community` (Feed-Tab; das Verzeichnis aus W2 ist der zweite Tab, Prime+).

- **Composer:** Beitrag mit Text, optional Hashtags (`#`), Erwähnungen (`@name` → Link auf Profil), optional **Video-Embed** (W4-3) und **Sichtbarkeit** (`public`/`members`/`prime`/`legacy`) — Default `members`.
- **Feed-Liste:** chronologisch (neueste zuerst), Karten im Schwarz-&-Gold-Look mit Autor (Avatar, Name, Tier-Badge), Zeit, Body, Hashtag-Chips, Like-/Kommentar-Zähler. Respektiert `visibility` über RLS (Discover sieht nur `public`).
- **Interaktion:** Likes (`post_likes`, toggle), Kommentare (`comments`, inline aufklappbar), Hashtag-Filter.
- **Datenanbindung:** `posts`/`comments`/`post_likes` (vorhanden). `hashtags text[]` aus dem Body parsen und speichern. Erwähnungen optional auflösen.
- **Realtime** optional (neue Beiträge live) — sonst Refetch via TanStack Query.

---

## 2. Events (AGE-251)

Route `/events` (aktuell nur Platzhalter — ausbauen).

- **Liste/Kalender:** kommende & vergangene Events als Karten (Titel, Typ-Badge `online/presence/dinner/workshop/mastermind`, Datum, Ort, Host, Restplätze). `visibility`-Gating wie Feed.
- **Detailseite:** Beschreibung, Host (Profil/Partner), Zeit/Ort, Kapazität, Teilnehmerzahl, **Anmelden/Abmelden**.
- **Anmeldung:** `event_registrations` (`status` registered/waitlist/cancelled). Bei erreichter `capacity` → automatisch `waitlist`. Eigene Anmeldungen verwalten.
- **Host-Funktionen:** Event anlegen/bearbeiten (host_id = self), Teilnehmerliste einsehen, **Check-in** (`checked_in`), nach dem Event **Bewertung** (`rating` 1–5) ermöglichen.
- **„Mein Bereich"-Anbindung:** gebuchte / vergangene / eigene Events füllen die entsprechenden W2-Dashboard-Widgets mit echten Daten.

---

## 3. Video-Embed (AGE-252)

- Wiederverwendbare Komponente `VideoEmbed` (YouTube & Vimeo). **Kein eigenes Hosting.**
- URL → sichere Embed-URL parsen (nur YouTube-/Vimeo-IDs zulassen; keine beliebigen iframes/Skripte). Responsive 16:9, lazy-load.
- Einsatz: Feed-Composer/-Beiträge, Profil („Videos"), Academy.

---

## 4. Demo-Daten / Personas (AGE-254)

Ziel: ein überzeugender, in sich stimmiger Demo-Durchlauf. **Nur** für Demo/Staging, **nie** für echte Prod-Daten.

- Seed-Skript in `supabase/seed/` (ergänzend zu `demo_legacy_profile.sql`). Empfohlen als Node/TS-Skript mit **service-role** (legt `auth.users` + Profile an), ausgeführt über `infisical run -- tsx supabase/seed/demo_seed.ts`.
- **Personas** (alle klar als Demo, z. B. E-Mail `@demo.fairbusinessclub.de`):
  - 1× **Legacy** „Maximilian Bauer" (Investor/Deal Keeper) — voller Datensatz wie Mockup.
  - 3–4× **Prime** (z. B. Investorin, Unternehmensberater, KI-Gründer, Immobilien-Entwickler) mit **komplementären** offers/needs, sodass die Match-Engine echte Treffer erzeugt.
  - 2–3× **Discover** (öffentliche Profile ohne Kontaktfunktion).
- Zusätzlich: einige Feed-Beiträge (mit Hashtags/Video), 3–4 kommende Events (verschiedene Typen), Such-/Bieteprofile, daraus per `generate_matches_for` erzeugte Matches, 1 angenommener Kontakt + Beispiel-Chat.
- Ein/Aus per Flag; Skript ist idempotent (mehrfaches Laufen ohne Duplikate).

---

## 5. Finale Abnahme (AGE-255) — die 8 Akzeptanzkriterien

Gegen die Live-URL (`fbc-platform.pages.dev`) durchspielen und in `docs/foundation-acceptance.md` / `docs/w4-acceptance.md` protokollieren:

1. **Discover** sieht öffentliche Profile/Events/Feed-`public`, aber **kein** Verzeichnis, **keine** Kontaktfunktion (RLS, nicht nur UI).
2. **Prime** durchsucht das Mitgliederverzeichnis (Filter Thema/Branche/Region).
3. **Matching-Hub** schlägt Top-Matches mit Prozent-Score vor (Suche ⇄ Biete).
4. **Kontaktanfrage** senden → bestätigen → erst danach Chat + Kontaktdaten frei (vorher nichts).
5. **Feed**: Beitrag posten, kommentieren, liken; **Event** anzeigen/anmelden.
6. **Dashboard** „Mein Bereich" zeigt Matches, Kontakte, Events, Impact-/Potenzial-Score.
7. **Legacy** sieht zusätzlich strategische/Impact-Bereiche — über RLS, nicht nur UI.
8. Alles **live** auf echter Infrastruktur (EU) unter `fbc-platform.pages.dev`.

Plus: **Demo-Skript/Drehbuch** für Detlev (kurze Schritt-für-Schritt-Story, welche Persona was zeigt).

---

## 6. Definition of Done (Woche 4)

- Feed (posten/kommentieren/liken/Hashtags/Video, Sichtbarkeit) funktioniert; ruhiger Premium-Look.
- Events: Liste/Detail/Anmeldung/Warteliste/Host-Check-in/Bewertung; speist die Dashboard-Widgets.
- `VideoEmbed` (YouTube/Vimeo) sicher und responsiv, mehrfach eingesetzt.
- Demo-Seed erzeugt eine stimmige Welt (Personas, Matches, Feed, Events); idempotent; nur Demo/Staging.
- Alle 8 Akzeptanzkriterien grün; Demo-Drehbuch vorhanden.
- W4-Issues (AGE-250/251/252/254/255) in Linear auf Done; Meilenstein „W4 · Community & Demo" erledigt.
- Commits referenzieren die jeweiligen AGE-Issues.

---

_Gehört zu den Issues **AGE-250…AGE-255** im Linear-Projekt „FBC Plattform – Prototyp (Phase 1)"._
