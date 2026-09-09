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

- [x] 3.1 Edge Function als einziger Eingang. **Verifikationsort festschreiben**
      (D4): entweder Gateway-Verifikation, die die Deployment-Konfiguration
      erzwingt, oder `getClaims()` in der Funktion — `sub` lesen ist keine Prüfung
- [x] 3.2 Reihenfolge nach D5: sperren → Inventar → **Dateien** → anonymisieren →
      **`auth.users` zuletzt**. Ein fehlendes Objekt ist kein Fehler
- [x] 3.3 Jeder Schritt idempotent; ein Teilfehler meldet **nicht** Erfolg
- [x] 3.4 Fremde Ziel-ID wird **abgelehnt**, nicht ignoriert; ohne gültige Sitzung
      ablehnen, ohne etwas zu ändern
- [x] 3.5 Schemazustand prüfen und bei unvorbereitetem Schema verweigern — die
      Reihenfolge des Ausrollens ist keine Absicherung

## 4. Oberfläche

- [x] 4.1 Einstiegspunkt in den Einstellungen
- [x] 4.2 Eigene Rückfrage, die die Folge benennt — nicht mit einer Berührung
      auslösbar, nicht „Sind Sie sicher?"
- [x] 4.3 Nach der Löschung abmelden und zur Anmeldemaske führen
- [x] 4.4 Nicht auflösbare @-Erwähnung als schlichten Text darstellen statt als
      toten Verweis (D9) — **war bereits so gebaut**, `CommunityFeed` rendert
      einen `<span>` statt `<Link>`. Nur der Beleg fehlte; Zusage ergänzt und
      per Mutation gegengeprüft
- [x] 4.5 An der laufenden Oberfläche zeigen, in hell und navy — 09.09. gegen den
      lokalen Stack mit einem eigens angelegten Wegwerf-Konto (danach entfernt,
      `.env.local` und der vite-Prozess ebenso). Gesehen: die Karte als letzte
      der Einstellungsseite, die zweistufige Rückfrage mit beiden Absätzen,
      *Abbrechen* zurück in den Ausgangszustand — je in `hell` und `navy`,
      umgeschaltet über den eigenen Schalter „Dunkles Design (Navy)".
      **Der Inhalt sieht in beiden Varianten gleich aus, und das ist richtig:**
      `navy` färbt nur den Rahmen (`src/index.css:208`, Entscheidung 04.08.,
      kein Nachtmodus). Sichtbar unterscheiden sich allein die
      `secondary`-Knöpfe (*Konto löschen* im Ausgangszustand, *Abbrechen* in der
      Rückfrage) — sie sitzen bewusst auf den Chrome-Tokens
      (`src/components/ui/button.tsx:20`) und sind in `navy` dunkelblau gefüllt
      statt hell umrandet. Die endgültige Löschung wurde **nicht** ausgelöst

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
- [x] 5.9 Test: `authenticated` und `anon` können die Anonymisierungs-Funktion
      nicht direkt rufen (pgTAP 13); fremde Ziel-ID wird abgelehnt statt
      ignoriert (Deno `pruefeAuftrag`)
- [x] 5.10 Test: künftige Anmeldung ist storniert und der Platz frei; geplanter
      Beitrag erscheint nie; vergangene Anmeldung steht anonym noch da
- [x] 5.11 Test: Wiederholung führt zu Ende (pgTAP 25); ein Teilerfolg meldet
      207 statt 200 (Deno `antwortFuer`); geräumt wird nur unterhalb von
      `<uid>/`, fremde Dateien sind unerreichbar (Deno `objektPfade`)
- [x] 5.12 Test (Positivkontrolle): derselbe Nachweis schlägt fehl, wenn die
      Anonymisierung nicht lief — sonst belegt die Testreihe nichts
- [x] 5.13 Alle Nachweise gegen den **lokalen** Stack, mit eigens angelegtem
      Konto; nie gegen DEV oder PROD

## 6. Ausrollen

- [x] 6.1 Migration auf DEV ausrollen — `migrate-dev` grün im Deploy-Lauf zu #373
- [x] 6.2 Edge Function deployt — `konto-loeschen` auf PROD `ACTIVE`, Version 1,
      **`verify_jwt: true`** (die dritte Fläche eigens gegengeprüft, sie wird von
      keinem Migrationsschritt miterledigt)
- [x] 6.3 PROD zurückgelesen (09.09., Supabase-MCP, read-only) — Fremdschlüssel
      auf `auth.users`: **0**, also WEG und nicht `no action`; `erased_at` da;
      `konto_anonymisieren` da mit Schemawächter; `admin_restore_member` trägt den
      `erased_at`-Riegel; **0** Grants für anon/authenticated/PUBLIC, `service_role`
      darf; die 35 Fremdschlüssel auf `profiles` unverändert
- [x] 6.4 Am Gerät zeigen, dass der Weg auf iOS und Android erreichbar ist —
      09.09. auf beiden. **Android** (Pixel, `com.effbeezee.app`) per `adb`
      gefahren: Menü → Einstellungen → Karte *Konto löschen* am Fuss der Seite,
      Tippen auf *Konto löschen* klappt die Rückfrage mit beiden Absätzen auf,
      *Konto endgültig löschen* und *Abbrechen* stehen bei dieser Breite
      nebeneinander ohne Umbruch. **iOS** (iPhone 17 Pro, iOS 26.6,
      `com.effbeezee.app` 1.0 (1)): von Donald am Gerät nachvollzogen, Bild
      gleich wie Android. Nebenbefund, der für den Store zählt: die Karte war
      auf beiden Geräten **ohne Neuinstallation** da — das ausgelieferte
      capgo-Bündel trägt sie bereits. Verlassen wurde die Seite über die
      Systemgeste, nicht über einen Knopf; **die endgültige Löschung wurde auf
      keinem Gerät ausgelöst** (beide Konten sind echt)

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
