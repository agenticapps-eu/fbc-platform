---
reviewers: [gemini, codex]
models: [gemini-cli-0.28.2, codex-cli-0.145.0]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: 9cb81f4aa6885fd1
reviewed_at: 2026-08-23
author_vendor: claude (ausgeschlossen — ein Host prüft seinen eigenen Change nicht)
---

# Change review — add-admin-member-lifecycle (AGE-581)

Zwei Reviewer, zwei verschiedene Anbieter, beide **REQUEST-CHANGES**. Der Change
wurde daraufhin überarbeitet; die Auflösung steht unten, Befund für Befund.

Zwei Befunde wurden **empirisch nachgeprüft** statt geglaubt — beide bestätigt.

## Reviewer: gemini (gemini-cli 0.28.2)

VERDICT: REQUEST-CHANGES

- [HIGH] `specs/admin` — Das Spec-Delta hat kein Szenario für den Teilfehlschlag
  (DB gesetzt, GoTrue-Ban scheitert), obwohl `design.md` ihn benennt. Verhalten,
  Antwortcode und Anzeige sind undefiniert. — Szenario ergänzen, Antwort und
  Anzeige festschreiben.
- [LOW] `design.md` Entscheidung 1 — `is_activated()` nicht umzubenennen ist
  pragmatisch, aber ein Kommentar ist eine schwache Sicherung gegen ein
  Missverständnis des Namens. — Rename erwägen; wenn nicht, den Kommentar
  ausdrücklich warnend fassen.

## Reviewer: codex (codex-cli 0.145.0)

VERDICT: REQUEST-CHANGES

- [HIGH] `is_admin()` prüft nur `staff_roles` — ein **deaktivierter Admin**
  behält mit gültigem JWT alle Admin-Rechte und kann über die
  `SECURITY DEFINER`-Funktionen weiter lesen und schreiben.
- [HIGH] Die Lebenszyklus-RPCs liegen bei `authenticated`; ein direkter Aufruf
  umgeht die Edge Function und erzeugt einen Zustand **ohne** Ban — die zugesagte
  Doppelsperre gilt dann nicht.
- [HIGH] Der Teilfehlschlag ist nicht heilbar: der zugesagte `22023` bei
  doppeltem Deaktivieren blockiert den Wiederholungsversuch, und das Menü bietet
  danach „reaktivieren" statt „deaktivieren".
- [HIGH] „Datenbank zuerst" gilt nur fürs **Schliessen**. Beim Öffnen macht es
  das Profil sichtbar, während die Anmeldung noch gesperrt ist — und die
  Handlung verschwindet aus der Oberfläche.
- [HIGH] Löschen setzt `disabled_at` mit und **zerstört damit den Vorzustand**:
  nach dem Wiederherstellen ist nicht mehr entscheidbar, ob das Mitglied vorher
  schon deaktiviert war.
- [HIGH] Der geplante pgTAP-Test prüft nur das **Zielprofil**, nicht den
  **Aufrufer** — und der bestehende Aktivierungstest arbeitet mit
  `activated_at = null`, kann also grün bleiben, während die neue Bedingung fehlt.
- [HIGH] `create or replace function` kann den **Rückgabetyp nicht ändern**;
  `admin_list_members` und `my_activation_state` bekommen neue Spalten, die
  Migration schlägt fehl.
- [HIGH] Die `access-control`-Ausnahme sagt „genau zwei Felder" für
  `my_activation_state`, und `rls_test.sql` prüft das — der geplante
  Sperrzustand widerspricht beidem.
- [HIGH] `former_member_ids(uuid[])` kann nicht erzwingen, dass die übergebenen
  UUIDs aus sichtbaren Beiträgen stammen; jeder Angemeldete könnte beliebige
  bekannte IDs abfragen. Das widerspricht der eigenen Zusage im Delta.
- [HIGH] Die Zahlen im Proposal gehen nicht auf: 71 − 59 = **12**, nicht 11. Die
  genannte `aktive-mitglieder.tsv` liegt ausserhalb des Arbeitsbaums.
- [MEDIUM] Die Übergangstabelle ist unvollständig (nicht existierendes Ziel,
  Nebenläufigkeit, „enable" auf Gelöschtes, „restore" auf Ungelöschtes).
- [MEDIUM] Die fünf DB-Status sind **nicht** die fünf Reiter — „Mitgliedschaft"
  ist eine Darstellung, kein Status. Die Design-Aussage, `p_status` trage die
  Reiter, ist falsch.
- [MEDIUM] `payment_type` nur in die Weissliste zu setzen **speichert nichts**:
  `admin_update_profile` führt Präsenztest, INSERT-Spalten und
  `ON CONFLICT`-Zuweisung getrennt und hartkodiert.
- [MEDIUM] Handlungsmatrix für kombinierte Zustände fehlt; die Feed-Aufgaben
  decken Beitrags-, aber nicht Kommentarautoren ab.
- [LOW] Proposal und Tasks widersprechen sich, ob die **Stufe** hier änderbar ist.

## Not counted

Keiner. Beide Reviewer liefen mit `REVIEWER_TIMEOUT=1500` durch (exit 0) — der
Standardwert von 300 s reicht für codex in diesem Repo erfahrungsgemäss nicht,
und ein Timeout hätte als „nicht gezählt" gewertet werden müssen.

`claude` wurde **nicht** aufgerufen: der Change ist von Claude verfasst.

## Nachgeprüft statt geglaubt

Zwei codex-Befunde wurden gegen den laufenden lokalen Stack geprüft, bevor sie
übernommen wurden:

| Befund | Prüfung | Ergebnis |
|---|---|---|
| `is_admin()` ohne Zugangsprüfung | `pg_get_functiondef('is_admin')` | **bestätigt** — der Rumpf liest ausschliesslich `staff_roles` |
| Rückgabetyp nicht änderbar | Probefunktion mit erweiterter `returns table` | **bestätigt** — `ERROR: cannot change return type of existing function` |

Das ist der Grund, warum dieser Schritt vor dem Code steht: der zweite Befund
hätte die Migration beim ersten Lauf zerrissen.

## Resolution

### Übernommen und eingearbeitet

| # | Befund | Was geändert wurde |
|---|---|---|
| G-1 | Teilfehlschlag unspezifiziert | Anforderung um `207`, `{hidden, banned}`, Warnung und **Heilbarkeit** ergänzt; drei neue Szenarien |
| C-1 | Deaktivierter Admin | **Neue Anforderung**: `is_admin()` verlangt zusätzlich Zugangsberechtigung. Zwei Admins in PROD, beide aktiv — der Schnitt sperrt niemanden aus (geprüft) |
| C-2 | RPCs bei `authenticated` | EXECUTE der vier Lebenszyklus-Funktionen liegt bei **`service_role`**, nicht bei `authenticated`. Die Edge Function ist der einzige Eingang |
| C-3 | Teilfehlschlag nicht heilbar | zusammen mit G-1; zusätzlich: das Menü bietet „deaktivieren" weiter an, solange der Ban fehlt |
| C-4 | Reihenfolge beim Öffnen | **Getrennte Reihenfolge je Richtung**: Schliessen = DB zuerst, Öffnen = Ban zuerst. Beide Richtungen wiederholbar |
| C-5 | Löschen zerstört den Vorzustand | `admin_delete_member` fasst `disabled_at` **nicht** an; `deleted_at` gatet selbst. Wiederherstellen entbannt nur, wenn `disabled_at` null ist |
| C-6 | Test prüft nur das Ziel | Aufgabe 2.1 verlangt jetzt **beide Seiten** und ausdrücklich einen deaktivierten *Aufrufer* gegen die erbenden Policies |
| C-7 | Rückgabetyp | `drop function` + `create` für beide, mit Wiederherstellung von Grants, Kommentar und Vorgabewerten, plus neu erzeugte TS-Typen |
| C-8 | `my_activation_state` | Die `access-control`-Ausnahme wird **mitgeändert**: geschlossener Zustandsvertrag statt „genau zwei Felder" |
| C-9 | `former_member_ids` | Nimmt **Beitrags- und Kommentar-IDs** statt Profil-IDs und löst den Autor intern über das Sichtbarkeitsprädikat auf; Eingabemenge begrenzt |
| C-10 | Zahlen | Präzisiert: **12** Konten ohne Listeneintrag, davon eines das eigene → **11** zu deaktivieren. Die Zuordnungstabelle wandert als Beleg ins Repo |
| C-11 | Übergangstabelle | Vollständige Tabelle als eigene Anforderung, mit Fehlercode je Übergang |
| C-12 | Reiter ≠ Status | Abbildung ausdrücklich festgeschrieben; „Mitgliedschaft" ist ein Darstellungsmodus über `p_status = 'alle'` |
| C-13 | `payment_type` speichert nicht | Aufgabe nennt jetzt alle **vier** Stellen in `admin_update_profile` |
| C-14 | Kombinierte Zustände | Handlungsmatrix serverseitig erzwungen, Menü spiegelt sie; Feed-Test deckt Kommentarautoren mit ab |
| C-15 | Stufe änderbar? | Klargestellt: **Stufe ist hier nur lesbar**, Downgrade bleibt AGE-516 |

### Nicht übernommen

**G-2 (Rename `is_activated()` → `has_access()`).** Bleibt abgelehnt, und zwar
aus dem Grund, den `design.md` Entscheidung 1 schon nennt: der Rename berührt
rund vierzig Policies, also genau die Fläche, die dieser Change *nicht*
anfassen will. gemini hat recht, dass ein Kommentar eine schwache Sicherung ist
— deshalb der Ausgleich, den gemini selbst vorschlägt: der Funktionskommentar
wird ausdrücklich **warnend** gefasst und benennt die vollständige Bedingung.

Der Punkt bleibt als Nachfolge-Notiz stehen. Wenn die Policies aus einem anderen
Anlass ohnehin angefasst werden, ist der Rename dort billig.

### Aus den unausgesprochenen Annahmen aufgenommen

codex' Annahmenliste enthielt drei, die als Aufgabe eingetragen wurden statt als
Annahme stehenzubleiben:

- **`admin_list_members` verbindet über einen INNER JOIN auf `auth.users`** — ein
  Profil ohne Auth-Zeile fiele lautlos aus der Liste. Als Prüfung aufgenommen.
- **Was Entfernte ausserhalb von Feed und Teilnahme hinterlassen** (Nachrichten,
  Kontaktanfragen, Treffer, Angebote, Gesuche) ist nicht behandelt. Als
  ausdrücklicher Nicht-Umfang benannt, mit Nachfolge-Notiz — nicht stillschweigend
  offen gelassen.
- **Der Stichtag der `paid_until`-Rechnung** muss fest sein, nicht „heute". Ist
  er bereits (`2026-08-23`, im Skript festgeschrieben); jetzt auch in der Aufgabe.
