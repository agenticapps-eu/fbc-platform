---
reviewers: [gemini, opencode]
models: [gemini-pro-reviewer, "hf:moonshotai/Kimi-K3.0"]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
date: 2026-09-11
---

# Change review — release-notes-in-der-aktivitaet (AGE-718)

Zwei Anbieter, beide **vor** der ersten Codezeile. `claude` ist als eigener
Anbieter dieses Hosts ausgeschlossen. `codex` wurde nicht angesetzt: er
delegiert bei Artefaktsätzen dieser Größe nachweislich an andere Arme zurück und
liefert dann kein eigenes Verdikt.

Beide Ausgaben wurden am Zeilenanfang auf `MODEL:` geprüft und auf Delegation
(`reviewer-cli.sh` im Protokoll: 0 Treffer bei beiden). Exit-Codes sind bei
diesen Armen kein Beleg.

## Reviewer: gemini (gemini-pro-reviewer)

VERDICT: REQUEST-CHANGES — 4 Befunde.

- **[HOCH]** `design.md` / `author_id` — Der zustellende Admin wird für jeden
  Kommentar zur Release-Karte benachrichtigt.
- **[MITTEL]** Trigger `coalesce(new.created_by, auth.uid())` — sind beide leer,
  bricht der `not null`-Fehler die ganze Zustellung ab, statt nur den Beitrag
  auszulassen.
- **[MITTEL]** Ausrollreihenfolge — das Frontend gehöre zuerst.
- **[NIEDRIG]** `RENAMED` — der neue Titel sei ausweichend, der Feed zeige jetzt
  drei Kartentypen.

## Reviewer: opencode (hf:moonshotai/Kimi-K3.0)

VERDICT: REQUEST-CHANGES — 10 Befunde, jeder mit Fundstelle. Der Arm hat die
tragenden Behauptungen **selbst im Repo nachgemessen**, bevor er urteilte
(sechs Migrationsdateien, `feed.ts`, die geltende Spec).

- **[HOCH]** Backfill und Trigger setzen nur `created_at`; der Feed ordnet über
  `veroeffentlicht_ab` (`default now()`). Die zitierte Event-Vorlage ist älter
  als die Spalte.
- **[HOCH]** Fehlender `MODIFIED`-Block auf *„Der Feed filtert nach
  Beitragstyp"* — die Anforderung behauptet Lückenlosigkeit der vier Typen.
- **[HOCH]** Benachrichtigungsfalle (unabhängig von gemini gefunden), zusätzlich
  mit der Beobachtung: die Oberfläche leugnet die Autorschaft, das Hinweissystem
  behauptet sie.
- **[MITTEL]** Szenario *„Eine geänderte Mitteilung zeigt sich sofort"* ist
  unbelegbar — eine zugestellte Note ist per Policy nicht mehr änderbar.
- **[MITTEL]** Kein Test gegen die doppelte Massenankündigung.
- **[MITTEL]** `security definer` / `search_path` / `revoke` im Plan nicht
  genannt; als `invoker` scheitert der Insert und rollt die Zustellung mit
  zurück.
- **[MITTEL]** `visibility` des Release-Beitrags nirgends ausgesprochen.
- **[NIEDRIG]** Volltextsuche findet die Karte nie, weil `body` leer bleibt.
- **[NIEDRIG]** „Aktivste Mitglieder" und „Beiträge von mir" zählen die
  Release-Karten dem Admin zu.
- **[NIEDRIG]** Die Analyse „Migration ohne Frontend ist harmlos" stimmt nur
  halb.

## Resolution

### Übernommen

| Befund | Was geändert wurde |
| --- | --- |
| **`veroeffentlicht_ab`** (opencode HOCH) | **Der teuerste Fund der Sitzung.** Am Repo bestätigt: `feed.ts` ordnet über `veroeffentlicht_ab`, die Spalte hat `default now()`, und der Event-Backfill vom 13.08. ist älter als sie (angelegt 29.08., damals einmalig nachgezogen). Der Plan hätte genau den Fehler erzeugt, den sein eigenes Delta ausschliesst. Trigger **und** Backfill setzen jetzt beide Zeitspalten aus `sent_at`; das Delta nennt die Spalte namentlich; ein Szenario und Task 4.2b pinnen es mit einem **alten** `sent_at`. |
| **Typfilter** (opencode HOCH) | `MODIFIED`-Block auf *„Der Feed filtert nach Beitragstyp"* ergänzt, vollständig und mit unveränderten Szenario-Titeln. „Text" prüft die Art künftig namentlich. Entschieden: eine Release-Karte ist **kein** Typ dieses Filters und bekommt auch keinen fünften Haken — sie erscheint nur im ungefilterten Feed. Der Golden-Test auf den alten Ausdruck zieht mit (Task 5.2b). |
| **Benachrichtigungsfalle** (beide, HOCH) | Am Repo bestätigt: `hinweis_auf_meinem_beitrag()` hängt an `comments` und `post_likes`, liest allein `posts.author_id`. Eigene Anforderung plus pgTAP mit Positivkontrolle (Tasks 4.7/4.8). **Bemerkenswert:** der Fehler entsteht erst aus der Kombination zweier einzeln harmloser Entscheidungen — keine der beiden Fragen an Donald hätte ihn sichtbar gemacht. |
| **`security definer`** (opencode MITTEL) | In Migrationsplan Schritt 5 und als Task 4.1b, mit der Begründung, warum `invoker` nicht nur den Beitrag, sondern die **Zustellung** scheitern liesse. |
| **`visibility`** (opencode MITTEL) | Der Auslöser setzt `members` ausdrücklich statt sich auf den Vorgabewert zu verlassen. Zwei Szenarien, darunter „Ein Ausgeloggter sieht keine Release-Karte". |
| **Unbelegbares Szenario** (opencode MITTEL) | *„Eine geänderte Mitteilung zeigt sich sofort"* ersetzt durch eine Fassung, deren WHEN eintreten kann: Änderung am **Entwurf**, Zustellung danach. Belegt dieselbe Join-Mechanik ohne einen Schreibweg zu suggerieren, den die Policy verbietet. |
| **Doppelte Ankündigung** (opencode MITTEL) | Als Task 4.9 gepinnt. `hinweis_neuer_beitrag()` prüft `kind is distinct from 'member'` und hält heute — aber ungetestet. |
| **Volltextsuche** (opencode NIEDRIG) | Als ausgesprochene Einschränkung ins Delta, mit Szenario. Nicht behoben: die Suche auf eine zweite Tabelle auszuweiten ist ein eigener Zuschnitt. |
| **Ausrollreihenfolge** (gemini MITTEL, opencode NIEDRIG) | **Der Entwurf war falsch, aber nicht wie gemini dachte.** Gemessen: `deploy.yml` läuft automatisch beim Push auf `main`, `migrate-prod.yml` nur von Hand. Die Voreinstellung ist also die gefährliche Reihenfolge — und die Folge wäre kein Schönheitsfehler, sondern ein PostgREST-Schemafehler auf die **ganze** Feed-Abfrage. Die Migration läuft jetzt als Arbeitsschritt vom Feature-Branch **vor** dem Merge (Task 8.2). Der umgekehrte Zustand ist als Betriebszusage kenntlich gemacht, nicht als Garantie. |
| **`coalesce`** (gemini MITTEL) | Das Design beschrieb den Fall bereits, das Delta nicht. Jetzt eigene Anforderung: ohne bestimmbaren Autor entsteht **kein** Beitrag und die Zustellung gelingt trotzdem. |

### Begründet nicht übernommen

**`RENAMED`-Titel** (gemini NIEDRIG). Vorgeschlagen war ein allgemeinerer Titel
(„verschiedene Beitragsarten"). Abgelehnt: der **Rumpf** dieser Anforderung
handelt ausschliesslich von der Event-Karte — Titelbild, Datum, Ort, der Bucket
`event-covers`. Ein allgemeiner Titel behauptete eine Allgemeinheit, die der
Rumpf nicht einlöst, und die Release-Karte hat eine eigene Anforderung. Der
gewählte Titel beschreibt, was dort tatsächlich steht.

**Systeminhalte in Rangzahlen** (opencode NIEDRIG). Hingenommen und als
Entscheidung 9 im Design festgehalten. Es ist eine Karte je Woche; jede
Gegenmaßnahme berührte drei Flächen, die dieser Change sonst nicht anfasst.

### Offen geblieben, bewusst

Von opencodes sechs unausgesprochenen Annahmen sind zwei **nicht** aufgelöst:

1. **Wer ist für Kommentarfäden unter Release-Karten zuständig?** Der
   Interaktionsbereich bleibt (Donalds Entscheidung), die Hinweise gehen künftig
   an niemanden — also sieht auch niemand eine Rückfrage. Das ist eine
   Betriebsfrage, keine technische, und sie gehört beobachtet statt im Code
   gelöst. Im Design unter Entscheidung 8 benannt.
2. **Die Kaskade `posts.author_id → profiles on delete cascade`** bleibt ein
   Löschpfad: verschwände das Profil des zustellenden Admins wirklich, verschwände
   die Release-Karte mit ihm. Der Produktweg löscht nicht, sondern anonymisiert
   (AGE-708) — deshalb hingenommen. opencode hat recht, dass der Pfad existiert;
   der Einwand ist notiert, nicht widerlegt.
