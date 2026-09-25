# Session Handoff — 2026-09-25 (AGE-905 Release-Backfill, auf PROD)

> **Scope dieser Übergabe: AGE-905.** Fremde offene Punkte stehen hier bewusst
> NICHT. Die vorige Fassung (13.09., M4 / AGE-644) steht in
> `git log -- session-handoff.md` und gehört der Sitzung, die daran arbeitet.

> ## ⚠ ZUERST
>
> **AGE-905 ist fertig und auf PROD.** PR #425 gemergt (`c388f08`),
> `migrate-prod` angewendet, `drift-gate` wieder grün, Frontend-Deploy und
> Functions ausgerollt. Linear steht auf Done, alle vier Abnahmehaken sind
> gesetzt und in einem Kommentar mit Zahlen belegt. **Es ist nichts offen.**
>
> Aufgeräumt ist ebenfalls: `.env.local` gelöscht, der vite-Prozess auf 5219
> beendet, die geliehene Adminzeile aus der lokalen `staff_roles` zurück (die
> Tabelle steht wieder bei 0, wie vorgefunden).

## Was auf PROD steht

Gemessen als **Differenz** zwischen zwei Läufen desselben Skripts, unmittelbar
vor und nach der Migration — nicht gegen absolute Zielzahlen, weil die
voraussetzten, dass dazwischen niemand schreibt:

| | 12:58 vorher | 13:00 nachher | Δ |
| --- | --- | --- | --- |
| `posts` `kind=release` | 0 | **23** | +23 |
| `notifications` | 308 | 308 | **0** |
| `push_zustellungen` | 0 | 0 | **0** |
| Geschichten mit Karte | 0/23 | **23/23** | — |

`scripts/mess-905.ts --prod=viwntbodrtqxgmqyxluh --vergleich=… --erwarte=23`
meldet fünfmal OK. Eine zweite Messung danach: unverändert.

## Entscheidungen

- **Migration mit Datensätzen statt Admin-Skript** (Donald, 25.09.): kein
  Client kann `status='sent'` schreiben, ein Skript bräuchte erst eine
  DEFINER-RPC — eine dauerhafte API-Fläche für einen einmaligen Lauf.
- **Ausgabe-Datum, minutenweise gestaffelt** (Donald, 25.09.): der Feed ordnet
  über `(veroeffentlicht_ab desc, id desc)`; gleiche Zeitstempel ordneten eine
  Ausgabe nach uuid und auf jedem Bestand anders.
- **Das Ausgabe-Datum gilt auch auf `/neues` als Datum der Mitteilung**
  (Donald, 25.09.) — obwohl `release-ausgaben.ts` seine Daten „gesetzt und
  nicht gemessen" nennt.
- **`/neues` bekommt Paging in diesem Change** (Donald, 25.09.).
- **Der Halbsatz „und wo du zur Mitgliedschaft kommst" ist gestrichen**
  (Donald, 25.09.).
- **`angekuendigt_am` wird in der Migration gestempelt, nicht im Auslöser** —
  gegen gemini's Vorschlag: der Auslöser gehört jeder künftigen Zustellung.

## Drei Befunde, die den Bau geändert haben

1. **Die erste Fassung hätte `main` rot gemacht.** Der CI-Job `migrations`
   fährt `supabase db reset` gegen eine frische Datenbank — kein `seed.sql`,
   0 Profile, 0 Admins. Ein bedingungsloses `raise exception` beim fehlenden
   Autor hätte bei jedem Lauf zugeschlagen. Jetzt zwei Lagen: 0 Profile →
   überspringen, Profile ohne Admin → abbrechen. Beide gefahren.
2. **`/neues` zeigte nur 20 von 23** und löste `?note=` allein aus der
   geladenen Liste auf — drei tote Knöpfe. Befund des Fremd-Plan-Reviews
   (codex), am Code nachgeprüft und schlimmer als gemeldet.
3. **Ein Geschichtentext war seit heute falsch**, weil AGE-907 den
   beschriebenen Weg entfernt hat — live im Tutorial seit AGE-904.

## Belege

- **Fremdreview vor der ersten Codezeile**: gemini und codex, beide
  REQUEST-CHANGES. `REVIEWS.md` nennt ausdrücklich, was die Reviewer **nicht**
  gesehen haben (Textfix und die Verschärfung des Autor-Wächters kamen danach).
- 23 pgTAP-Zusagen, in `ci.yml` eingetragen. Sie prüfen den **Mechanismus** an
  eigenen Fixtures — eine Zusage über die 23 Migrationszeilen wäre in CI leer
  wahr, weil die Migration sich dort selbst überspringt.
- **Vier Mutationen**, jede zurückgenommen und die Rücknahme per `diff` belegt.
  Dazu die zwei Riegel gegen einen fremden Entwurf **einzeln** gemessen: jeder
  allein verhindert den Schaden, erst beide entfernt richten ihn an.
- Sichtprobe im Browser: 23 Karten in Datums- und Leseordnung, Glocke ohne
  Abzeichen bei 0 Hinweisen, `/neues` 20 → „Ältere laden" → 23, Tiefenlink auf
  die älteste Mitteilung öffnet sie, ausgeloggt liest `anon` 0 Release-Zeilen.

## Folgepunkte (nicht gebaut, bewusst)

- **`release_feed_post_sync()` stempelt `angekuendigt_am` nicht.** Für die 23
  nachgetragenen Zeilen tut es die Migration; für jede künftige **echte**
  Zustellung hält die Karten weiterhin allein `kind = 'member'` in
  `beitrag_ankuendigen()` vom Nachlauf fern. Heute folgenlos — aber ein
  Wächter, der nur in eine Richtung gepinnt ist.
- **Die Release-Karte kürzt ihren Text nicht.** Bei 23 Karten zu 480–1279
  Zeichen wird die Aktivität lang. Gemessen steht die erste Release-Karte
  allerdings erst bei 9874 px (Seitenhöhe 21699, Viewport 1240) — rund acht
  Bildschirmhöhen unterhalb; oben verdrängt sie nichts.

## Wenn etwas zurückgenommen werden muss

Ein Rückweg ist kein `down`-Skript, sondern ein `delete` über die 23 Slugs;
`posts_release_note_id_fkey` trägt `on delete cascade` und nimmt die Karten
mit. Das Rezept steht im Kopf von
`supabase/migrations/20260925120000_release_backfill.sql`.
