# Session Handoff — 2026-08-24 (fünfzehnte Sitzung)

**Die Live-Seite liest seit heute PROD.** Dazu AGE-581 Abschnitt 10 gebaut,
Abnahme 11.1–11.4 belegt, Branch gepusht (**PR #201**), und AGE-582 für den
Aktivitäts-Ausbau angelegt. 62 von 76 Aufgaben. 1425 Vitest, 601 pgTAP.

## Accomplished

**Umschaltung PROD-UI → PROD-DB, vollzogen und belegt.** Zwei Werte in Infisical
`prod` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) auf
`viwntbodrtqxgmqyxluh`, dann `gh run rerun 32645682952`. Alle vier Jobs grün,
**`drift-gate` inklusive** — es misst jetzt PROD und fand keine Abweichung.

**Abschnitt 10 — „Ehemaliges Mitglied".** Entfernte Urheber im Feed ohne Name,
Bild und Verweis, unterscheidbar von „Ein Mitglied". Über `former_member_entries`
mit Beitrags- und Kommentar-IDs, in Blöcken zu 200.

**Abnahme 11.1–11.4.** 601 pgTAP (sechs Dateien), `openspec validate --all`
31/31, Lint/Typecheck/Test/Build grün, `grants_test.sql` ohne Nachziehen grün.

**AGE-582 angelegt** — Aktivität auf Konzeptstand plus Icon-/Farbkanon.

## Decisions

- **Der Code folgt dem Delta, nicht umgekehrt** (Donald). Der Rückfall in
  `authorOf` heisst jetzt „Ein Mitglied" statt „Mitglied". *Warum:* er trifft
  jemanden, der da ist und sich nur zurückgezogen hat — denselben Sachverhalt,
  den `displayAuthor` ausgeloggt schon so nennt. Der Rest des Hauses behält
  `?? "Mitglied"`; die Unterscheidung wird nur im Feed gebraucht.
- **Der Text steht im Lesepfad, das Maskieren in `displayAuthor`.** *Warum:* die
  Karte hängt Verweis, Bild und Stufenplakette schon an `masked` auf — 10.3 fällt
  damit von selbst. Zwei Stellen mit derselben Zeichenkette laufen auseinander.
- **Bei der Umschaltung nur das Projekt gewechselt, nicht die Schlüsselform.**
  PROD bietet auch `sb_publishable_…` an; genommen wurde der klassische anon-JWT,
  den beide Umgebungen tragen. *Warum:* zwei Änderungen gleichzeitig machen einen
  Fehler ununterscheidbar von seinem Nachbarn.
- **`database.types.ts` von Hand ergänzt statt neu erzeugt.** *Warum:* die volle
  Neugenerierung ergab 3659 Zeilen Formatierungsdiff und verlor den
  `__InternalSupabase`-Block — die lokale CLI ist älter als die, mit der die
  Datei entstand. Die Nachbarn sind ebenfalls handgepflegt.
- **AGE-582 statt Anbau an AGE-581** (Donald), Umfragen **drin**. *Warum:* von
  fünf Punkten ist genau einer reines Layout; „Speichern" und die Zähler brauchen
  Tabellen und RPCs, Umfragen existieren im Datenmodell gar nicht.

## Files modified

- `src/lib/feed.ts` — `former` am `FeedAuthor`, Rückfall umbenannt,
  `fetchFormerEntries` (blockweise), beide Lesepfade verdrahtet
- `src/lib/displayAuthor.ts` — entfernte Urheber tragen `masked`
- `src/lib/database.types.ts` — `former_member_entries` von Hand ergänzt
- `src/lib/feed.former-member.test.ts` — **neu**, 6 Zusagen
- `src/components/community/CommunityFeed.test.tsx` — Komponententest für 10.3
- `src/lib/anon-anreicherung.test.ts` — Rückfall-Zusage nachgezogen
- `openspec/changes/add-admin-member-lifecycle/tasks.md` — 10.1–10.5, 11.1–11.4
- **Ausserhalb des Repos:** Infisical `prod` (zwei Werte), zwei Memory-Dateien

## Next session: start here

**Erste Handlung: `gh pr checks 201` und die vier Pflichtchecks auf der
HEAD-SHA ansehen** — nicht `gh run list`, das zeigt grün für alte SHAs.

Danach **11.5**, der Diff-Review durch einen anderen Anbieter als den, der ihn
geschrieben hat. Der Diff ist gross: **52 Dateien, 9064 Zeilen**. Codex braucht
dafür deutlich mehr als die Standard-300 s (Exit 4 heisst „nicht gezählt"), also
Zeitlimit hochsetzen. Danach 11.6, die Sichtprobe der gesamten Fläche.

**Vor dem Merge von #201 unbedingt lesen:** der PR bringt **sechs Migrationen**.
`migrate-dev` wendet sie auf DEV an — **PROD braucht `migrate-prod`**, und seit
heute misst `drift-gate` PROD. Ohne den Lauf blockiert es **jeden** weiteren
Deploy, auch einen eiligen Fix. Der erste Merge zahlt. Ausserdem ist
`admin-set-member-ban` eine **neue** Edge Function; der `functions`-Job liefert
sie an beide Projekte, aber nur, wenn der Lauf nicht übersprungen wird.

Der lokale Stack läuft, Vite auf `http://localhost:5173`. Lokal liegen
Sichtprobe-Beiträge (`11111111-…`) und -Kommentare (`22222222-…`) für alle vier
Autorenfälle; sie sind für 11.6 nützlich. pgTAP **immer mit Dateiliste**.
**Nie `pnpm format`.**

## Open questions

- **`app.fairbusinessclub.de` hat KEINEN DNS-Eintrag.** Die Adresse steht in der
  Auth-Freigabeliste von PROD auf Vorrat, ist aber nicht erreichbar (HTTP 000).
  Wer den Club unter diesem Namen erwartet, braucht DNS **und** die Custom
  Domain in Cloudflare Pages. Go-Live-Punkt, kein Umschaltfehler.
- **69 von 71 Mitgliedern auf PROD sind nicht aktiviert.** Nur Donald und Detlev
  sind bestätigt und haben sich je angemeldet — beide `impact`, beide Admin. Die
  übrigen 69 kommen erst über den Aktivierungsversand hinein.
- **PROD verlangt E-Mail-Bestätigung, DEV nicht** (`mailer_autoconfirm` False vs
  True). Für die 71 importierten Konten folgenlos, sie sind alle bestätigt; es
  trifft nur Neuanmeldungen — und für die ist **kein eigener SMTP** gesetzt, die
  Bestätigungsmail liefe über Supabases Standardversand samt dessen Drosselung.
- **Die Trennung der Function-Secrets bleibt ungemessen.** Der PAT darf
  `/v1/projects/<ref>/secrets` nicht lesen (403). Der frühere Befund — nur 3 von
  15 getrennt, Stripe und Resend byte-identisch — ist damit weder bestätigt noch
  widerlegt. Seit die Seite gegen PROD läuft, ist er teurer geworden.
- **Auf PROD liegen bereits 4 Beiträge, 1 Kommentar, 1 Event** — echter Inhalt
  (Sommerfest-Impressionen, „Frankfurt immer eine Reise wert"), kein Testmüll.
  Das **Onlinetreffen ist am 25.08.**, also morgen.
- **„EM" als Initialen.** Der zurückgezogene Autor bekommt jetzt „EM" im
  Bildkreis statt „M" — Nebeneffekt der Umbenennung, liest sich wie die Initialen
  einer Person. Nicht angefasst, liegt ausserhalb von Abschnitt 10.
- **Dreimal in dieser Sitzung** hat ein deutsches Schlusszeichen `“` in einem
  Python- oder JS-String die Zeichenkette beendet. Bei skriptgestützten
  Ersetzungen mit deutschen Anführungszeichen zeilenweise arbeiten.
- Unverändert offen: 7.5 stimmt nur zur Hälfte · kein Nachsetz-Weg für eine
  gelöschte Zeile ohne Ban · `grund` ohne Aufrufer · `admin_audit.actor` ohne
  `on delete cascade` · Abweichungen 4.5 und 9.3 begründet, nicht abgenommen ·
  Downgrade (AGE-516) · `admin_list_feedback()` ohne Paging.
