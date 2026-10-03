# Discover, Focus und Impact unterscheiden sich jetzt in den Rechten

Linear: **AGE-1000**

## Why

Detlevs SPEC 01 (V5 FINAL, 01.10.2026) unterscheidet die drei sichtbaren Stufen
nach Rechten: DISCOVER (Rang 4) nimmt teil, FOCUS (5) positioniert sich,
IMPACT (6) gestaltet. Gemessen am Katalog von PROD am 03.10.2026 trägt die
Plattform **keine einzige Schwelle auf Rang 5 oder 6** — jede Clubschwelle
lautet `has_level(4)`. Die Unterscheidung, die Detlevs Checkliste A3 als
go-live-kritisch führt, existiert also nicht; sie ist nicht falsch eingestellt,
sondern nicht vorhanden.

Dazu kommt Detlevs Leitregel: Funktionen „über konfigurierbare Rechte/Mindest-
freischaltungen bauen … nicht unnötig hart verdrahten". Heute steht jede
Schwelle als Zahl im Rumpf einer Policy und als `minTier` in `nav.ts`. Eine
Verschiebung bedeutet deshalb jedes Mal eine Migration **und** eine
Frontend-Änderung, an zwei Orten, die auseinanderlaufen können.

## What Changes

- Das Mitgliederverzeichnis mit Liste und Suche ist ab Impact verfügbar. Ein
  einzelnes Profil bleibt für alle Clubmitglieder lesbar — wer dir im Feed, in
  einem Event oder im Chat begegnet, ist weiter erreichbar, und eine
  Kontaktanfrage kannst du unverändert ab Discover senden.
- „Ich biete" und „Ich suche" einzustellen und die Einträge anderer zu lesen
  gehört ab Focus zur Mitgliedschaft. Dasselbe gilt für die Vorschläge.
- Eigene Events und Event-Vorlagen anzulegen gehört ab Impact zur
  Mitgliedschaft. An Events teilnehmen kannst du weiter ab Discover.
- Es wird nichts gelöscht. Bestehende Einträge und Termine bleiben erhalten,
  bleiben sichtbar und bleiben änderbar — nur das Neuanlegen hängt an der Stufe.
  Wer aufsteigt, findet alles wieder vor.
- Deine Stufe ändert sich dadurch nicht. Was sich ändert, ist nur, welche
  Funktionen an welcher Stufe hängen.

Im Einzelnen:

**Neu: Rechte sind Konfiguration.** Tabelle `public.berechtigungen
(schluessel, min_rank, beschreibung)`, geseedet mit der Matrix aus SPEC 01.
Das Prädikat `public.darf(p_schluessel text)` liest sie; ein unbekannter
Schlüssel ergibt `false` (deny-by-default). `public.meine_rechte()` liefert
dem Client die Schlüssel des Aufrufers in einem Zug.
**BREAKING — SUCHE/BIETE wird FOCUS.** `offers`/`needs`: Lesen fremder Zeilen
und Anlegen eigener verlangen `darf('suche_biete')` (Rang 5) statt Rang 4.
Eigene Zeilen bleiben lesbar, änderbar und löschbar, auch unterhalb Rang 5 —
Daten verwaisen nicht.
**BREAKING — Vorschläge werden FOCUS.** `matches`: Lesen verlangt
`darf('vorschlaege')` (Rang 5).
**BREAKING — das Verzeichnis wird IMPACT.** Liste und Suche
(`search_directory`) verlangen `darf('verzeichnis.suchen')` (Rang 6). Der
**Einzelabruf** eines Profils über `/p/:id` bleibt bei Rang 4
(`darf('profil.lesen')`) — Kontakt über Kontext bleibt möglich (Entscheidung
E4 im Go-live-Plan).
**BREAKING — Events anlegen wird IMPACT.** `events`: INSERT verlangt
`darf('events.erstellen')` (Rang 6). UPDATE und DELETE eigener Events bleiben
für bestehende Hosts offen. Heute darf **jedes aktivierte Konto** Events
anlegen; auf PROD sind alle 7 Events von einem Konto auf Rang 6 — es verwaist
nichts.
## Was NICHT Teil dieses Changes ist

**Der Rohzugriff auf Mitgliederdaten.** Die Schwelle
`verzeichnis.suchen` wirkt auf `search_directory` — die Suche. Daneben bleibt
die **Rohtabelle** als Menge lesbar: `profiles_select_self_or_discover` lautet
`… and (id = auth.uid() or has_level(4))`, also liefert ein
`select * from profiles` ohne Filter jedem Clubmitglied jedes aktivierte
Profil, auch die mit `is_public = false`. `profiles_public` ist derselbe Fall
(`security_invoker = off` plus Tabellenrecht für `authenticated`). Beides
besteht heute und wird hier nicht geöffnet — aber es heisst, dass „DISCOVER
darf nicht gezielt suchen" nach diesem Change an der Oberfläche und an der
Such-RPC gilt und **nicht** am direkten Tabellenzugriff. Der Verschluss ist
ein eigener Change (`verzeichnis-dicht`): beide Leserechte entziehen und die
gemessen **20** Abfragestellen — 13 auf `profiles`, 7 auf `profiles_public`,
alle schon heute kennungsgebunden — über kennungsgebundene Funktionen führen.
Dort hängen auch die Einbettung `membership_tiers(level_rank)` und die
`update().select()`-Ketten dran, und genau deshalb ist es kein Absatz in
diesem Change.
**Die Clubschwelle Rang 4 bleibt `has_level(4)`** und kommt NICHT in die
Konfiguration. `berechtigungen` führt ausschliesslich Rechte mit Mindestrang
5 oder 6 — also genau die, die die drei Stufen unterscheiden. Begründung:
AGE-903 hat die Clubschwelle bewusst zu **einer** Zahl für **eine** Tür
gemacht (Verzeichnis, Vollprofil, `offers`/`needs`, Kontaktanfragen,
Event-Teilnahme lagen vorher auf zwei verschiedenen Rängen). Sie je Tabelle
konfigurierbar zu machen, schafft sieben Knöpfe, die niemand dreht, und hängt
sieben funktionierende Policies für **null** Verhaltensänderung um. Der Preis
ist benannt: es gibt zwei Mechanismen, `has_level(n)` für die Tür und
`darf(schluessel)` für die Rechte dahinter.
**Schlüssel ohne Modul**: `organisation.verwalten` (5), `profil.business` (5),
`community.erstellen` (6), `projekt.erstellen` (6), `academy.anbieten` (6),
`fbc_format.initiieren` (6) entstehen als Konfiguration, damit die späteren
Changes nur noch ihre Policies daran hängen. Keine Tabellen, keine Flächen.
**Oberfläche**: ein Hook `useDarf(schluessel)` aus `meine_rechte()`. `nav.ts`
und die Gates verlieren ihr eigenes Rangwissen; wo die Datenbank ablehnt,
zeigt die Oberfläche nichts mehr an.

## Capabilities

### New Capabilities
- `berechtigungen`: Rechte als benannte Konfiguration mit Mindestrang, das
  Prädikat `darf()` als einzige Instanz für feature-bezogene Schwellen, und die
  Auskunft `meine_rechte()` an den Client.

### Modified Capabilities
- `access-control`: Die Rangschwelle ist nicht mehr einheitlich Rang 4. Sie wird
  pro Recht konfiguriert; `has_level(n)` bleibt das Rangprädikat, `darf()` tritt
  als benannte Hülle davor.
- `membership-tiers`: Die drei genannten Stufen unterscheiden sich in Rechten,
  nicht nur im Namen; welche, steht in `berechtigungen`.
- `directory-search`: Liste und Suche ab Rang 6; Einzelabruf bleibt ab Rang 4.
  Die beiden sind getrennte Zusagen und nicht länger dieselbe Schwelle. Dazu
  wird die Begründung berichtigt, mit der `profiles_public` bisher als
  unbedenklich stufenlos galt — sie war falsch.
- `matching`: Fremde `offers`/`needs` ab Rang 5, eigene anlegen ab Rang 5,
  Vorschläge ab Rang 5.
- `events`: Ein Event anzulegen verlangt `events.erstellen` (Rang 6).

## Impact

**Datenbank** (zwei neue Migrationen): Tabelle `berechtigungen`, Funktionen
`darf`, `meine_rechte`; Policies auf `events`, `offers`, `needs`, `matches`;
Funktion `search_directory`. **Nicht angefasst**: alle Policies, deren Schwelle
Rang 4 ist und bleibt, und die Leserechte auf `profiles`/`profiles_public`.

**Frontend**: `src/lib/berechtigungen.ts` (neu), `src/hooks/useDarf.ts` (neu),
`src/config/nav.ts`, `src/components/MembershipGate.tsx`,
`src/components/search/HeaderSearch.tsx`,
`src/components/community/MemberDirectory.tsx`,
`src/components/events/EventsList.tsx`, `src/pages/PublicProfilePage.tsx`,
`src/types/database.types.ts` (handgepflegt).

**Nicht betroffen**: Stripe (ruht), `platform_settings.open_contact` (AGE-930),
die Navigationsstruktur selbst (V5F-3), Academy-Angebote (V5F-4),
Event-Formate (V5F-5), Organisationen/Projekte/Communities (V5F-6).

**Bestandsfalle, die dieser Change nicht löst**: PROD trägt 74 Konten auf
`impact` und 4 auf `discover`, weil der WordPress-Import pauschal `impact`
schrieb. Die Differenzierung wirkt erst, wenn Detlev die tatsächlich bezahlte
Stufe je Mitglied liefert (Entscheidung E2). Bis dahin ist sie gebaut und
belegt, aber für fast niemanden spürbar.
