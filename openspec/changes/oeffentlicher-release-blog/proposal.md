# Ein öffentlicher Release-Blog, und eine Quelle für den lesbaren Text

Linear: **AGE-705**

## Why

Die Mitglieder haben **jetzt erst** Zugang. Niemand von ihnen kennt einen
Zustand „davor“ — also ist das, was gebaut werden soll, kein Änderungsprotokoll,
sondern eine Reihe erzählter Geschichten über eine App, die für jeden Leser neu
ist. Das ist Donalds Entscheidung vom 08.09. und sie schneidet diesen Change
schärfer zu als der Vorgangstext: die Frage „ab welchem Datum ist etwas eine
Änderung?“ entfällt ersatzlos.

Was bleibt, ist die Frage, an der der Vorgang selbst sagt, dass alle anderen aus
ihr folgen: **wo lebt der lesbare Text?**

### Heute wird er geschrieben und weggeworfen

Der Weg ist: ein Admin öffnet `/admin/neuigkeiten`, bekommt aus
`entwurfAus()` (`src/lib/release-entwurf.ts:19`) einen generierten Entwurf,
**schreibt ihn von Hand um** und schickt ihn ab. Die Datei sagt im Kopf selbst,
warum das nötig ist: „Der Text ist ein **Vorschlag**. Er soll überschrieben
werden — die Proposal-Sprache ist für Entwickler geschrieben.“

Der redigierte Text landet in `public.release_notes` und wird ausgespielt. Er
fliesst aber **nirgends zurück**: `src/content/release-entries.generated.ts`
wird bei jedem Build neu aus dem Archiv geschrieben und weiss von ihm nichts.

Es entsteht also pro Versand genau **eine** menschliche Übersetzung, und sie ist
danach nur noch in einer Datenbankzeile vorhanden. Eine zweite Fläche, die
denselben Text zeigen soll, müsste ihn entweder aus der Datenbank holen oder ihn
ein zweites Mal schreiben.

### Die Rohmasse ist grösser als der Vorgang sagt

| | |
| --- | --- |
| Archiv-Verzeichnisse | **75** |
| Erzeugte Einträge | **75** |
| Stichpunkte gesamt | **350** |
| davon leere Einträge (`aenderungen: []`) | **9** |

Die **350** korrigieren die **263** aus dem Vorgangstext. Der dortige Zähler
erfasst nur Stichpunkte in doppelten Anführungszeichen; die 87 in einfachen
(genau die mit deutschen „…“-Zitaten) fehlen ihm. Belegbefehle:

```
grep -cE '^      "' src/content/release-entries.generated.ts   # 263
grep -cE "^      '" src/content/release-entries.generated.ts   #  87
```

Die **9 leeren** Einträge tragen einen Titel und sonst nichts. Für sie gibt es
keine Stichpunkte, die man umformulieren könnte — sie sind Neuschrift.

### Und ein Stück des Wunsches ist schon gebaut

Der Vorgang möchte Release-Notes „nicht nur einmalig als Modal beim nächsten
Login“. Das trifft nicht zu: **`/neues` („Neu in der App“) existiert** —
`src/config/nav.ts:194`, `src/pages/NeuesPage.tsx`. Eine dauerhafte,
wiederbesuchbare Liste der zugestellten Notes, ohne Stufen-Gate, erreichbar über
die Glocke. Ihr Kopfkommentar begründet sie genau damit, dass ein Hinweis
wegklickbar ist.

Offen bleibt allein die Platzierung **in der Aktivität**, und die kostet eine
Migration (`posts.kind` ist per CHECK auf `member` und `event` geschlossen,
`20260813100000_posts_kind_event_trigger.sql:80`). Sie gehört **nicht** in
diesen Change: ihr Gewinn ist allein die Auffindbarkeit im Scrollen, und der ist
kleiner, wenn `/neues` bereits da ist.

## Entscheidungen, die diesen Change tragen

| # | Entscheidung | Von wem |
| --- | --- | --- |
| D1 | **Der lesbare Text lebt im Repository.** `release_notes` bleibt Zustellweg, nicht Quelle. | Donald, 08.09. |
| D2 | **Die Website ist ein eigenes Cloudflare-Pages-Projekt**, nicht ein Pfad in der App. | Donald, 08.09. |
| D3 | **Der geteilte Text ist Klartext, nicht Markdown.** | gemessen, siehe unten |
| D4 | **Blog zuerst, Tutorials als eigener Change.** | Donald, 08.09. |

### D3 ist gemessen, nicht gewählt

Im Repository liegt **keine Markdown-Abhängigkeit** — weder `marked` noch
`markdown-it`, `remark`, `react-markdown`, `unified` noch `mdx`:

```
grep -nE '"(marked|markdown-it|remark|react-markdown|unified|mdx)' package.json
```

Und `ReleaseNoteModal.tsx:74` rendert den Text als **Klartext**
(`whitespace-pre-line`), mit einem Kopfkommentar, der `dangerouslySetInnerHTML`
ausdrücklich als „eine Einladung“ ablehnt.

Daraus folgt zwingend: wäre die geteilte Quelle Markdown, liefen `**Sternchen**`
sichtbar ins Modal und in `/neues`. Der Text ist deshalb Klartext mit
Leerzeilen als Absatztrennung — die Website macht `<p>` daraus, die App zeigt
ihn unverändert weiter. Das spart eine Abhängigkeit **und** lässt zwei
ausgelieferte Flächen unangetastet.

## What Changes

**1 · Eine kuratierte Quelle im Repository**

Ein neues, von Hand gepflegtes Modul führt die lesbaren Geschichten: Slug,
Datum, Titel, Klartext. Es steht **neben** `release-entries.generated.ts`, nicht
darin — die generierte Datei wird bei jedem Build überschrieben und kann
Handarbeit nicht aufbewahren.

Kuratiert werden **23 Geschichten in 7 Themen** aus den 75 Archiveinträgen. Die
übrigen 52 sind Admin-Flächen, RLS-Fassungen, CI-Wächter, Spec-Korrekturen und
DEV-Datenbestand; zwei von ihnen sagen im ersten Stichpunkt selbst „Für
Mitglieder ändert sich nichts Sichtbares.“ Die Auswahl liegt im `design.md`.

**Eine Geschichte führt ein, sie berichtet keine Änderung.** Das ist die
Konsequenz aus Donalds Ausgangspunkt, und der erste Entwurf hat sie verfehlt:
seine Titel lasen sich als Änderungsmeldungen („ohne Doppelungen“, „der Umbau“,
„läuft jetzt mit“) und setzten damit genau die Erfahrung voraus, die niemand
gemacht hat. Gefunden hat das die Plan-Review. Jede Geschichte beantwortet
stattdessen drei Fragen: **wozu brauche ich das, wie geht es heute, ab welcher
Stufe.**

Der Archiveintrag ist dabei der **Anlass** und kein Beleg: er sagt, was einmal
gebaut wurde, nicht, dass es heute noch so ist. Jede Geschichte wird deshalb
gegen die geltende Anforderung und gegen die Anwendung geprüft — nicht nur die
zwei, deren Eintrag leer ist.

**2 · Ein öffentlicher Blog auf `www.effbeezee.com`**

Ein eigenes Cloudflare-Pages-Projekt, gebaut aus demselben Modul. Es erzeugt
statisches HTML: eine Übersicht und eine Seite je Geschichte.

Der Auslieferungspfad trägt **keinen Supabase-Client und keine Session**. Das
ist der Punkt von D2 und der Grund, warum es ein eigenes Projekt ist: eine
öffentliche Seite, die strukturell nicht in der Lage ist, Mitgliederdaten zu
lesen, braucht dafür keine Sorgfalt, die jemand später vergessen kann.

Damit entfällt zugleich der Lesepfad, den die DB-Variante gebraucht hätte:
`release_notes_read_sent` gilt heute `for select to authenticated`
(`20260827140000_release_notes.sql:91`). `anon` hat dort **keinen** Zugang, und
dieser Change legt auch keinen an.

**3 · Der Admin-Entwurf zieht aus der kuratierten Quelle**

Liegt zu den ausgewählten Einträgen eine kuratierte Geschichte vor, ist **sie**
der Entwurf. Nur wo keine vorliegt, bleibt es beim generierten
Entwicklertext von heute.

Das ist der Schritt, der aus zwei Quellen eine macht: die Datenbankzeile wird
zur **Abschrift eines Versands**, nicht zu einem zweiten Original. Er ist klein
— ein Funktionsaufruf in `AdminNeuigkeitenPage.tsx:147` — und ohne ihn wäre der
Blog eine dritte Stelle, an der derselbe Text getrennt gepflegt wird.

**Die Fläche bleibt überschreibbar.** Der erste Entwurf dieses Proposals
verlangte „nur eine Pflegestelle“ und behielt zugleich die ausgelieferte Zusage,
dass ein Admin frei umschreiben darf — ein Selbstwiderspruch, den die
Plan-Review gefunden hat. Aufgelöst wird er durch die Unterscheidung, die
vorher fehlte:

> **Der Blog liest die Datei. Die Zustellung ist ein Ereignis.**

Eine vor dem Versand geänderte Fassung gilt für diesen Versand, wirkt nicht in
die Datei zurück und erscheint nie im Blog. Wer die Geschichte dauerhaft ändern
will, ändert die Datei. Damit hat der Blog genau eine Quelle, ohne dass dem
Admin eine Freiheit genommen wird, die er heute hat.

**4 · Kein Personenbezug in den Geschichten**

Das Repository ist öffentlich. Eine Geschichte, die einen Namen oder eine
Adresse trägt, ist mit dem **Commit** offengelegt — nicht erst mit dem Deploy,
und kein Wächter am ausgelieferten Markup fängt das.

Das ist keine theoretische Sorge, sondern folgt aus dem Verfahren: die zwei
leeren Archiveinträge und die Prüfung aller übrigen führen den Schreiber **in
die laufende Anwendung**, und dort stehen Profile, Beiträge und Nachrichten
echter Mitglieder. Beispiele in einer Geschichte sind deshalb erfunden, und vor
dem Commit läuft ein Durchgang von Hand. Ein Mustererkenner fängt Adressen und
Telefonnummern; einen Klarnamen erkennt er nicht, und deshalb ersetzt er den
Durchgang nicht.

## Was ausdrücklich NICHT dazugehört

- **Die Tutorials.** Eigener Change, Donalds Reihenfolge. Sie ziehen ausserdem
  aus einer anderen Quelle — `openspec/specs/`, nicht dem Archiv — weil das
  Archiv eine Chronologie von *Änderungen* ist und nie sagt, was die App kann.
- **Release-Notes in der Aktivität.** Braucht eine Migration an `posts.kind`;
  begründet oben, warum der Gewinn kleiner ist als angenommen.
- **Eine Migration an `release_notes`.** Die Tabelle bleibt, wie sie ist. `body`
  trägt weiterhin den zugestellten Text — jetzt als Abschrift der kuratierten
  Geschichte statt als einziges Original.
- **Ein `anon`-Lesepfad auf `release_notes`.** Entfällt durch D2, siehe oben.
  Käme er doch, wäre er Policy **plus** Grant **plus** pgTAP-Zusage, an drei
  Stellen — das Muster von `profiles_public`.
- **`effbeezee.com` ohne `www`.** Der Apex kann bei Strato kein CNAME (gemessen,
  AGE-256), und an der Zone hängt der Mailbetrieb. Eigene Entscheidung, eigener
  Vorgang.
- **Rückwirkendes Versenden der 23 Geschichten an alle Mitglieder.** Der Blog
  ist öffentlich und braucht keinen Versand. Ob und was zugestellt wird, bleibt
  Donalds Klick — ein Rundruf erreicht alle Profile.
- **Ein Markdown-Renderer.** Begründet unter D3.
