---
reviewers: [gemini, codex]
models: [nicht gemeldet, nicht gemeldet]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: edb1e49e82d0718c
---

# Change review — kontoloeschung

Zwei Fremdvendoren, beide REQUEST-CHANGES. Der umsetzende Host ist `claude` und
zählt nicht mit. Reviewt wurde der Stand vor den Korrekturen; die Prompt-Datei
umfasste 480 Zeilen (proposal, design, tasks, spec delta).

> **Zu den Modellnamen:** Der Wrapper hat keine `MODEL:`-Zeile geliefert, weder
> auf stdout noch stderr. Die tatsächlich antwortenden Modelle sind daher nicht
> belegt und werden hier nicht geraten. Beide Arme sind verschiedene Vendoren und
> haben inhaltlich deutlich verschiedene Befunde geliefert, was gegen zwei
> Zeigern auf dasselbe Modell spricht — bewiesen ist es damit nicht.

## Reviewer: gemini

VERDICT: REQUEST-CHANGES

- [HIGH] Open Questions / Veranstaltungsanmeldungen — Eine anonymisierte Anmeldung
  zu einer künftigen Veranstaltung ist für den Gastgeber ein Problem: er kann die
  Person nicht mehr erreichen, und der Platz bleibt belegt. — Anmeldungen zu
  künftigen Veranstaltungen bei der Löschung stornieren, nicht anonymisieren.
- [MEDIUM] Anonymisierungs-Umfang — Offene, noch nicht angenommene
  Kontaktanfragen, die das Konto gesendet hat, bleiben stehen; eine Anfrage von
  „Ehemaliges Mitglied" zu erhalten ist verwirrend. — Offene Anfragen zurückziehen.
- [MEDIUM] Anonymisierungs-Umfang — Mitgliedschaft in Gruppenunterhaltungen ist
  nicht behandelt; Teilnehmerlisten könnten mehrere „Ehemaliges Mitglied" führen.
  — Konto aus Gruppen-Teilnehmerlisten entfernen.
- [LOW] D6 / Aufbewahrung — Die Annahme, eine spätere Rechnungslösung sei
  kompatibel, ist nicht als Auflage festgehalten. — Festschreiben, dass Belege die
  nötigen Angaben bei Erstellung kopieren statt aus `profiles` zu lesen.
- [LOW] Impact — @-Erwähnungen eines gelöschten Mitglieds in fremden Beiträgen
  führen ins Leere. — Die Oberfläche muss sie als schlichten Text darstellen.

**Nicht ausgesprochene Annahmen (gemini):** dass ein anonymer Eintrag in einer
Teilnehmerliste hinnehmbar ist; dass verwaiste Profile ohne Überwachung
hinnehmbar sind; dass alle 35 Fremdschlüssel korrekt konfiguriert sind; dass die
`tsvector`-Neuberechnung in der Transaktion vernachlässigbar ist.

## Reviewer: codex

VERDICT: REQUEST-CHANGES

- [HIGH] D2 / Migration 1 / Task 2.1 — D2 verlangt, den Fremdschlüssel zu
  entfernen, Migration und Task setzen ihn ohne Kaskade neu. Das ergibt `NO
  ACTION`: solange der Grabstein existiert, scheitert die Auth-Löschung an der
  referenziellen Integrität. — Den Fremdschlüssel tatsächlich entfernen, alle
  Artefakte vereinheitlichen, Auth-Löschung bei erhaltenem Profil als Test.
- [HIGH] Proposal Why / D1 / Spec — Die gewählte Lösung könnte Apples Vorgabe
  widersprechen, auch geteilte nutzergenerierte Inhalte zu löschen; der Change
  wäre umgesetzt und AGE-644 bliebe blockiert. — Entscheidung belegen oder
  korrigieren.
- [HIGH] D5 / Task 3.2 — Auth vor Storage zu löschen ist nicht zuverlässig:
  Eigentümerschaft an Storage-Objekten kann die Nutzerlöschung verhindern. Die
  nummerierte Liste widersprach ausserdem ihrer eigenen Erläuterung. — Ablauf
  festlegen: sperren, inventarisieren, anonymisieren, Storage räumen, dann Auth.
- [HIGH] D4–D5 / Spec Auth / Task 5.5 — `deleteUser()` entwertet ausgestellte
  Zugriffstoken nicht sofort; mit erhaltenem Profil liefert `auth.uid()` weiter
  dieselbe ID. Ausblenden im Verzeichnis beweist keine Zugriffssperre. — Sperre
  serverseitig durchsetzen und mit einem vorher gesicherten Token testen.
- [HIGH] D5 / Tasks 3 und 5 — „Der Rest ist nachholbar" hat keinen Mechanismus;
  nach Abbruch sind Pfade verloren, parallele Uploads überholen das Inventar. —
  Idempotenz, Fortschritt, kein Erfolg bei Teilfehler.
- [HIGH] D1 / Task 2.2 / Spec — Profilfelder zu leeren anonymisiert keine
  Freitexte (Nachrichten mit Telefonnummer, Namen in Beiträgen). Das absolute
  Versprechen ist nicht haltbar. — Verbindliche Datenmatrix, Versprechen an die
  erreichbare Wirkung anpassen.
- [HIGH] Proposal / D1 / Restore — `admin_restore_member` setzt `deleted_at` auf
  `null`, und genau das war die einzige dauerhafte Unsichtbarkeitssperre. Ein
  Restore macht den Grabstein wieder sichtbar. — Eigenen irreversiblen Zustand,
  Restore verweigert.
- [HIGH] Migration Plan / Tasks 6.1–6.2 — Der Rollout prüft nur DEV, obwohl PROD
  das relevante System ist; „Kaskade weg" akzeptiert auch `NO ACTION`. — Je
  Umgebung den Schemazustand prüfen und bei inkompatiblem Schema serverseitig
  verweigern.
- [MEDIUM] Tasks 1.4 / 5 / Storage — Aktuelle Bildpfade erfassen weder ersetzte
  Avatare noch Waisen; `event-covers` fehlt in der Liste. — Vollständig
  inventarisieren, `event-covers` entscheiden, fremde Dateien schützen.
- [MEDIUM] D4 / Task 3.1 — „ES256 schliesst `getUser()` aus" verallgemeinert einen
  projektspezifischen Fehler; `sub` zu lesen ist keine Verifikation, und offen
  bleibt, ob eine fremde Ziel-ID abgelehnt oder ignoriert wird. —
  Verifikationsort festhalten, ungültige Signatur/Issuer/Ablauf/fremde ID testen.
- [MEDIUM] Open Questions / Task 1.2 — Veranstaltungsanmeldungen sind zugleich
  offene Frage und zum Erhalt vorgesehen; anonyme Anmeldungen belegen Plätze,
  Gastgeberrollen und geplante Beiträge laufen weiter. — Vor der Umsetzung
  entscheiden und mit Szenarien absichern.

**Nicht ausgesprochene Annahmen (codex):** dass Nachrichten- und Kontaktansichten
fehlende Profile schon als „Ehemaliges Mitglied" darstellen (belegt ist nur der
Feed); dass alle zu leerenden Felder trotz `NOT NULL`, Checks und Triggern
Ersatzwerte annehmen; dass PII nur in den genannten Tabellen und Buckets liegt
(Logs, Benachrichtigungen, Zahlungsanbieter, Sicherungen unbehandelt); dass
laufende Mitgliedschaftszahlungen geregelt sind; dass eine spätere
Rechnungslösung unabhängig vom Profil speichert; dass erneute Registrierung mit
derselben Adresse nichts wieder verbindet; dass alle Kontozustände den
Löscheinstieg erreichen.

## Not counted

- `claude` — umsetzender Host, per Regel ausgeschlossen.
- Kein Reviewer ist ausgefallen; beide Aufrufe endeten mit Exit 0.

## Resolution

**Übernommen und eingearbeitet (13 Befunde):**

| Befund | Was geändert wurde |
|---|---|
| codex HIGH #1 (`NO ACTION`) | **D2 neu geschrieben.** Der Fremdschlüssel wird *entfernt*, nicht ohne Kaskade neu gesetzt. Der Fehler war echt und hätte die Löschung blockiert statt sie zu ermöglichen. Task 2.1 und Proposal nachgezogen, Test 5.5 erweitert, Rollout 6.1 prüft „Schlüssel weg", nicht „Kaskade weg" |
| codex HIGH #3 (Storage-Eigentum) | **D5 Reihenfolge umgedreht:** sperren → Inventar → Dateien → anonymisieren → `auth.users` zuletzt. Aufgabe 1.6 misst die Eigentümerspalte vorab |
| codex HIGH #4 (Token gilt weiter) | **Neues D8** und ein eigenes Spec-Requirement *„Access ends immediately"*. Aufgabe 2.6 sperrt die schreibenden Prädikate, Test 5.6 nutzt ein vorher gesichertes Token |
| codex HIGH #7 (Restore) | **Neues D7:** eigener, dauerhafter Löschzustand statt `deleted_at` allein; `admin_restore_member` verweigert ihn. Aufgaben 2.2/2.7, Test 5.7. Der Befund stand in einer Datei, die ich gelesen hatte — er ist verdient |
| codex HIGH #6 + gemini LOW (Freitext, Mentions) | **Neues D9.** Das Spec-Versprechen ist auf die **strukturierten** Felder eingeschränkt; die Erwähnungen dieses Projekts lösen über den *Namen* auf (`buildMentionResolver`), der Name steht also im Text fremder Beiträge. Nachgemessen und bestätigt. Aufgabe 4.4 stellt sie als schlichten Text dar |
| codex HIGH #5 (kein Wiederaufnahme-Weg) | **D5 um Idempotenz ergänzt**, neues Spec-Requirement *„A partially completed deletion never reports success"*, Test 5.11. Den vorgeschlagenen dauerhaften Auftragsspeicher mit Fortschritt habe ich **nicht** übernommen — siehe unten |
| codex HIGH #11 + MEDIUM #8/#9/#10 | Rollout prüft PROD (6.3) und verweigert bei unvorbereitetem Schema (3.5); Objektinventar umfasst ersetzte Avatare und Waisen (1.5); Verifikationsort festgeschrieben (D4, 3.1); fremde Ziel-ID wird abgelehnt |
| gemini HIGH (Anmeldungen) | **Neues D10** und ein eigenes Spec-Requirement *„Deletion releases the member's claims on future activity"*. Bestätigt: `event_registrations` kennt `cancelled` und führt eine `waitlist` — ein anonymer Platz hätte die Warteliste blockiert |
| gemini MEDIUM (offene Anfragen) | In D10 übernommen: offene Anfragen werden zurückgezogen, angenommene bleiben |
| gemini LOW (easybill) | **D6** um die Auflage ergänzt: Belege kopieren die Angaben bei Erstellung |

**Geprüft und verworfen:**

- **gemini MEDIUM (Gruppenunterhaltungen)** — gegenstandslos. `message_threads`
  ist über `unique (a_profile_id, b_profile_id)` strikt zweiseitig; Gruppenchats
  gibt es in diesem Produkt nicht. In D10 als geprüft vermerkt.
- **codex HIGH #5, der Umfang des Vorschlags** — ein dauerhafter Löschauftrag mit
  Manifest, Fortschrittsstand und serverseitiger Wiederaufnahme wäre ein
  Auftragsspeicher mit Betriebszustand und nähme das Audit-Log aus AGE-260
  vorweg. Der Befund selbst ist übernommen, aber mit dem kleineren Mittel:
  Idempotenz je Schritt plus „kein Erfolg bei Teilfehler". Bewusste Entscheidung
  gegen den vorgeschlagenen Umfang, nicht gegen den Befund.
- **gemini-Annahme zur `tsvector`-Neuberechnung** — betrifft eine Zeile je
  Löschung; keine Massnahme nötig.

**Offen, weil es Donald gehört:**

- **codex HIGH #2 (Apples Lesart).** Ob das Erhalten fremder Gesprächsfäden bei
  der Store-Prüfung durchgeht, ist keine technische Frage. Die Entscheidung
  „anonymisieren" ist am 08.09. getroffen worden, und die Praxis grosser Dienste
  stützt sie; codex' Formulierung „widerspricht Apples ausdrücklicher Vorgabe"
  ist schärfer als die Quellenlage. Das Restrisiko liegt bei der Einreichung und
  ist Donald vorgelegt, nicht stillschweigend abgeräumt. Steht in design.md unter
  Open Questions.

**Nicht adressiert, bewusst benannt:** codex' Annahmen zu Logs,
Benachrichtigungen, Zahlungsanbietern und Sicherungen. Sicherungen sind bei einer
DSGVO-Löschung anerkannt nachrangig; die übrigen sind in der Datenmatrix (1.1)
zu behandeln, die vor der Umsetzung entsteht — dort werden sie beantwortet, nicht
hier.

<!-- openspec-review-trailer v1
implementing-host: claude
digest: sha256:388bf1c22159cf3f587726998fd4fc9c25fe036067de59523c846848a200e389
producer-version: 1.2.0
tasks-digest: sha256:dbe66bdbcdea65a96486234a9b931aebf1ceb4a18502597d42b8423eac9661d9
-->
