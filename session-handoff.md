# Session Handoff — 2026-09-29 (AGE-927 Mitglied anlegen)

> **Scope dieser Übergabe: AGE-927.** Fremde offene Punkte stehen hier bewusst
> NICHT. AGE-903 ist abgeschlossen und auf PROD ausgeliefert.

> ## ⚠ ZUERST
>
> `cd /Users/donald/worktrees/fbc-platform/mitglied-anlegen`
>
> **Fünf Commits, NICHT gepusht, Arbeitsbaum sauber.** Branch `mitglied-anlegen`,
> bewusst **ohne Kürzel** — AGE-927 gehört nur in den Titel des letzten PR.
>
> **Was fehlt, ist genau §5 der `tasks.md`: das Frontend.** Alles davor ist
> gebaut und belegt. Erste Handlung: `openspec/changes/mitglied-anlegen/tasks.md`
> lesen, dort §5.
>
> **Der lokale Stack muss laufen** (`supabase start`), und er trägt beide
> Migrationen schon.

## Accomplished

| Lauf | Ergebnis |
|---|---|
| pgTAP (CI-Liste, nicht `supabase test db` nackt) | **41 Dateien, 1422 Zusagen**, PASS |
| Deno (CI-Zeile, siehe Fallen unten) | **288 Zusagen**, 0 gescheitert |
| `deno check supabase/functions/*/*.ts` | sauber |
| Wächter-Skripte (`pnpm vitest run scripts/`) | 33 Dateien, 489 Zusagen |
| `openspec validate --all` | 36/0 |

**Gebaut:** die Migration `20260928140000_aufnahmestrecke.sql` (aus `offen`
werden `angelegt` und `eingeladen`), `20260929090000_adresse_nachschlagen.sql`
(zwei eng gewährte Funktionen), beide Edge Functions samt reiner Logikmodule
und Deno-Tests, und `supabase/tests/admin_einladungsstand_test.sql` (30 Zusagen).

**Plan-Review:** zwei gezählte Runden, beide REQUEST-CHANGES, alles aufgelöst
und in `REVIEWS.md` protokolliert.

## Decisions

**Der Einladungsstand wird ABGELEITET, nicht gespeichert.** Keine Spalte, kein
Flag, kein Trigger. *Warum:* die Wahrheit steht in `activation_tokens`; eine
zweite Ablage liefe auseinander, sobald irgendein Weg ein Token erzeugt, ohne
die Kopie zu berühren.

**`member_state_matches` bekommt den Zeitpunkt als fünftes ARGUMENT**, statt
selbst zu lesen. *Warum:* so bleibt sie `immutable` und der Planer zieht sie in
den Filter; läse sie selbst, wäre sie `stable` und liefe je Zeile als Blackbox.

**`offen` bleibt**, ohne Filter auf der Fläche. *Warum:* Lesezeichen tragen es,
und die Summenzusage `angelegt + eingeladen = offen` braucht es, um prüfbar zu
sein.

**Eigener Endpunkt `admin-invite-members`** statt einer Frontend-Schleife über
`send-activation` (Donald, 28.09.). *Warum:* jene antwortet auf **jedem** Pfad
mit `202 {accepted: true}`, damit ihre Antwortzeit nicht verrät, ob eine Adresse
besteht — über sie ist kein wahrheitsgemässer Bericht herstellbar. Der
Aufzählungsschutz entfällt gegenüber einem Admin; die Schutzriegel entfallen
nicht, sie liegen in `issue_activation_token`.

**Kein „alle auf dieser Seite auswählen"** (ADR-0007). *Warum:* ein Kopfkästchen
über Schritt ① wäre mit **einem** Klick deckungsgleich mit „alle 35 einladen" —
der Alternative, die der Record verwirft. Befund des Plan-Reviews.

**Die Mehrfachauswahl öffnet den AGE-304-Zaun eng** — ausschliesslich für den
bestehenden Aktivierungslink. **ADR-0007**, mit der Folge, dass der Zaun dünner
wird.

## Files modified

* `supabase/migrations/20260928140000_aufnahmestrecke.sql` — `drop`+`create` von
  `member_state_matches` (5 Argumente) und `admin_list_members` (`eingeladen_am`),
  `create or replace` von `admin_member_counts`.
* `supabase/migrations/20260929090000_adresse_nachschlagen.sql` —
  `admin_adresse_nachschlagen` und `admin_mitglied_einrichten`, **nur an
  `service_role` gewährt**.
* `supabase/functions/admin-create-member/{anlegen.ts,anlegen.test.ts,index.ts}`
* `supabase/functions/admin-invite-members/{einladung.ts,einladung.test.ts,index.ts}`
* `supabase/tests/admin_einladungsstand_test.sql` — neu, 30 Zusagen.
* `supabase/tests/admin_member_list_test.sql` — vier Zusagen **benannt** gekippt,
  eine dazu (`angelegt + eingeladen = offen`).
* `supabase/config.toml`, `.github/workflows/ci.yml`,
  `docs/decisions/0007-…md`, `openspec/changes/mitglied-anlegen/*`.
* **`send-activation` ist unangetastet** — das ist eine Zusage, keine Beobachtung.

## Next session: start here

**§5 der `tasks.md`.** Die Reihenfolge dort ist gemeint: RED zuerst.

1. `src/lib/database.types.ts` von Hand nachziehen — **kein `gen types`**, die
   Datei trägt handgepflegte Verengungen. Sie liegt unter `src/lib/`, nicht
   `src/types/`.
2. Aufnahmestrecke ①→②→③ über der bestehenden Reiterleiste; genau einer von
   sieben Filtern gewählt, der Wert steht in der Adresse. `?tab=offen` fällt auf
   ① mit einmaligem Hinweis.
3. „+"-Knopf und Maske; Plan nur DISCOVER · FOCUS · IMPACT.
4. Kontrollkästchen je Zeile, **kein** Kopfkästchen, „Ausgewählte einladen" nur
   in ① und ②.
5. Der Bericht: fünf Ausgänge getrennt, Übersprungene namentlich, bleibt stehen.
   Vorher Rückfrage mit der **Zahl**, währenddessen Fortschritt als Zahl, die
   Liste bewegt sich erst danach und behält Filter, Suche und Seite.

Danach: Code-Review auf den Diff, Sichtprobe, PR.

## Fallen, die diese Sitzung gekostet haben

* **`deno test` ohne `--allow-read=supabase/functions`** lässt vier
  Verdrahtungstests fallen, die `index.ts` lesen. Sie sehen wie Vorbestand aus
  — sie fallen auch auf einem unveränderten Baum. Immer die CI-Zeile fahren:
  `deno test --frozen --allow-env --allow-net --allow-read=supabase/functions supabase/functions/`
* **`supabase test db` ohne Argument** zieht die manuellen `probe_*.sql` ein,
  die absichtlich keinen `plan()` haben → „Bad plan". CI fährt die Liste aus
  `ci.yml`; das Skript dafür liegt im Scratchpad.
* **Ein `drop function` nimmt den `revoke` mit.** Beim ersten Anlauf für
  `admin_list_members` nur den `grant` wiederhergestellt — `anon` hätte die
  Mitgliederliste aufrufen dürfen. Der Bestandstest hat es gefangen.
* **Die Migration ist nach dem ersten Lauf nicht wiederverwendbar** (der `drop`
  nennt die alte Signatur). Zum Wiederholen erst die neuen Signaturen von Hand
  abwerfen.
* **Hausstil für Deno-Tests ist `jsr:@std/assert@1`**, nicht `deno.land/std` —
  sonst wächst `deno.lock` und CI fährt `--frozen`.
* **`ls` ist ein eza-Alias**, `ls <pfad>` bricht ab. `find` nehmen.

## Zustand der Umgebung

* **Lokaler Stack läuft**, 137 von 138 Migrationen plus meinen beiden.
  `20260925120000_release_backfill.sql` (AGE-905) fehlt und bricht lokal ab —
  **fremde Migration, nicht anfassen**, aber einrechnen.
* Im **Haupt-Checkout** liegt fremde ungesicherte Arbeit (AGE-907).
  **Nicht anfassen.** Sie bringt den `sync-main`-Hook von `wt switch` zum
  Scheitern; der Weg daran vorbei ist
  `wt switch --create <name> --base origin/main --no-hooks --no-cd`.
* Der Worktree `stufen-v5` (AGE-903, gemergt) steht noch und kann mit
  `wt remove` weg — nicht freigegeben, deshalb blieb er.

## Open questions

* **Was gilt, wenn das Konto entsteht und `admin_mitglied_einrichten` scheitert?**
  Entschieden und gebaut: Konto bleibt, Antwort sagt `teilweise`, es steht auf
  der Vorgabestufe in ①. Offen ist nur, ob die Oberfläche das deutlich genug
  zeigt — das entscheidet sich in §5.
* **Das Rennen bei verschieden geschriebenen Adressen** bleibt offen. Es zu
  schliessen hiesse, einen Unique-Index über `lower(email)` in `auth.users`
  anzulegen, also in fremdes Schema zu schreiben. Eigene Entscheidung.
* **`admin_list_members` liefert `eingeladen_am` je Zeile** — bei 78 Profilen
  bezahlbar, der Index passt. Wenn die Liste je gross wird, ist der Umbau auf
  eine gepflegte Spalte eine eigene Änderung, dann mit Trigger.
