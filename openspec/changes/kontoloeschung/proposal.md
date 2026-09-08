## Why

Ein Mitglied kann sein Konto heute nicht selbst löschen. Apple verlangt seit 2022,
dass ein Konto, das in der App angelegt werden kann, auch **in der App** gelöscht
werden kann — in **AGE-644** (Store-Einreichung) steht das als harte Abnahmezeile,
und ohne diesen Change ist die Einreichung blockiert. Die Datenschutzerklärung
sagt das Recht auf Löschung bereits zu (`src/content/legal/datenschutz.ts`),
eingelöst wird es heute nur auf Zuruf. Linear: **AGE-708**.

Das ist der aus **AGE-260** (DSGVO-Paket) herausgeschnittene Teil. AGE-260 steht
auf *Backlog / nach Go-Live* und hängt in Teilen an Detlev und am Anwalt; daran
soll die Store-Einreichung nicht hängen.

## What Changes

- Ein Mitglied löscht sein Konto **selbst**, aus der App heraus, hinter einer
  eigenen Rückfrage. Der Weg ist auf iOS, Android und im Web derselbe.
- Die Löschung ist **unwiderruflich** und damit etwas anderes als die weiche
  Admin-Löschung aus AGE-581, die `deleted_at` setzt und wiederherstellbar ist.
  Die vorhandenen RPCs bleiben unangetastet.
- **Anonymisieren statt kaskadierend löschen** (Donald, 08.09.): Profilfelder,
  Kontaktdaten und Adressdaten werden geleert, die Profilzeile bleibt als
  namenloser Anker stehen. Beiträge, Kommentare, Nachrichten und angenommene
  Kontaktanfragen bleiben, damit fremde Gesprächsfäden nicht zerreissen — sie
  erscheinen über die bestehende Mechanik als *„Ehemaliges Mitglied"*.
  Die Zusage gilt den **strukturierten** Feldern: Freitext, den andere Mitglieder
  geschrieben haben, wird nicht umgeschrieben (design.md D9).
- Die **`auth.users`-Identität wird entfernt** und die Sitzungen entwertet.
- **Bilddateien** des Mitglieds (`avatars`, `covers`, `post-media`,
  `feedback-screenshots`) werden mitgelöscht — heute räumt nichts diese Buckets auf.
- **BREAKING (Schema):** Der Fremdschlüssel `profiles.id → auth.users` wird
  **entfernt**, nicht abgeschwächt. Solange er kaskadiert, reisst ein
  `auth.users`-Abgang die Profilzeile und über sie **35 weitere Fremdschlüssel**
  mit — genau die Daten, die stehenbleiben sollen. Setzte man ihn nur ohne
  Kaskade neu, wäre er `no action` und würde die Löschung stattdessen
  *verhindern*. Kein Verhalten ändert sich für bestehende Konten; die Kopplung
  wandert von der Datenbank in die Löschfunktion.
- **Der Zugang endet sofort**, nicht erst mit Ablauf des Zugriffstokens: ein
  gelöschtes Konto wird serverseitig abgewiesen, auch wenn sein Token noch gilt.
- **Bindungen an andere werden gelöst:** Anmeldungen zu künftigen Veranstaltungen
  werden storniert (sonst blockiert ein namenloser Platz die Warteliste),
  geplante Beiträge gelöscht, offene Kontaktanfragen zurückgezogen.
- **Aufbewahrungs-Ausnahmen:** ausgestellte Rechnungen (HGB/AO) bleiben erhalten.

## Capabilities

### New Capabilities

- `privacy`: Betroffenenrechte. Dieser Change füllt davon **allein die Löschung** —
  Auskunft/Portabilität (Art. 15/20), Einwilligungs-Lebenszyklus und Audit-Log
  bleiben in `add-dsgvo-compliance` offen.

### Modified Capabilities

Keine. Die Sichtbarkeits-Requirements bleiben, wie sie sind: die anonymisierte
Zeile wird über das bereits vorhandene `deleted_at`-Gate unsichtbar, und
`former_member_entries()` beantwortet den Feed unverändert.

## Impact

**Datenbank**

- `profiles`: Fremdschlüssel auf `auth.users` verliert die Kaskade (zweistufig
  migrieren — siehe design.md).
- Neue Funktion, die anonymisiert; Aufruf ausschliesslich über `service_role`,
  demselben Muster folgend wie `admin_delete_member` (AGE-581): `auth.users`
  gehört GoTrue und kann von der Datenbank nicht selbst entfernt werden.

**Edge Function**

- Neue Funktion als einziger Eingang — sie entfernt `auth.users`, räumt die
  Buckets und ruft die Anonymisierung. Vorbild: `admin-set-member-ban`.

**Oberfläche**

- Einstiegspunkt in den Einstellungen, eigene Rückfrage, danach Abmeldung.

**Berührt ausserdem**

- `add-dsgvo-compliance`: dessen Aufgaben 2.1, 2.3, 3.1 und 5.4 sowie das
  Requirement *„Erasure respects retention duties and the auth identity"* sind
  danach hier abgedeckt und dürfen dort nicht ein zweites Mal eingeführt werden.
- `add-easybill-invoicing`: die Rechnungs-Ausnahme ist die Schnittstelle dorthin.

## Out of scope (named follow-ups)

- **DSAR-Export** (Art. 15/20), **Einwilligungs-Lebenszyklus**, **Audit-Log** —
  bleiben in `add-dsgvo-compliance` (AGE-260).
- **AVV, RoPA, Consent-Banner, Rechtstexte** — nicht Code, bleiben in AGE-260.
- **Löschfrist/Karenzzeit.** Die Löschung wirkt sofort; ein Widerrufsfenster wäre
  eine eigene Entscheidung.
- Die **weiche Admin-Löschung** aus AGE-581 bleibt unverändert bestehen.
