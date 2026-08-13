# C6a — Adressfelder im Profil (AGE-537)

## Why

Der Import aus WordPress (C10, AGE-534) steht vor der Tür, und die Mitglieder
haben ihre vollständige Anschrift dort selbst eingetragen. Entscheidung Donald,
13.08.: **die Anschrift wird übernommen und gehört ins Profil** — mein früherer
Vorschlag, sie aus Datensparsamkeit wegzulassen, ist damit vom Tisch. Ohne
Zielspalten müsste C10 entweder Daten wegwerfen oder eine Schemaänderung
mitschleppen; C6 (AGE-498) hatte genau dafür die Regel aufgestellt, dass beim
Import nur noch ein Script zu schreiben ist.

Zweitens bliebe der Branchenfilter im Verzeichnis nach dem Import leer: in
WordPress gibt es kein Branchenfeld. Ein grob gefüllter Filter ist besser als
ein leerer.

## What Changes

- **Fünf Adressspalten auf `public.profile_contacts`** — `street`,
  `postal_code`, `city`, `state`, `country` (Vorgabe `DE`). Bewusst *nicht* auf
  `profiles`: dort wäre die Anschrift für jedes eingeloggte Mitglied lesbar.
- **Die Anschrift erbt die Freigabe von E-Mail und Telefon.** Kein neuer
  Sichtbarkeitsbegriff und keine zusätzliche Policy — `contacts_select_self_or_released`
  gibt die Zeile weiterhin nur an den Eigentümer und an eine Gegenseite mit
  angenommener Kontaktanfrage, beide Zweige an `is_activated()` gebunden.
- **Erster Mitglieder-Schreibpfad auf `profile_contacts` überhaupt.** Bis heute
  schreibt dort nur `admin_update_profile()`; ein Mitglied kann seine eigene
  Kontakt-E-Mail und Telefonnummer nicht pflegen. Der neue Kontaktblock im
  Profil-Editor deckt deshalb **Adresse plus `email` und `phone`** ab
  (Entscheidung Donald, 13.08.). Die Policies `profile_contacts_insert_own` /
  `_update_own` existieren bereits — es fehlt nur die Oberfläche.
- **`admin_update_profile()`** bekommt die fünf Felder in Weißliste und Upsert.
  `admin_get_profile()` liefert sie durch `to_jsonb(c)` bereits mit.
- **Die Anschrift erscheint in der Profilansicht** im vorhandenen
  Kontaktbereich, mit demselben Hinweis wie Telefon und E-Mail.
- **Kuratierte Branchenliste** in `src/config/`, wie die Kompass-Kategorien:
  Das Editor-Feld `branche` wird eine Auswahl statt eines Freitextfelds, und
  eine reine Zuordnungsfunktion bildet den WordPress-Freitext „Business" auf
  diese Werte ab. Aufgerufen wird sie erst von C10; hier entsteht sie mit ihren
  Tests.
- **`region` bleibt die Regionalgruppe** („FBC Standort") und wird nicht mit der
  Anschrift vermischt.

Kein **BREAKING**: alle Spalten sind nullable, das Editor-Feld `branche` behält
seinen Spaltentyp `text`.

### Was ausdrücklich *nicht* passiert

Der Client-UPDATE-Grant wird **nicht** angefasst. `profile_contacts` trägt einen
Tabellen-Grant (`grant select, insert, update … to authenticated`), keine
Spaltenliste wie `profiles` — neue Spalten sind damit automatisch
client-schreibbar. Der Abnahmepunkt aus AGE-537 ist ohne Diff erfüllt und wird
stattdessen **belegt**.

## Capabilities

### New Capabilities

Keine. Der Change erweitert bestehende Fähigkeiten.

### Modified Capabilities

- `member-profiles`: Die Anforderung „Contact data is disclosed only after an
  accepted contact request" nennt künftig die fünf Adressspalten als Teil der
  freigabepflichtigen Kontaktzeile (und korrigiert dabei die veraltete
  Spaltenliste — `website` wurde am 11.06. gedroppt). Neu hinzu kommen eine
  Anforderung für den Kontaktblock im Editor als Mitglieder-Schreibpfad und eine
  für die kuratierte Branchenliste samt Zuordnung aus Freitext.
- `admin`: Die Weißliste von `admin_update_profile()` deckt die fünf
  Adressfelder mit ab.
- `contact-requests`: „Contact data is released only on acceptance" nennt die
  Anschrift mit und hält fest, dass die Freigabe fortlaufend gilt. Neu hinzu
  kommt die Anforderung, dass die Oberfläche vor der Annahme benennt, **was**
  freigegeben wird — beide Reviewer haben unabhängig gemeldet, dass
  „Kontaktdaten werden geteilt" die Anschrift nicht mehr abdeckt.

## Impact

- **Schema**: eine forward-only Migration auf `public.profile_contacts`;
  `admin_update_profile()` per `create or replace`.
- **Tests**: `supabase/tests/rls_test.sql` (pgTAP-Beleg, dass die Anschrift ohne
  angenommene Kontaktanfrage nichts liefert), `grants_test.sql` bleibt
  unverändert — Tabellen-Grant und Spalten-Assertion decken `profile_contacts`
  nicht spaltenweise ab.
- **Texte**: die Stellen, die heute pauschal „Kontaktdaten" sagen —
  `src/components/mein-bereich/kontakte-widgets.tsx`, `MeineChancenPage`,
  `PublicProfilePage`.
- **Frontend**: `src/lib/profile.ts` (Laden/Speichern der Kontaktzeile),
  `src/components/profile/ProfileFieldsets.tsx`, `src/pages/ProfilPage.tsx`,
  `src/pages/PublicProfilePage.tsx`, `src/lib/contact-requests.ts` (Auswahl um
  die Adressspalten erweitern), `src/lib/admin-profile.ts` und
  `src/pages/AdminMitgliedPage.tsx`, neu `src/config/branchen.ts` samt
  Zuordnungsfunktion.
- **Nachgelagert**: C10 (AGE-534) ruft die Zuordnungsfunktion auf und füllt die
  Spalten; das Auftrennen von „Plz & Ort" gehört dorthin, nicht hierher.

## Nicht in diesem Change

Kartenansicht · Umkreissuche · Adressvalidierung gegen einen externen Dienst ·
das Import-Script selbst.
