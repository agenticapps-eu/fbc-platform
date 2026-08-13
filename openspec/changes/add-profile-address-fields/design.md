## Context

C6 (AGE-498) hat die Migrationsfelder angelegt, damit C10 nur noch ein Script
schreiben muss. Die Anschrift fehlte darin, weil sie zu dem Zeitpunkt
weggelassen werden sollte. Am 13.08. ist das umgedreht worden: die Anschrift
kommt mit, sie ist erst nach angenommener Kontaktanfrage sichtbar, und die
Branche wird aus dem Freitextfeld „Business" abgeleitet.

Der Stand auf der Platte, an fünf Stellen nachgesehen und nicht vermutet:

- `public.profile_contacts` = `(profile_id, email, phone, updated_at)`. `website`
  wurde am 11.06. gedroppt (`20260611171003:75`) — der Spec-Text nennt es noch.
- Die Tabelle trägt einen **Tabellen**-Grant
  (`grant select, insert, update … to authenticated`, `20260715140000:86`), keine
  Spaltenliste wie `profiles`. Neue Spalten sind damit ohne Zutun
  client-schreibbar.
- `profile_contacts_insert_own` und `profile_contacts_update_own` existieren
  seit dem Aktivierungs-Gate (`20260806080100:382-392`), beide an
  `is_activated()`. Der Schreibweg ist policy-seitig fertig.
- Trotzdem schreibt dort heute **nur** `admin_update_profile()`. In `src/`
  kommt `phone` ausschließlich in `admin-profile.ts`, `contact-requests.ts`
  (lesend) und `PublicProfilePage.tsx` (Anzeige) vor. `src/lib/profile.ts`
  fasst die Tabelle nicht an.
- `branche` ist ein Freitext-`Input` (`ProfileFieldsets.tsx:50`), und die
  Filteroptionen im Verzeichnis kommen als **Facette** aus den vorhandenen
  Werten (`MemberDirectory.tsx:117`). Eine Liste „bestehender Branchenwerte",
  auf die AGE-537 §5 verweist, gibt es nicht.

## Goals / Non-Goals

**Goals:**

- Fünf Adressspalten, die dieselbe Freigabe erben wie E-Mail und Telefon.
- Ein Kontaktblock im Profil-Editor, der die ganze Kontaktzeile abdeckt.
- Der Admin-Weg erreicht die Anschrift.
- Ein Zielvokabular für `branche` und eine reine Zuordnungsfunktion darauf.
- Ein pgTAP-Beleg, dass die Anschrift ohne Freigabe nichts liefert.

**Non-Goals:**

- Das Import-Script (C10) und das Auftrennen von „Plz & Ort" — dort ist der
  Bericht, in dem die Ausreißer landen.
- Kartenansicht, Umkreissuche, Adressvalidierung.
- `region` anzufassen. Es bleibt die Regionalgruppe.
- Die Vollständigkeitsberechnung. Die zwölf gewichteten Felder sind Vertrag mit
  dem DB-Trigger; ein dreizehntes verschöbe rückwirkend jeden Prozentwert.

## Decisions

### 1 · Die Spalten liegen auf `profile_contacts`, nicht auf `profiles`

Entschieden von Donald, und die Mechanik trägt es ohne Zusatz: dieselbe Policy,
derselbe Begriff „freigegeben", eine Stelle. Auf `profiles` wäre die Anschrift
für jedes eingeloggte Konto lesbar — und das Verzeichnis ist ohnehin schon
weiter offen als gedacht.

*Verworfen:* eigene Tabelle `profile_addresses`. Eine dritte Zeile pro Profil,
eine vierte Policy, ein zweiter Upsert im Admin-Weg — für Daten, die dieselbe
Sichtbarkeit haben wie die, die schon dort liegen.

### 2 · Kein Grant wird angefasst, und genau das wird belegt

Die Abnahme „im Client-UPDATE-Grant" ist erfüllt, bevor eine Zeile geschrieben
ist: der Tabellen-Grant deckt künftige Spalten mit ab.

*Korrigiert nach dem Fremd-Review (codex, LOW):* Ein zusätzliches
`grant update (…)` würde den Tabellen-Grant **nicht** widerrufen — die frühere
Begründung an dieser Stelle war schlicht falsch. Es entstünde stattdessen eine
zweite, engere Rechteangabe **neben** der weiteren, die nichts einschränkt und
beim Lesen genau das Gegenteil suggeriert. Wer die Schreibfläche wirklich
verengen wollte, müsste das Tabellenrecht erst `revoke`n. Das tut dieser Change
nicht.

Damit wird eine Eigenschaft ausdrücklich angenommen statt bloß hingenommen:
**jede künftige Spalte auf `profile_contacts` ist für `authenticated`
schreibbar, sobald sie existiert.** Das ist tragbar, solange die Tabelle das
bleibt, was ihr Name sagt — vom Mitglied gepflegte Kontaktdaten. Eine Spalte,
die das Mitglied *nicht* selbst setzen darf (etwa ein Prüfvermerk zu einer
Adresse), gehört deshalb nicht auf diese Tabelle, oder sie erzwingt den
`revoke`-Weg. Das ist die Bedingung, die an dieser Entscheidung hängt.

Die Golden-Snapshots in `grants_test.sql` bleiben dadurch unverändert: der
Tabellen-Grant liest sich weiter `profile_contacts/authenticated=INSERT,SELECT,UPDATE`,
und die Spalten-Assertion filtert auf `profiles`, `contact_requests`,
`routing_queue`, `platform_settings`. Der Beleg gehört stattdessen nach
`rls_test.sql`: ein Mitglied schreibt seine eigene Anschrift, ein anderes liest
sie nicht.

### 3 · `country` bekommt keinen Spalten-Default, und die Vorbelegung hat eine Bedingung

„Vorgabe `DE`" wandert ins Formular und ins Import-Script, nicht ins Schema.
Ein `default 'DE'` griffe hier ohnehin fast nie: der Editor schickt beim
Anlegen alle Felder mit, ein leeres Feld also als explizites `NULL` — und ein
Spalten-Default wird von einem ausdrücklichen NULL nicht ausgelöst. Ein Default,
der in der Praxis nur bei Zeilen zieht, die niemand so anlegt, ist eine
Behauptung im Schema statt einer Vorgabe im Formular.

*Nach dem Fremd-Review (codex, MEDIUM) fällt die Vorbelegung ganz weg.* Der
Befund war, dass ein fest eingetragenes „DE" aus einer bewussten Leerung beim
nächsten Laden wieder Deutschland macht und bei einer Speicherung ohne Bezug zur
Anschrift eine Kontaktzeile anlegt, deren einziger Inhalt ein erfundenes Land
ist. Die erste Antwort darauf war eine Bedingung („nur wenn keine Zeile
existiert"), also eine Fallunterscheidung im Ladeweg.

Die zweite ist kürzer und lässt den Fehler nicht zu: **das Formular belegt
nichts vor.** `DE` steht als Platzhalter im Feld und wird vom Import gesetzt —
dort, wo es hingehört, weil WordPress das Feld nicht erhebt. Ein Zustand, den es
nicht gibt, braucht keine Bedingung.

Der Upsert läuft dafür **bedingungslos** bei jedem Speichern. Sonst könnte ein
Mitglied seine Kontaktdaten nicht mehr leeren: „alle Felder leer" wäre von
„nichts eingetragen" nicht zu unterscheiden. Die Zeile, die dabei für ein Profil
ohne Kontaktdaten entsteht, trägt ausschließlich NULL-Werte — sie behauptet
nichts, und die Anzeige lässt leere Werte ohnehin weg.

### 4 · Der Editor schreibt per Upsert auf `profile_id`

Ein Mitglied hat heute meist **keine** Zeile in `profile_contacts` — die
Tabelle wird bei der Registrierung nicht befüllt. Der Editor darf deshalb nicht
zwischen „anlegen" und „ändern" unterscheiden müssen.

`ON CONFLICT` braucht Leserecht auf die Konfliktzeile; das ist die Falle, an der
der Storage-Upsert in AGE-438 gescheitert ist. Hier hält der Eigentümer-Zweig
von `contacts_select_self_or_released` genau dieses Recht, und der Editor liegt
hinter dem Aktivierungs-Gate, das derselbe Zweig verlangt. Der Upsert ist damit
zulässig — und der Test dafür ist der, dass ein Mitglied *ohne* bestehende Zeile
speichert.

*Verworfen:* erst `select`, dann `insert` oder `update`. Zwei Rundläufe und ein
Wettlauf für einen Fall, den Postgres kennt.

### 5 · Der Kontaktblock nimmt `email` und `phone` mit

Entscheidung Donald. Der Upsert-Pfad entsteht ohnehin; die zwei Felder kosten
zwei Zeilen und schließen eine Lücke, die sonst am Go-Live-Tag als Support-Fall
zurückkommt („ich kann meine Telefonnummer nicht ändern"). Das geht weiter als
der Wortlaut von AGE-537 — festgehalten, nicht nebenbei.

Die **Login**-Adresse in `auth.users` bleibt unberührt. Sie ist ein anderer
Wert, sie gehört GoTrue, und sie zu ändern ist der Admin-Fallback aus C3.

Zwei Folgen daraus, beide aus dem Fremd-Review:

- Die Kontakt-E-Mail bekommt eine **Formatprüfung** (zod `email`, `type="email"`
  im Feld). Sie ist die Adresse, an die `notify-contact-request` schickt; ein
  Tippfehler dort ist kein Anzeigefehler, sondern eine Benachrichtigung, die
  niemanden erreicht, und der Fehler fällt erst bei Resend an.
- Der Admin-Editor behält sein eigenes `AdminContact`. *Verworfen:* beide auf
  eine gemeinsame Formstruktur ziehen. Der Admin lädt über `admin_get_profile`
  und schickt einen `patch` an eine DEFINER-Funktion; das Mitglied lädt über RLS
  und schreibt per Upsert. Zwei Formen für zwei Schreibwege sind hier weniger
  Risiko als eine Form, die je nach Modus etwas anderes tut — genau daran hing
  in C6 schon die Regel, dass die Bild-Steuerung im Fremd-Modus verschwindet.

### 6 · Die Branchenliste liegt in `src/config/`, die Zuordnung ist eine reine Funktion

Vorbild ist `config/compass.ts`: eine deklarative Datei, die ohne Code-Kenntnis
mit Detlev abgestimmt werden kann, und eine Ableitungslogik daneben.

Die Zuordnung ist eine reine Funktion `Freitext → Branche | null`, ohne
Datenbank und ohne Netz. Sie wird in diesem Change gebaut und getestet;
aufgerufen wird sie von C10, das auch den Bericht schreibt, in dem die Quote
steht. Eine Funktion mit Tests, aber noch ohne Aufrufer, ist hier bewusst: ihr
Aufrufer wäre sonst ein Script, das gegen die Live-Datenbank läuft, und ihre
Qualität würde erst dort sichtbar.

**Die Spalte bleibt `text`, ohne `check` und ohne Fremdschlüssel.** Sonst wäre
jede Listenänderung eine Migration, und Bestandswerte müssten vorher
umgeschrieben werden. Damit ein Bestandswert außerhalb der Liste beim nächsten
Speichern nicht still verschwindet, führt die Auswahl ihn als zusätzliche
Option — die Liste steuert die Eingabe, sie räumt nicht auf.

Die Facette im Verzeichnis bleibt datengetrieben. Sie zeigt, was in den Daten
steht; das ist nach dem Import genau die Frage, die interessiert. Das Delta sagt
das jetzt auch so — es verlangte in einer früheren Fassung eine gemeinsame
Quelle für Editor **und Filter**, während hier der Filter unangetastet bleibt.
Der Widerspruch stammt aus dem Fremd-Review (codex, MEDIUM) und ist zugunsten
dieser Fassung aufgelöst.

**Mehrdeutigkeit liefert `null`.** Trifft ein Freitext Stichwörter mehrerer
Branchen, entscheidet sonst die Reihenfolge der Liste — also die Redaktion einer
Konfigurationsdatei — darüber, in welcher Branche ein Mitglied landet.

Die Erstfassung der Liste ist Teil dieses Changes, nicht eine Zulieferung: sonst
hinge die Umsetzung an einer Abstimmung, und die Liste zu ändern ist später eine
Textänderung ohne Migration.

### 7 · Die Migration ist forward-only und trägt ihre Begründung im Kopf

Wie alle anderen: `alter table … add column`, dann `create or replace function
public.admin_update_profile`. Die Funktion wird als Ganzes neu geschrieben —
Weißliste um fünf Schlüssel erweitert, der `profile_contacts`-Upsert um fünf
Felder, beides im vorhandenen `case when patch ? '…'`-Muster, damit „nicht
geschickt" und „auf leer gesetzt" unterscheidbar bleiben.

`admin_get_profile` bleibt unverändert: es liefert die Kontaktzeile als
`to_jsonb(c)` und zählt keine Spalten auf.

### 8 · Die Oberfläche sagt, was eine Annahme freigibt

Beide Reviewer haben unabhängig denselben Punkt gemeldet: Solange die
Kontaktzeile E-Mail und Telefonnummer trug, deckte sich „Kontaktdaten werden
geteilt" mit der Erwartung dessen, der annimmt. Mit der vollständigen Anschrift
tut es das nicht mehr. Der Annahme-Dialog nennt sie deshalb ausdrücklich, und
derselbe Satz steht am Kontaktblock im Editor — die Zusage muss auch sehen, wer
die Daten einträgt.

*Verworfen:* abgestufte Einwilligung je Feld (gemini). Das wäre ein zweiter
Sichtbarkeitsbegriff neben dem einen, den Donald am 13.08. ausdrücklich gewählt
hat, und die Anschrift bekäme eine Mechanik, die Telefon und E-Mail nicht haben.

*Verworfen:* ein Widerrufsweg für eine erteilte Freigabe. Es gibt heute keinen
für E-Mail und Telefonnummer. Einen allein für die Anschrift zu bauen, gäbe eine
halbe Zusage — das ist ein eigener Vorgang, nicht ein Nebenschritt hier.

## Risks / Trade-offs

- **Der Editor bekommt seinen ersten Schreibweg auf eine RLS-gehärtete Tabelle,
  und `is_activated()` hängt daran** → Ein unbestätigtes Konto läuft in einen
  Policy-Fehler statt in eine leere Maske. Der Editor liegt bereits hinter dem
  Aktivierungs-Gate; der Fall kann nur über einen direkten Aufruf entstehen.
  Nicht abgefangen, sondern belegt: der pgTAP-Teil prüft beide Richtungen.
- **`database.types.ts` ist handgepflegt** (kein Generierungs-Script im Repo) →
  Die fünf Spalten müssen in `Row`, `Insert` und `Update` von
  `profile_contacts` nachgetragen werden, sonst schlägt `typecheck` erst beim
  Upsert zu. Steht als eigene Aufgabe drin, damit es nicht im Editor-Task
  untergeht.
- **Aus `Input` wird `Select` bei `branche`** → Bestehende Editor-Tests fassen
  das Feld womöglich per Textfeld-Rolle an und brechen. Das ist erwünschtes
  Rot: es zeigt, dass der Test die Eingabeart wirklich prüft. Angepasst wird der
  Test, nicht die Zusage.
- **Kein Test deckt heute den Verzeichnis-Facettenweg für Bestandswerte** →
  Die Zusage „ein Bestandswert bleibt erhalten" wird im Editor belegt (die
  zusätzliche Option), nicht im Verzeichnis; dort ist sie eine Eigenschaft der
  bestehenden Facettenabfrage, die dieser Change nicht anfasst.
- **Die Zuordnungsfunktion hat in diesem Change keinen Aufrufer** → Sie kann
  grün sein und in C10 trotzdem daneben liegen, weil die echten Freitexte
  anders aussehen als die Testfälle. Deshalb liefert sie `null` statt zu raten,
  und C10 misst die Quote im Bericht. Der Fremd-Review hat verlangt, die 69
  echten Werte als Fixtures zu benutzen — sie liegen nicht vor, der Export ist
  der offene Punkt von C10 (AGE-534 §1). Diesen Change darauf zu setzen hieße,
  ihn hinter der Datenlieferung anzustellen, die er selbst freigeben soll.
- **`admin_audit` speichert den Patch roh**, also künftig auch Anschriften →
  Der Befund (codex, MEDIUM) ist richtig und älter als dieser Change: E-Mail und
  Telefonnummer liegen dort seit C6 im Klartext. Hier halb zu beheben, was eine
  Entscheidung über Aufbewahrung und Löschung ist, verteilte sie auf zwei
  Changes. Gehört zu `add-dsgvo-compliance`.

## Migration Plan

1. Migration auf DEV anwenden (`pnpm db:push`), `supabase test db` mit
   Dateiliste laufen lassen.
2. Frontend gegen DEV sichtprüfen: Anschrift eintragen, ausloggen, mit einem
   zweiten Konto ohne Kontaktanfrage nachsehen, dann mit angenommener Anfrage.
3. Nach dem Merge auf PROD wie üblich über `migrate-prod` — der Dry-Run wird
   vorher gelesen.

Rücknahme: Die Spalten sind nullable und werden von nichts vorausgesetzt; ein
Zurückrollen des Frontends genügt, die Spalten dürfen stehen bleiben.

## Open Questions

- **Die Zusammensetzung der Branchenliste** ist eine inhaltliche Frage an
  Detlev. Der Change legt eine erste Fassung an; sie zu ändern ist eine
  Textänderung in `src/config/branchen.ts` und keine Migration — das ist der
  Grund für Entscheidung 6.
