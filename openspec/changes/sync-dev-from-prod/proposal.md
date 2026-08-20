## Why

Linear: **AGE-576**.

Die 72 echten Mitglieder liegen auf PROD, und **kein Entwicklungsstand kommt an
sie heran**: DEV trägt 41 erfundene Personas, deren Profile fast leer sind — 26
Kontaktzeilen, **null** Anschriften, keine importierten Netzwerke, 18
Storage-Objekte gegen 125 auf PROD. Fehler, die nur an echten Daten auftreten,
treten deshalb zuerst in der Vorführung auf. Genau so wurden die Befunde vom
17.08. gefunden: Markdown-Zeichen im Verzeichnis, verlorene Absätze,
überlaufende Ortsangaben — alle an echten Datensätzen, keiner an einer Persona.

Dazu kommt ein zweiter, dringenderer Anlass. Der PROD-Neuaufbau
(`docs/prod-neuaufbau-plan.md`) verlangt als **Schritt 1**, den Import zu
sichern, „BEVOR irgendetwas gelöscht wird" — und führt das Werkzeug dafür als
„zu schreiben". `scripts/` hat keins. Solange es keins gibt, ist der Neuaufbau
ein Löschvorgang ohne Rückweg.

Beides ist dieselbe Bewegung: Daten von PROD holen. Ein Werkzeug, zwei Rollen.

## What Changes

- **Ein wiederholbarer Befehl `pnpm sync:dev`** ersetzt den Datenbestand von DEV
  durch eine Kopie von PROD — Datenbank **und** die 125 Storage-Objekte.
  Vollersatz statt Abgleich: derselbe Lauf, dasselbe Ergebnis, unabhängig davon,
  wie oft er lief. Ein zeilenweiser Abgleich müsste für jede künftig angelegte
  Tabelle `upsert`-treu bleiben und würde still veralten.
- **Der Auszug ist eine Datei und bleibt eine.** Jeder Lauf legt den Auszug
  ausserhalb des Arbeitsbaums ab, bevor er DEV anfasst. Damit entsteht die
  Sicherung für den PROD-Neuaufbau als Nebenprodukt jedes Spiegels statt als
  zweites Werkzeug, das niemand pflegt.
- **Ein ausdrücklicher Nachbereitungsschritt** stellt her, was DEV braucht und
  PROD nicht kennt: die drei `@fbcdemo.com`-Zugänge und die `staff_roles`. Ohne
  ihn nimmt der erste Vollersatz die dokumentierten Demo-Zugänge mit.
- **Nur auf Zuruf, kein Nachtlauf.** Jeder Lauf verwirft, woran auf DEV gerade
  gearbeitet wird. Ein Zeitplan kommt in Frage, wenn sich der Lauf von Hand
  bewährt hat — und ist ausdrücklich nicht Teil dieses Changes.
- **BREAKING (Spec, nicht Code):** `deployment-environments` fordert heute, das
  DEV/DEMO-Projekt trage „ausschließlich Demo-Daten". Diese Anforderung wird
  gebrochen und muss geändert werden, nicht umgangen.
- **Die Richtung ist einseitig und wird erzwungen.** PROD ist ausschließlich
  Quelle. Ein Lauf, der in die Gegenrichtung schriebe, ist kein
  Bedienungsfehler, sondern Datenverlust an echten Mitgliedern.

## Capabilities

### New Capabilities

- `environment-sync`: Wie der Datenbestand einer Umgebung in eine andere
  gelangt — Richtung, Vollständigkeit, Wiederholbarkeit, welcher Bestand am
  Ziel den Ersatz überlebt, und wo der Auszug liegt, der dabei entsteht.

### Modified Capabilities

- `deployment-environments`: Die Anforderung „Zwei getrennte Supabase-Projekte
  mit festen Rollen" bindet die Rollentrennung heute an die **Art der Daten**
  („PROD trägt ausschließlich echte Mitgliederdaten", „DEV/DEMO ausschließlich
  Demo-Daten"). Nach diesem Change trägt DEV eine Kopie echter Mitgliederdaten.
  Die Rollentrennung bleibt bestehen, ruht aber auf der **Schreibrichtung**
  statt auf dem Inhalt: PROD ist die einzige Quelle der Wahrheit, DEV ein
  ersetzbares Abbild.

## Impact

**Neu:** ein Skript unter `scripts/`, ein `sync:dev`-Eintrag in `package.json`,
eine Ablage ausserhalb des Arbeitsbaums für Auszug und Bilder.

**Berührt:** `supabase/seed/demo_seed.ts` — der Demo-Seed und der Spiegel füllen
dieselbe Datenbank und dürfen sich nicht gegenseitig überschreiben.
`docs/supabase-environments.md` (Betriebsanleitung) und
`docs/prod-neuaufbau-plan.md`, dessen Schritt 1 dieser Change erfüllt.

**Nicht berührt:** kein Anwendungscode, keine Migration, kein Deploy. Der
Spiegel ist ein Betriebswerkzeug; die ausgelieferte Fläche merkt nichts von ihm
ausser dem geänderten Inhalt.

**Datenschutz, ausdrücklich benannt:** heute kopiert der Lauf 72 Profile und
erfundene Beiträge. Nach dem Go-Live kopiert **derselbe Lauf echte Gespräche,
Nachrichten und Kontaktanfragen realer Mitglieder** in eine Datenbank mit
`mailer_autoconfirm` und drei im öffentlichen Repository dokumentierten
Zugängen. Dieser Change baut den Nachbereitungsschritt deshalb von Anfang an als
die Stelle, an der eine spätere Anonymisierung ansetzt — er löst die Frage nicht,
aber er lässt ihr einen Ort.
