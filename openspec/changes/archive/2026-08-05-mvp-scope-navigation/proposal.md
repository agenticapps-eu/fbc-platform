# Auf den Go-Live-Umfang zurückschneiden, Kompass als Filter

## Why

Am **17.08.2026** loggen sich ~70 Menschen zum ersten Mal ein. Was sie dann
sehen, entscheidet, ob die Plattform als fertiges Produkt oder als Baustelle
gelesen wird. Heute steht dem dreierlei im Weg:

1. **Die Navigation zeigt mehr, als es gibt.** Neun Menüeinträge, darunter
   `/meine-kurse` (ein Stub ohne Datenbasis), `/mitgliedschaft` (alle sind
   `impact`, es gibt nichts zu kaufen) und `/kontakte` (erreichbar über Profil
   und Chat). Jeder leere Bereich, den das Menü verspricht, ist ein gebrochenes
   Versprechen.
2. **Der Compass wirkt als eigene Seite dünn.** Die Lightweight-Variante ist
   inhaltlich identisch mit „Ich biete / Ich suche". Als eigener Menüpunkt neben
   den Formaten führt sie in eine Seite, die im MVP fast nichts tut — als
   **Filter über der Mitgliederliste** ist derselbe Inhalt sofort nützlich.
3. **Fast jede Seite ist am 17.08. leer** — und sagt das mit „Noch keine Events"
   statt mit einer Einladung. Vier Seiten haben überhaupt keinen leeren Zustand.

Dazu kommt ein toter Link im laufenden UI: `kontakte-widgets.tsx:199` verlinkt
auf `/meine-chancen`, das seit AGE-450 auf `/` umleitet.

Löst **AGE-292**, **AGE-293** (teilweise, siehe Entscheidung 3) und **AGE-447**
ab. Linear: **AGE-494**. Baut auf C1 (AGE-492) und C1a (AGE-499) auf, beide
gemerged.

**Nichts wird gelöscht.** Was rausfällt, bleibt im Code und wird nur
unerreichbar — das Zurückholen ist jeweils ein `navItem` plus das Entfernen
eines Redirects.

## What Changes

**Navigation.** Sieben Einträge in zwei Gruppen: _Entdecken_ — Start · Academy ·
Events · Mitglieder · Aktivität; _Mein Bereich_ — Mein Profil · Einstellungen.
`/kompass`, `/mitgliedschaft`, `/meine-kurse` und `/kontakte` verlieren ihren
Menüeintrag, behalten aber ihre Route (`section: "sub"`). `/einstellungen`
wandert von `service` nach `mein-bereich`; die Gruppe _Service_ entfällt, weil
sie danach leer wäre.

**`search_directory` bekommt Kategorien.** Die RPC kann heute nur `p_offering`
(**ein** Wert, kein Array, kein Gegenstück für „sucht") und liefert nur die
Booleans `has_offers`/`has_needs` zurück, nicht die Kategorien selbst. Neu:
`p_offers text[]` und `p_needs text[]` (ODER innerhalb einer Gruppe, UND
zwischen den Gruppen) sowie `offer_categories text[]` / `need_categories text[]`
im Rückgabetyp, damit die Mitgliederkarte Chips zeigen kann.

**Kompass-lite als Filter und als Profilblock.** Über der Mitgliederliste zwei
Filtergruppen mit Mehrfachauswahl; im Profil-Editor dieselben Kategorien als
Chip-Auswahl, die in `offers`/`needs` schreibt. Kein Fragebogen, kein
Erfolgsradar, keine Sein/Tun/Haben/Wirken-Skalen in diesem Pfad.

**Umbenennung Compass → Kompass, nur sichtbar.** 11 sichtbare Label-Vorkommen in
`src/**/*.tsx` und 3 in `src/**/*.ts`, plus die Routen `/compass` → `/kompass`
mit Redirect. Code-Bezeichner und **alle DB-Objekte** bleiben `compass`.

**Onboarding raus aus dem Erstlogin.** `HomeRedirect` leitet neue Mitglieder
nicht mehr in den Mini-Compass-Wizard; sie landen direkt auf der Startseite. Die
Route `/onboarding` und die Seite bleiben. An ihre Stelle tritt in C3 das
Aktivierungs-Gate.

**Empty States als eigener Task.** Sechs Seiten bekommen einen, vier bestehende
werden umformuliert — von passiver Zustandsmeldung auf Einladung mit konkreter
Handlung.

## Impact

- **`directory-search` geändert** — die feste Spaltenliste der RPC-Anforderung
  wächst um zwei Arrays, die Parameterliste um `p_offers`/`p_needs`.
  **`p_offering` bleibt erhalten**, unverändert in Bedeutung und Verhalten: der
  bestehende „Sucht / bietet"-Select nutzt es weiter, und es beantwortet eine
  andere Frage als die Kategorie-Arrays (_ob_ jemand etwas bietet, nicht _was_).
- **`matching` geändert** — `offers`/`needs` haben **drei** Schreiboberflächen
  unterschiedlicher Mächtigkeit: den reichen Editor, die neuen Chips und den
  geführten Kompass-Durchlauf. Die Abgleich-Semantik zwischen ihnen muss
  spezifiziert sein, sonst löscht eine die Daten der anderen — was der geführte
  Durchlauf heute tatsächlich tut (Entscheidung 9). Dazu die Richtigstellung des
  Sichtbarkeits-Prädikats (Entscheidung 10).
- **`potential-compass` geändert** — der Mini-Compass-Einstiegspunkt ist nicht
  mehr im Menü und nicht mehr im Erstlogin; neu ist der Lightweight-Pfad über
  dieselben Kategorien.
- **`member-profiles` erweitert** — der Profil-Editor trägt die Kategorie-Chips.
- **`design-system` erweitert** — die Navigationsform und die Regel, dass jede
  Hauptseite einen einladenden leeren Zustand trägt.
- **Eine Migration**, die `search_directory` **ersetzt** (drop + create, siehe
  Entscheidung 1) und `offers`/`needs` je um eine Herkunfts-Spalte `source` plus
  einen partiellen Unique-Index erweitert. Keine neue Tabelle, keine neue Policy.
  **`grants_test.sql` schlägt dabei an** — zwei neue Spalten berühren die
  Spalten-Grants-Assertion und den Golden-String; der Snapshot wird mitgepflegt.
- **`src/lib/database.types.ts` muss neu generiert werden**, weil sich der
  Rückgabetyp der RPC ändert.

## Decisions taken during scoping

1. **Die Migration ersetzt die Funktion, sie überlädt sie nicht** (Befund aus
   der Bestandsaufnahme, korrigiert AGE-494). AGE-494 verlangt „`create or
replace` mit Defaults, damit bestehende Aufrufer nicht brechen" — das täte
   genau das Gegenteil. Postgres identifiziert Funktionen über die
   Argumenttypliste; zwei zusätzliche `text[]`-Parameter ergeben eine **neue
   Signatur**, also eine Überladung neben der alten. Danach ist der
   Facetten-Baseline-Call `search_directory()` (`src/lib/directory.ts:122`)
   zwischen beiden Kandidaten mehrdeutig (**42725**), weil in beiden Varianten
   alle Parameter Defaults haben — auch mit Named Args. Richtig ist ein
   explizites `drop function public.search_directory(text,text,text,text,text,
text)` vor dem `create`, plus `revoke`/`grant` auf der neuen 8-stelligen
   Signatur. Bestehende Aufrufer brechen dadurch trotzdem nicht: es gibt genau
   einen (`src/lib/directory.ts`, zwei Call-Sites).

2. **Der Chip-Picker gleicht kategorie-weise ab, er ersetzt nicht die Sammlung**
   (Donald, 2026-08-04). `offers.title` und `needs.title` sind `not null`, und
   `saveMatchingProfile()` folgt dem „Replace-Collection"-Muster: alles löschen,
   alles neu einfügen. Übernähme der Chip-Picker dieses Muster, würde jede
   Speicherung im Profil-Editor die reichen Einträge aus dem Such-/Biete-Editor
   vernichten — Beschreibung, Tags, `tx_volume_band`. Stattdessen: Chip gesetzt
   und noch keine Zeile dieser Kategorie vorhanden → eine minimale Zeile; Chip
   entfernt → alle Zeilen dieser Kategorie gelöscht; Kategorien mit bestehenden
   Zeilen bleiben **unangetastet** und zeigen sich als gesetzter Chip. Der Preis
   ist benannt: „Chip entfernen" löscht auch einen reich ausgefüllten Eintrag —
   deshalb verlangt genau dieser Fall eine ausdrückliche Bestätigung, während
   das Entfernen einer reinen Minimalzeile ohne Rückfrage durchgeht.

   Der Titel der Minimalzeile kommt aus `config/matching.ts`, nicht aus
   `config/compass.ts`: die beiden Vokabulare widersprechen sich, und die
   Kompass-Fassung wäre falsch — sie nennt `kapital` „Kapital & Beteiligungen",
   während `beteiligungen` dort eine eigene Kategorie ist. Das `theme` wird
   gesetzt statt null gelassen, sonst sind chip-erzeugte Zeilen für den
   bestehenden `p_theme`-Filter unsichtbar und reiche Zeilen nicht.

   `offers` und `needs` bekommen dafür eine Herkunfts-Spalte `source`
   (`'editor'` als Default, also auch für jede bestehende Zeile; `'chip'` für
   das, was Chips und Assistent anlegen) und je einen **partiellen**
   Unique-Index auf `(profile_id, category) where source = 'chip'`. Ein voller
   Constraint schiede aus — der reiche Editor darf legitim mehrere Einträge je
   Kategorie führen. Der Index ist nicht kosmetisch: der Abgleich ist
   read-then-write, und ohne ihn könnten zwei gleichzeitige Speicherungen eine
   doppelte Zeile erzeugen, die den Potenzial-Score still aufbläht — er summiert
   `count(*)` über `offers` und `needs`
   (`20260613230000_potential_score.sql:110-111`).

   `source` entscheidet zugleich, wann die Bestätigung fällig ist: sobald die
   Kategorie eine Zeile mit `source <> 'chip'` enthält. Das strukturelle Raten
   („description und tags leer, also unwichtig") wäre falsch — eine reiche Zeile
   kann nur aus einem eigenen Titel oder einem Volumenband bestehen und würde
   dann ohne Rückfrage verschwinden.

3. **Die Sektions-Überschriften bleiben stehen** (Donald, 2026-08-04). AGE-494
   nimmt an, sie „entfallen automatisch, wenn nur noch zwei Gruppen existieren".
   Das stimmt nicht — `SidebarNav` rendert `section.title`, solange einer
   gesetzt ist. Die Entscheidung ist, _Entdecken_ und _Mein Bereich_ sichtbar zu
   lassen. **Folge: AGE-293 wird von diesem Change nur teilweise abgelöst** —
   der Teil „Sektions-Labels entfernen" ist bewusst nicht umgesetzt.

4. **Die Datenbank wird nicht umbenannt.** `compass_responses`, `compass_avg`,
   `compass_themes`, die Policies `compass_responses_select_own`/`_write_own`,
   der Index und `supabase/tests/probe_compass_responses_rls.sql` heißen weiter
   „compass". Eine Rename-Migration kostet eine Kaskade plus angepasste
   pgTAP-Tests und bringt dem Mitglied nichts. Ein Kommentar in
   `src/config/compass.ts` hält die Diskrepanz fest, damit sie später nicht als
   Fehler gelesen wird.

5. **`src/vision/` wird nicht mit umbenannt.** Das Verzeichnis trägt ~6 weitere
   „Compass"-Labels, ist aber toter Code — `App.test.tsx:69` sichert zu, dass es
   von nirgends importiert wird. Es anzufassen vergrößert den Diff ohne Wirkung.

6. **`/intern/routing` bleibt unverändert** (Donald, 2026-08-04). `RequireStaff`
   schützt sie, sie hat keinen Menüeintrag, kein Mitglied stolpert darüber.

7. **Der Redirect `/angebote-gesuche` wird auf `/kompass` mitgezogen.** Er zeigt
   heute auf `/compass`; bliebe er stehen, liefe er nach der Umbenennung über
   zwei Sprünge.

8. **Von Chips angelegte `needs` tragen kein `tx_volume_band`.** Die Spalte ist
   nullable; `routingForBand(null)` ergibt `fbc`. Große Deals bleiben damit dem
   reichen Editor vorbehalten — genau richtig, denn ein Volumenband gehört nicht
   in eine Chip-Geste.

9. **`saveCompass()` ist ein dritter Schreibpfad und wird rein additiv** (Befund
   aus der Plan-Review, in AGE-494 nicht erwähnt). `src/lib/compass.ts:200`
   leert `offers` und `needs` vollständig, bevor es die abgeleiteten Zeilen
   einfügt. `/onboarding` bleibt erreichbar — ein Kompass-Neulauf würde also
   genau den Schaden anrichten, den Entscheidung 2 für den Chip-Picker
   ausschließt. Der Assistent bekommt aber **nicht** den kategorie-weisen
   Abgleich des Editors, sondern nur dessen additive Hälfte: seine Auswahl kommt
   aus einem lokalen Entwurf statt aus den aktuellen Zeilen, und ein Neulauf mit
   frischem Entwurf läse sich als „nichts ausgewählt" und löschte alles.
   Wegnehmen bleibt Sache des Profil-Editors, wo die Auswahl aus genau den
   Zeilen geladen wird, die sie ändert. Die Datei kennt das Muster bereits:
   `profile_interests` wird ausdrücklich additiv gemergt, mit dieser Begründung
   im Kommentar daneben — für `offers`/`needs` wurde sie nur nie gezogen.

10. **Die `matching`-Spec wird bei der Gelegenheit richtiggestellt.** Sie nennt
    als Sichtbarkeitsgrenze für `offers`/`needs` noch `is_prime_plus()`; seit
    `20260715150000_six_level_model.sql:211` ist es `has_level(3)`. Streng
    genommen fremder Boden, aber es ist ein Sicherheitsvertrag, er steht in einer
    Spec, die dieser Change ohnehin ändert, und dieser Change vergrößert genau
    das, was hinter dieser Grenze preisgegeben wird.

## Non-goals

Farben, Logo, Themes (→ C1, erledigt) · das Aktivierungs-Gate, das den
Onboarding-Platz einnimmt (→ C3) · neue Profilfelder und Admin-Edit (→ C6) ·
„Meine Academy" an Stelle von `/meine-kurse` (→ C9) · die Vereinheitlichung der
drei Kategorie-Vokabulare (`compass.ts` 6+6, `matching.ts` 7+8) — dieser Change
nutzt die Kompass-Teilmenge und lässt `matching.ts` als Obermenge stehen ·
tier-abhängige Namensauflösung im Verzeichnis (offener Nachlauf aus AGE-291).
