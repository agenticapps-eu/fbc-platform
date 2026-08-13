---
reviewers: [gemini, codex]
models: [gemini-cli-0.28.2, gpt-5.6-sol]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: 34d6f61a3d8c3c41670b891daf5f9f143b3897a25e8a2d53eb50e04f1dde1054
---

# Change review — add-profile-address-fields (AGE-537)

Schritt 2b, vor der ersten Codezeile. Beide Reviewer sind fremder Anbieter; die
eigene Familie war nicht dabei. `REVIEWER_TIMEOUT=900` statt der voreingestellten
300 s — mit 300 s fällt `codex` hier regelmäßig als exit 4 aus und zählte dann
nicht.

`gemini --version` meldet nur die CLI-Fassung (0.28.2); welches Modell dahinter
antwortete, weist weder die CLI noch die Ausgabe aus. Festgehalten wird, was
belegbar ist — nicht das wahrscheinliche Modell.

## Reviewer: gemini (gemini-cli 0.28.2, Modell nicht ausgewiesen)

VERDICT: REQUEST-CHANGES

- [MEDIUM] Spec-Delta / Kontaktfreigabe — Die Anschrift wird an dieselbe einzige
  Zustimmung gehängt wie E-Mail und Telefon. Das ist deutlich mehr PII, als wer
  „Anfrage annehmen" drückt erwartet. — Entweder abgestufte Einwilligung, oder
  die Oberfläche muss unmissverständlich sagen, dass die Anschrift mitgeht.
- [LOW] tasks 4.2 — `country` mit „DE" vorbelegt setzt Deutschland voraus;
  österreichische und Schweizer Mitglieder haben Reibung. — Auswahlfeld mit
  Vorbelegung statt fester Annahme.
- [LOW] tasks 6.1 — Die Zusammensetzung der Branchenliste an Detlev zu
  delegieren, macht die Umsetzung von einer Zusage abhängig. — Eine tragfähige
  Erstfassung gehört in den Change.

## Reviewer: codex (gpt-5.6-sol, codex-cli 0.145.0)

VERDICT: REQUEST-CHANGES

- [HIGH] `contact-requests` — Die Freigabe wächst von E-Mail/Telefon auf die
  Anschrift, aber weder die Capability noch der Annahme-Dialog ändern sich.
  „Annehmen" legt unbemerkt die Anschrift offen, und bestehende `accepted`-
  Beziehungen bekommen auch jede spätere Adressänderung. — Delta für
  `contact-requests`, Dialogtext, und die fortlaufende Freigabe ausdrücklich
  entscheiden.
- [HIGH] design 6 / tasks §6 — Die Taxonomie ist unabgestimmt und die Zuordnung
  entsteht ohne die 69 echten Freitexte. Drei Spielzeugtests machen eine
  plausible, aber falsche Klassifikation grün. — Reale Werte als Fixtures,
  Mehrfachtreffer deterministisch, Quote festlegen.
- [HIGH] tasks §§1–2 / `specs/admin` — Für die geänderte `SECURITY DEFINER`-
  Funktion fehlen Datenbanktests. Frontend-Mocks belegen weder Weißliste noch
  Upsert. — pgTAP für alle fünf Felder, fehlender Schlüssel, JSON-`null`,
  Nicht-Admin, Audit-Zeile.
- [MEDIUM] Spec vs. design — Der Spec verlangt eine gemeinsame Branchenquelle
  für Editor **und** Verzeichnisfilter; das Design lässt den Filter
  datengetrieben, und keine Aufgabe fasst `MemberDirectory` an. — Eine Variante
  wählen.
- [MEDIUM] tasks 2.3 — Ein Upsert ohne vorhandene Zeile prüft den INSERT-Zweig
  und gerade **nicht** den behaupteten `ON CONFLICT`-Pfad. — Zweimal upserten.
- [MEDIUM] tasks 3.3 — `country: "DE"` in den Formular-Vorgaben macht ein
  bewusst geleertes Land beim nächsten Laden wieder zu „DE" und kann bei einer
  fachfremden Speicherung eine Kontaktzeile mit erfundenem Land anlegen. —
  Zwischen „keine Zeile" und „Zeile mit `country = NULL`" unterscheiden.
- [MEDIUM] tasks §§3–4 — Kontaktfelder in `ProfileFormValues`, während der Admin
  sein eigenes `AdminContact` behält: zwei Wahrheiten. — Eine kanonische Form
  festlegen oder die Kontakte aus dem gemeinsamen Schema heraushalten.
- [MEDIUM] `admin_audit` — Der Patch wird roh gespeichert, die Anschrift also in
  eine zweite Tabelle kopiert; kollidiert mit der offenen DSGVO-Arbeit
  (Löschung, Aufbewahrung). — Rohwerte begründen oder Feldnamen auditieren.
- [MEDIUM] Kontakt-E-Mail — Der erste Self-Service-Pfad ändert die Adresse, an
  die `notify-contact-request` sendet, ohne Formatprüfung. — zod-`email`,
  `type="email"`, Negativtest.
- [LOW] design 2 — „Ein Spalten-Grant verwandelte den Tabellen-Grant in eine
  Spaltenliste" ist technisch falsch: ein zusätzlicher Spalten-Grant widerruft
  den Tabellen-Grant nicht. — Begründung korrigieren und die breite künftige
  Schreibfläche ausdrücklich annehmen.
- [LOW] tasks 1.2 — Der bestehende Tabellenkommentar behauptet weiterhin
  „owner-only" und eine erst **künftige** Freigabeaktion. — In derselben
  Migration richtigstellen.

Ungenannte Annahmen (Auszug): dass die in WordPress erhobene Anschrift auch für
eine Offenlegung gegenüber Mitgliedern erhoben wurde; dass jede Adresse in eine
Straßenzeile passt (kein c/o, kein Zusatz); dass `country` ein ISO-3166-1-alpha-2-
Code ist; dass bestehende `accepted`-Beziehungen jede spätere Adressänderung
sehen dürfen; dass `saveProfile` teilweise scheitern darf, weil es ohnehin über
mehrere nicht-atomare Aufrufe läuft.

## Not counted

Keiner. Beide Reviewer liefen durch (exit 0).

## Resolution

**Übernommen, im Delta geändert:**

1. **`contact-requests` bekommt ein Delta** (codex HIGH 1, gemini MEDIUM — zwei
   Anbieter unabhängig auf denselben Punkt). Der Annahme-Dialog nennt künftig
   „E-Mail, Telefon **und Anschrift**". Die Freigabe bleibt fortlaufend und
   beidseitig, wie sie es für E-Mail und Telefon schon ist — das ist eine
   Entscheidung, keine Unterlassung, und steht jetzt als Anforderung da statt
   als stillschweigende Eigenschaft der Policy. Ein Widerrufsweg wird **nicht**
   gebaut: es gibt heute keinen für Telefon und E-Mail, und ihn nebenbei für die
   Anschrift zu erfinden hieße, eine halbe Zusage zu geben. Als Folgepunkt
   notiert, nicht als Teil dieses Changes.
2. **pgTAP für die Admin-Funktion** (codex HIGH 3) — neue Aufgabengruppe 2.5–2.8:
   alle fünf Felder anlegen und ändern, fehlender Schlüssel bleibt, JSON-`null`
   leert, Nicht-Admin prallt ab, Audit-Zeile entsteht.
3. **Mehrfachtreffer liefern `null`** (codex HIGH 2, Teil) — als Szenario im
   Delta und als Aufgabe. Ohne das ist die Zuordnung von der Reihenfolge der
   Liste abhängig, und die Reihenfolge ist Redaktion.
4. **Der Widerspruch Spec ↔ Design zur Branchenquelle** (codex MEDIUM 1) ist
   aufgelöst: der Spec sagt jetzt „Editor und Import-Zuordnung", der Filter
   bleibt ausdrücklich datengetrieben.
5. **Der Upsert-Test läuft zweimal** (codex MEDIUM 2). Der Befund ist richtig:
   der `ON CONFLICT`-Pfad war genau der, den Entscheidung 4 behauptet, und der
   Test hätte ihn nie berührt.
6. **`country` wird gar nicht vorbelegt** (codex MEDIUM 3). Die erste Antwort
   auf den Befund war eine Bedingung („nur wenn keine Zeile existiert"); beim
   Bauen zeigte sich die Fassung ohne Vorbelegung als die kürzere, die den
   Fehler nicht zulässt. „DE" steht als Platzhalter im Feld, gesetzt wird es vom
   Import — dort, wo es gebraucht wird, weil WordPress das Feld nicht erhebt.
7. **zod-`email` auf die Kontakt-E-Mail** samt Negativtest (codex MEDIUM 5).
8. **Entscheidung 2 im Design richtiggestellt** (codex LOW 1). Die Aussage war
   falsch — ein zusätzlicher Spalten-Grant widerruft nichts. Die breite
   Schreibfläche für künftige Spalten wird jetzt ausdrücklich angenommen, mit
   der Bedingung, die daran hängt.
9. **Der Tabellenkommentar wird richtiggestellt** (codex LOW 2). Er behauptet
   „owner-only" und eine künftige Freigabe, die es seit dem 14.06. gibt.
10. **Eine Erstfassung der Branchenliste ist Teil des Changes** (gemini LOW 2) —
    war schon so geplant (Aufgabe 6.1), steht jetzt auch im Design statt nur in
    den Offenen Fragen.

**Bewusst nicht übernommen, mit Grund:**

- **Abgestufte Einwilligung je Feld** (gemini MEDIUM). Das ist ein eigener
  Sichtbarkeitsbegriff und widerspricht Donalds Entscheidung vom 13.08., die
  Anschrift genau wie Telefon und E-Mail zu behandeln. Der Teil des Befundes,
  der trägt — dass der Mensch es wissen muss, bevor er annimmt — ist als Punkt 1
  übernommen.
- **Reale WordPress-Freitexte als Fixtures** (codex HIGH 2, Kern). Sie liegen
  nicht vor: der Export ist der offene Punkt von C10 (AGE-534 §1), und ihn für
  C6a zu ziehen hieße, den Change auf eine Datenlieferung zu setzen, die den
  Import blockiert. Die Zuordnung ist deshalb so gebaut, dass sie bei
  Unsicherheit `null` liefert, und die Quote wird dort gemessen, wo die echten
  Werte auflaufen — im Bericht von C10. Das steht in den Risiken.
- **`country` als Auswahlfeld** (gemini LOW 1). Ein Textfeld nimmt „AT" und „CH"
  ohne Reibung an; eine Länderliste ist Pflege für einen Verein, dessen
  Mitglieder ganz überwiegend in Deutschland sitzen. Vorbelegung ja, Liste nein.
- **Kontaktfelder aus `ProfileFormValues` heraushalten** (codex MEDIUM 4). Der
  Admin-Editor behält sein `AdminContact`; er lädt über `admin_get_profile` und
  schickt seinen eigenen Patch, liest also nie aus dem Mitglieder-Formular. Zwei
  Formen sind hier weniger Risiko als eine Form mit zwei Schreibwegen.
- **`admin_audit` speichert weiterhin den Patch** (codex MEDIUM 6). Der Befund
  ist richtig, aber er ist älter als dieser Change: E-Mail und Telefon liegen
  dort seit C6 im Klartext. Ihn hier halb zu beheben verteilte die Entscheidung
  auf zwei Changes. Gehört zu `add-dsgvo-compliance`, das offen ist — dort
  notiert.
- **Zweite Adresszeile / c/o** (Annahme). In WordPress ist „Straße & Nr." **ein**
  Textfeld; eine zweite Spalte hätte beim Import nichts, was hineinginge.

---

# Review auf dem Diff (Schritt 4)

Nach der Umsetzung, vor dem Merge. Prompt: der vollständige Diff gegen `main`
über `supabase/` und `src/`.

## Reviewer: gemini (gemini-cli 0.28.2, Modell nicht ausgewiesen)

VERDICT: APPROVE

- [LOW] Migration — Die Weißliste von `admin_update_profile` mischt Schlüssel
  aus drei Tabellen; auf Dauer wären drei tabellenbezogene Funktionen näher an
  ihren Anweisungen. Ausdrücklich kein Fehler an diesem Change.

## Reviewer: codex (gpt-5.6-sol, codex-cli 0.145.0)

VERDICT: REQUEST-CHANGES

- [HIGH] Bestandsbeziehungen — Bereits `accepted`-Beziehungen sehen die
  Anschrift sofort, ohne dass der neue Dialog sie je erreicht hat.
- [HIGH] `src/lib/profile.ts` — Der bedingungslose Upsert schreibt alle sieben
  Felder; eine parallele Admin-Änderung wird von einem fachfremden Speichern
  still überschrieben.
- [HIGH] `PublicProfilePage` / `MeineChancenPage` — Die Texte VOR dem Senden
  sagen weiter nur „Kontaktdaten". Aufgabe 5.3 ist damit nicht erfüllt.
- [MEDIUM] `admin_audit` — Der rohe Patch kopiert die Anschrift bei jeder
  Admin-Speicherung erneut, ohne Aufbewahrungs- oder Löschregel.
- [MEDIUM] `rls_test.sql` — Der negative Schreibtest deckt nur den Umweg über
  die Admin-RPC ab, nicht den neuen DIREKTEN Mitgliederweg.
- [MEDIUM] `AdminMitgliedPage.test.tsx` — mockt `saveAdminProfile`, also eigenen
  Code; der Service-Test prüft die Adressfelder im Patch nicht. Ein Entfernen
  der Zuordnung bliebe überall grün.
- [LOW] `branchen.test.ts` — Der Schleifentest akzeptiert `null` und würde ein
  Stichwort, das seine Zuordnung verliert, nicht bemerken.

## Not counted

- codex, erster Lauf — abgebrochen, null Bytes Ausgabe. Neu gestartet; der
  zweite Lauf ist der oben verzeichnete.

## Resolution (Diff-Review)

**Behoben:**

1. **Die Texte vor dem Senden** nennen jetzt „E-Mail, Telefon und Anschrift"
   und sagen ausdrücklich *beidseitig* (HIGH 3). Der Befund ist der
   unangenehmste der Runde: Aufgabe 5.3 nannte beide Dateien beim Namen, 5.4 war
   abgehakt, und geändert war nur der Empfänger-Hinweis.
2. **pgTAP für den direkten Mitgliederweg** (MEDIUM 2): ein fremder Upsert
   prallt ab, und ein unbestätigtes Konto trifft **null Zeilen**. Zwei Fallen
   dabei, beide erst im Lauf sichtbar: das Sondenkonto `dddd…` ist an dieser
   Stelle der Datei längst bestätigt (§14 löst es unterwegs ein), und ein von
   der USING-Klausel weggefiltertes UPDATE wirft NICHTS — `try_as` meldete
   folgerichtig `OK`. Deshalb ein frisches Konto und eine gezählte Zeilenzahl
   statt einer erwarteten Ausnahme.
3. **Der Admin-Patch wird am Supabase-Rand geprüft** (MEDIUM 3): zwei
   Aussagen in `admin-profile.test.ts` über alle fünf Felder und über leer→null.
4. **Der Branchen-Schleifentest ist streng** (LOW): jedes Stichwort MUSS seine
   Branche treffen. Nebenwirkung, die den Aufwand allein wert ist: der Test
   belegt jetzt auch, dass kein Stichwort zwei Branchen trifft.

**Nicht behoben, mit Grund:**

- **Bestandsbeziehungen** (HIGH 1). Der Befund ist richtig und die Entscheidung
  gehört nicht mir: die fortlaufende, beidseitige Freigabe steht so im Delta,
  weil sie für E-Mail und Telefon seit jeher gilt. Praktisch ist das Fenster
  heute leer — PROD trägt zwei Konten und keine gewachsene Beziehungshistorie,
  und C10 importiert in eine Datenbank ohne Altannahmen. **Donald vorgelegt**,
  nicht stillschweigend entschieden.
- **Der bedingungslose Upsert** (HIGH 2). Gleiches Verhalten wie bei der
  Profilzeile seit AGE-238: `saveProfile` schreibt auch dort alle Felder aus dem
  Formular, das beim Öffnen geladen wurde. Eine optimistische Sperre allein für
  die Kontaktzeile führte ein Nebenläufigkeitsmodell ein, das der Rest des
  Editors nicht hat — das ist ein eigener Vorgang, kein Nebenschritt hier.
- **`admin_audit`** (MEDIUM 1). Wie schon im Plan-Review: älter als dieser
  Change, gehört zu `add-dsgvo-compliance`.
