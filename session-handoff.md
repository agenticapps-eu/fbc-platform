# Session Handoff — 2026-08-24 (siebzehnte Sitzung)

**Abschnitt 12 ist durch: die Datenpflege steht auf PROD und ist unabhängig
abgenommen.** 12.0 bis 12.7 alle erledigt, 76 von 76 Aufgaben. PR #202 gemergt
(`9d7b09f`, squash). Kein Deploy nötig — nur Skripte und Belege. 1457 Vitest.

**Dabei ist mir ein Fehler unterlaufen, der auf PROD gewirkt hat.** Er ist
behoben und die Invariante hergestellt; die Lehre steht in der Auto-Memory unter
`schluessel-den-ein-spaeterer-schritt-aendert`.

## Accomplished

**12.7, erste Hälfte — der Trockenlauf, und er hat sofort geliefert.**
`scripts/probe-age581-datenpflege-trockenlauf.ts` fand: **zwei
Übersichtszeilen trafen dasselbe Konto.** Eine Partner-Zeile trägt die
Firmenadresse einer anderen Person, und zwar über den *stärksten*
Zuordnungsweg. Ungeprüft hätte 12.1 zwei Jahrestage in dieselbe Zeile
geschrieben und 12.5 hätte das richtige Konto deaktiviert. Der Beleg vom 23.08.
beschrieb den Fall in Prosa, meldete aber trotzdem 59 Treffer, die der Rechenweg
nicht hergab (58).

**Der Durchgang auf PROD.** 60 `payment_type` · 57 `paid_until` (3 bewusst
leer) · 12 Anmeldeadressen angeglichen, 3 ausgenommen · 11 Konten ohne
Listeneintrag deaktiviert · ein Nachzügler angelegt und geschlossen. **72
Profile.** Keine Post an Mitglieder (`email_confirm: true`).

**DER FEHLER: 12.4 hat 12.5 vergiftet.** Die feste Zuordnung hing an der
**Anmeldeadresse** — und 12.4 gleicht Anmeldeadressen an. Danach zeigte der
Schlüssel ins Leere, die Zeile galt als „ohne Konto", **12.5 deaktivierte ein
Mitglied, das auf der Liste steht**, und 12.6 versuchte es ein zweites Mal
anzulegen. Nur GoTrues „already registered" verhinderte das Zweitkonto — Zufall,
kein Entwurf. Die Doppelbelegungs-Sperre schwieg zu Recht: aus der
Doppelbelegung war eine **Nicht**-Belegung geworden, und der Trockenlauf prüft
den Zustand VOR 12.4, nicht den ZWISCHEN den Schritten.

**Behoben mit zwei Bedingungen statt einer Reparatur.** Schlüssel ist jetzt
`profiles.id`; ein Test stellt die Reihenfolge nach (dieselbe Zeile vor und nach
der Angleichung) und ist gegen den alten Entwurf **rot** — belegt. Dazu der
Schritt `heilen`: *wer auf der Liste steht, ist offen*, idempotent.

**Abnahme mit einem ZWEITEN Lauf**
(`scripts/probe-age581-datenpflege-abnahme.ts`), der die Quelldatei nicht kennt.
Der Zähler im Schreibskript hatte alle sieben Kennzahlen ✓ gemeldet, während die
Zuordnung kaputt war. **22 Zusagen grün**, darunter drei Invarianten statt
Zählungen: kein Datum vor dem Stichtag, Verteilung je Kategorie einzeln,
Doppelsperre in **beide** Richtungen.

## Decisions

- **Der Schlüssel einer Hand-Zuordnung ist die Kennung, nie eine Adresse.**
  *Warum:* ein Schlüssel, den ein späterer Schritt desselben Durchgangs
  verändert, ist keiner. Genau das kostete ein Mitglied den Zugang.
- **Die Abnahme braucht ein zweites Werkzeug ohne die Quelldatei.** *Warum:* der
  Zähler im Schreibskript teilt Rechenkern und Quelle mit dem Schreiber und
  meldet einen gemeinsamen Fehler als Erfolg.
- **Invarianten statt Summen prüfen.** *Warum:* „60 gesetzt" stimmte auch mit
  den falschen sechzig; die Verteilung je Kategorie nicht.
- **`heilen` stellt die Invariante her, nicht den Einzelfall.** *Warum:* eine
  Reparatur gilt einmal, eine Invariante bei jedem Lauf.
- **12.1/12.2 über `admin_update_profile`, nicht per direktem UPDATE.** *Warum:*
  die RPC pflegt `payment_type` an allen vier Stellen und hinterlässt die
  `admin_audit`-Spur. Die trägt jetzt auch den Fehler: 13 × `disable_member`,
  1 × `enable_member`.
- **Admin-Token per `generateLink` + sofortiges Einlösen.** *Warum:* kein
  Passwort nötig, kein Versand; `service_role` trägt kein `sub` und liefe in 401.
- **`29.02.` bekommt grundsätzlich eine Meldung statt eines Ergebnisses.**
  *Warum:* sonst hinge die Antwort am Jahr des Stichtags.

**Zu AGE-582 (Aktivität auf Konzeptstand), Donald am 24.08. — beide bisher
offenen Fragen entschieden, damit gebaut werden kann:**

- **Tags-Filter: ODER.** Mehrere angehakte Tags zeigen Beiträge, die
  **mindestens einen** davon tragen. *Warum:* Auswahlkästchen versprechen
  Mehrfachauswahl. Für den Code heisst das `.overlaps("hashtags", tags)` statt
  des heutigen `.contains(...)` — `contains` ist UND und lieferte bei zwei Haken
  fast immer eine leere Liste.
- **Umfrage-Ergebnis: erst nach eigener Stimme.** Wer noch nicht abgestimmt hat,
  sieht die Optionen, aber keine Zahlen. *Warum:* die Umfrage soll die Antwort
  nicht vorprägen. **Das ist eine Frage der Abfrage, nicht der Anzeige** — die
  Zählung darf serverseitig nicht herausgehen, bevor die eigene Stimme steht;
  ein Ausblenden im Bauteil wäre Kulisse, die Zahlen stünden in der Antwort.

## Files modified

- `scripts/age581-datenpflege.logic.ts` — **neu**, Rechenkern (`paidUntilAus`,
  `ordneZu`, `findeDoppelbelegung`, `adresseWeichtAb`)
- `scripts/age581-datenpflege.logic.test.ts` — **neu**, 24 Zusagen
- `scripts/probe-age581-datenpflege-trockenlauf.ts` — **neu**, 12.7 erste Hälfte
- `scripts/age581-datenpflege-schreiben.ts` — **neu**, sechs Schritte einzeln
  aufrufbar, jeder idempotent
- `scripts/probe-age581-datenpflege-abnahme.ts` — **neu**, 22 Zusagen, kennt die
  Quelldatei nicht
- `docs/age-581-mitgliederabgleich.md` — gemessene statt abgelesene Zahlen, der
  Vorfall, der Endstand
- `openspec/changes/add-admin-member-lifecycle/tasks.md` — 12.0 bis 12.7

## Next session: start here

**AGE-581 ist inhaltlich fertig.** Der nächste Schritt ist der
**Aktivierungsversand** — 69 der 72 PROD-Konten sind nicht aktiviert und kommen
erst darüber herein; ein deaktiviertes Konto bekommt dabei keinen Link (Status
`blocked`). Vorher zu klären: **`app.fairbusinessclub.de` hat weiter keinen
DNS-Eintrag**, und das ist der Go-Live-Punkt.

Die Quelldatei mit den festen Zuordnungen liegt **nicht im Repo** (Rechte 0600,
Sitzungs-Ablageordner) und ist mit der Sitzung weg. Sie ist Detlevs Original
plus eine sechste Spalte `konto_id` mit zwei Kennungen (Zeilen 8 und 19). Wer
sie neu braucht: aus den Screenshots ablesen und die zwei Kennungen aus PROD
holen — die Regel steht in `docs/age-581-mitgliederabgleich.md`.

**Danach steht AGE-582 an** („Aktivität auf Konzeptstand"), Priorität High,
Backlog, angelegt am 24.08. Es hält Donalds Rückmeldungen aus dem
Screenshot-Vergleich fest: die zusätzlichen Infos in der Sidebar (§4), die
Aktivitäts-Box, die über der Sidebar statt in der Feed-Spalte sitzt (§1,
`CommunityFeed.tsx:156` rendert sie **vor** dem Raster), die farbigen Icons im
Dashboard (§0) und die Icons zum Erstellen (§1). Dazu Reiter + „Gespeichert"
(§2/§3, neue Tabelle `post_saves`) und Umfragen (§5, im Datenmodell bisher gar
nicht vorhanden).

Das Issue sagte selbst „direkt nach Abschnitt 11 von AGE-581, nicht davor" —
diese Bedingung ist seit heute erfüllt. **Beide Fragen, die es blockierten, sind
jetzt entschieden** (siehe Decisions). Erste Handlung: ein OpenSpec-Change
anlegen, mit §0 (Icon-/Farbkanon) zuerst — alle anderen Teile hängen daran.
Zwei Fallen stehen im Issue: `grants_test.sql` kippt bei jeder neuen Tabelle mit
Table-Grant, und die Sidebar-Zähler dürfen nichts zählen, was der Betrachter
nicht sehen darf (dasselbe Prädikat wie `posts_select_by_visibility`).

## Open questions

- **Drei Anmeldeadressen bleiben abweichend** und brauchen eine Entscheidung:
  eine ohne `@`, eine, die in die Kollision mit einer Firmenadresse liefe, und
  die des zweiten Admins (er bestätigt selbst, welche stimmt).
- **Ein echter Mitgliedsname stand in `tasks.md`** (öffentliches Repo). Aus dem
  Text ist er raus, aus der Git-Historie nicht. Deine Entscheidung.
- **Ich habe am 24.08. das PROD-DB-Passwort ins Terminal ausgegeben** (frühere
  Sitzung). Rotation ist offen.
- **Vier Review-Befunde aus 11.5 bleiben offen:** HIGH-2 (Zeilensperre endet vor
  dem GoTrue-Aufruf) · `event_attendees`-RPC ohne Paging · Draft und
  Server-Baseline sind derselbe Zustand · zwei pgTAP-Negativzusagen laufen vor
  ihrem Fixture.
- **Das Onlinetreffen ist am 25.08.**, also morgen.
- **AGE-582 §5: braucht eine Umfrage eine Laufzeit?** Noch offen — und es hängt
  an der heutigen Entscheidung: sieht das Ergebnis nur, wer abgestimmt hat, dann
  sieht ein Nichtwähler es **nie**. Bei einer laufenden Umfrage ist das gewollt,
  bei einer beendeten vermutlich nicht. Naheliegend: nach Ablauf für alle
  sichtbar — was ein Ende voraussetzt.
- **Der Kommentar zu AGE-582 in Linear konnte nicht geschrieben werden**
  (Klassifikator blockte den MCP-Aufruf). Die beiden Entscheidungen stehen
  deshalb **nur hier**, nicht am Issue. Wer AGE-582 aufnimmt, trägt sie dort
  nach.
- Unverändert offen: 7.5 stimmt nur zur Hälfte · kein Nachsetz-Weg für eine
  gelöschte Zeile ohne Ban · `grund` ohne Aufrufer · `admin_audit.actor` ohne
  `on delete cascade` · Abweichungen 4.5 und 9.3 begründet, nicht abgenommen ·
  Downgrade (AGE-516) · `admin_list_feedback()` ohne Paging.
- **DEV ist nicht mitgepflegt.** Eines der elf Konten ist dort
  `matching_manager`; wird es auch auf DEV deaktiviert, verliert es die Rolle.
