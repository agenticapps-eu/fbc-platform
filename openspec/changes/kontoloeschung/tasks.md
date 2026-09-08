# Tasks

## 1. Datenmatrix — die Fläche vermessen, bevor etwas gebaut wird

- [x] 1.1 **Verbindliche Datenmatrix** erstellen: je Tabelle/Spalte, Objekt und
      externem Speicher die Löschaktion und, wo nichts geschieht, die Begründung.
      Sie ist das Abnahmedokument für 5.1 und gehört in den Migrationskopf
- [x] 1.2 Dabei trennen: **geleert** (Profil, Kontaktdaten, Adresse, Bilder) ·
      **anonym stehengelassen** (Beiträge, Kommentare, Nachrichten, angenommene
      Kontaktanfragen, vergangene Anmeldungen) · **freigegeben** (künftige
      Anmeldungen, geplante Beiträge, offene Kontaktanfragen) · **aufbewahrt**
      (Rechnungen, heute leer)
- [x] 1.3 Prüfen, welche der zu leerenden Spalten `not null`, `check` oder Trigger
      tragen, und für sie einen neutralen Ersatzwert festlegen
- [x] 1.4 Nachsehen, ob ein Trigger `profiles.search_doc` beim Leeren nachzieht —
      das Ergebnis entscheidet über 2.3, und der Spaltenkommentar belegt es nicht
- [x] 1.5 Objektinventar festlegen: alle Dateien des Kontos je Bucket
      (`avatars`, `covers`, `post-media`, `feedback-screenshots`), **einschliesslich
      ersetzter Avatare und Waisen** — die stehen in keiner Profilspalte.
      `event-covers` ausdrücklich entscheiden (Vorschlag: bleiben, sie gehören zur
      Veranstaltung)
- [x] 1.6 Messen, ob `storage.objects` eine Eigentümerspalte auf `auth.users`
      führt — davon hängt ab, ob Schritt 5 ohne Schritt 3 überhaupt durchläuft

## 2. Datenbank

- [x] 2.1 Migration: `profiles_id_fkey` **entfernen** — nicht ohne Kaskade neu
      setzen. `no action` verhindert die Auth-Löschung, statt sie zu erlauben (D2)
- [x] 2.2 Migration: eigener, dauerhafter **Löschzustand** (D7) — nicht
      `deleted_at` allein, weil `admin_restore_member` das zurücksetzt
- [x] 2.3 Migration: Anonymisierungs-Funktion — leert die PII-Spalten **nach
      datenmatrix.md**, setzt den Löschzustand, lässt die Inhaltstabellen
      unberührt. `search_doc` NICHT anfassen: `generated always`, sie zieht mit,
      sobald alle acht Quellspalten leer sind
- [x] 2.4 Migration: künftige Anmeldungen auf `cancelled`, geplante Beiträge
      löschen, offene Kontaktanfragen zurückziehen (D10)
- [x] 2.5 ~~Sichtbarkeits-Prädikate ergänzen~~ — **entfällt, gemessen.** Die
      Löschung setzt `deleted_at` mit, und die vorhandenen Prädikate lesen es
      bereits über `is_activated()`; auch `profiles_public` und
      `former_member_entries` hängen daran. Keine neue Regel an keiner der drei
      Stellen. Zu belegen statt zu bauen — Test 5.8
- [x] 2.6 ~~Schreibende Prädikate sperren~~ — **entfällt, gemessen.** 34 von 34
      schreibenden `public`-Policies prüfen `is_activated()`, bei
      `storage.objects` jede schreibende ebenso. Null Lücken, also nichts zu
      bauen. Festgehalten in den Zusagen 11 und 12, letztere per Mutation
      gegengeprüft (genau eine Zusage fällt)
- [x] 2.7 `admin_restore_member` verweigert den Löschzustand; die weiche Löschung
      bleibt für alle anderen Konten wiederherstellbar
- [x] 2.8 `revoke execute` für `public`, `anon` und `authenticated` ausdrücklich
      aussprechen, `grant` nur an `service_role`; geerbte Rechte reichen nicht
- [x] 2.9 Den Grants-Schnappschuss der CI nachziehen — eine neue Funktion bricht
      ihn sonst, und die Liste blind zu erweitern erteilt `anon` das Recht

## 3. Serverseite

- [ ] 3.1 Edge Function als einziger Eingang. **Verifikationsort festschreiben**
      (D4): entweder Gateway-Verifikation, die die Deployment-Konfiguration
      erzwingt, oder `getClaims()` in der Funktion — `sub` lesen ist keine Prüfung
- [ ] 3.2 Reihenfolge nach D5: sperren → Inventar → **Dateien** → anonymisieren →
      **`auth.users` zuletzt**. Ein fehlendes Objekt ist kein Fehler
- [ ] 3.3 Jeder Schritt idempotent; ein Teilfehler meldet **nicht** Erfolg
- [ ] 3.4 Fremde Ziel-ID wird **abgelehnt**, nicht ignoriert; ohne gültige Sitzung
      ablehnen, ohne etwas zu ändern
- [ ] 3.5 Schemazustand prüfen und bei unvorbereitetem Schema verweigern — die
      Reihenfolge des Ausrollens ist keine Absicherung

## 4. Oberfläche

- [ ] 4.1 Einstiegspunkt in den Einstellungen
- [ ] 4.2 Eigene Rückfrage, die die Folge benennt — nicht mit einer Berührung
      auslösbar, nicht „Sind Sie sicher?"
- [ ] 4.3 Nach der Löschung abmelden und zur Anmeldemaske führen
- [ ] 4.4 Nicht auflösbare @-Erwähnung als schlichten Text darstellen statt als
      toten Verweis (D9)
- [ ] 4.5 An der laufenden Oberfläche zeigen, in hell und navy

## 5. Nachweis

- [x] 5.1 Test gegen die Datenmatrix aus 1.1: nach der Löschung trägt keine der
      dort als „geleert" geführten Spalten noch einen Personenbezug
- [x] 5.2 Test: die Suche nach dem alten Namen findet nichts — der Volltextindex
      ist der stille Rückkanal, ohne diesen Test ist die Anonymisierung unbelegt
- [x] 5.3 Test: Beiträge, Kommentare, Nachrichten und angenommene Kontaktanfragen
      existieren nach der Löschung noch
- [x] 5.4 Test: der Gesprächspartner sieht seinen Verlauf weiter, mit
      „Ehemaliges Mitglied" statt des Namens
- [x] 5.5 Test: `auth.users` ist weg — **und** die Löschung gelingt trotz
      erhaltener Profilzeile (der Negativfall zu 2.1)
- [x] 5.6 Test: ein **vor** der Löschung gesichertes Zugriffstoken kann danach
      weder Mitgliedsdaten schreiben noch Dateien hochladen (D8). Eine Abmeldung
      im Client belegt das nicht
- [x] 5.7 Test: `admin_restore_member` verweigert ein gelöschtes Konto, stellt ein
      weich gelöschtes aber weiterhin her
- [x] 5.8 Test: das gelöschte Mitglied erscheint nicht im Verzeichnis, nicht in
      der Suche, nicht im Matching
- [ ] 5.9 Test: ~~`authenticated` und `anon` können die Anonymisierungs-Funktion
      nicht direkt rufen~~ **belegt (Zusage 13)**; offen bleibt „fremde Ziel-ID
      wird abgelehnt" — das entscheidet die Edge Function, nicht die Datenbank
- [x] 5.10 Test: künftige Anmeldung ist storniert und der Platz frei; geplanter
      Beitrag erscheint nie; vergangene Anmeldung steht anonym noch da
- [ ] 5.11 Test: ~~Wiederholung führt zu Ende (Idempotenz)~~ **belegt
      (Zusage 25)**; offen bleiben „Abbruch meldet keinen Erfolg" und „fremde
      Dateien bleiben unberührt" — beides liegt in der Edge Function
- [x] 5.12 Test (Positivkontrolle): derselbe Nachweis schlägt fehl, wenn die
      Anonymisierung nicht lief — sonst belegt die Testreihe nichts
- [x] 5.13 Alle Nachweise gegen den **lokalen** Stack, mit eigens angelegtem
      Konto; nie gegen DEV oder PROD

## 6. Ausrollen

- [ ] 6.1 Migration auf DEV ausrollen und **zurücklesen**, dass der Fremdschlüssel
      **weg** ist — nicht nur die Kaskade; `no action` sähe ähnlich aus
- [ ] 6.2 Erst danach die Edge Function deployen
- [ ] 6.3 Denselben Rückleseschritt auf **PROD**, bevor der Weg dort erreichbar ist
- [ ] 6.4 Am Gerät zeigen, dass der Weg auf iOS und Android erreichbar ist

## Out of scope (named follow-ups)

- DSAR-Export (Art. 15/20), Einwilligungs-Lebenszyklus, Audit-Log — bleiben in
  `add-dsgvo-compliance` (AGE-260). Dessen Aufgaben 2.1, 2.3, 3.1 und 5.4 sowie
  das Requirement *„Erasure respects retention duties and the auth identity"*
  sind danach hier abgedeckt und dürfen dort nicht ein zweites Mal eingeführt
  werden.
- **Freitext fremder Beiträge und Nachrichten** wird nicht umgeschrieben (D9).
- **Künftige Veranstaltungen mit gelöschtem Gastgeber** bleiben stehen und sind
  eine Admin-Aufgabe — automatisches Absagen träfe alle Angemeldeten.
- Karenzzeit/Widerrufsfenster, Bestätigungs-E-Mail, Rückbau der 35 Kaskaden auf
  `profiles`, laufende Stripe-Abos, weiche Admin-Löschung aus AGE-581.
