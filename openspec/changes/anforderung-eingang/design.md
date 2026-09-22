## Context

Warum es diesen Eingang gibt und was am 22.09. gemessen wurde, steht in ADR-0006.
Der Vertrag mit dem GPT (Instructions, OpenAPI-Schema) steht in
`docs/custom-gpt-anforderungen.md`. Die Zusagen stehen in AGE-830 und im
Spec-Delta `specs/anforderungen/spec.md`.

Für die Bauform gibt es Vorbilder im Repo:

- `send-activation/emails.ts` und `redeem-activation/redeem.ts`: reine Logik in
  eigenen Dateien, Abhängigkeiten werden übergeben und mit `deno test` geprüft.
  `index.ts` baut nur die echten Abhängigkeiten.
- `notify-contact-request`: ein Fremdaufrufer mit geteiltem Geheimnis und
  `verify_jwt = false`.
- `activation_attempts` + `note_failed_activation()`: gleitendes Fenster,
  RLS ohne Policy, Zugriff nur über eine DEFINER-Funktion für `service_role`.
- callbot `apps/test-page/functions/api/feedback.ts` (AGE-781): `issueCreate`
  über rohes GraphQL mit `authorization: <Personal Key>` ohne `Bearer`, die
  Antwort wird geparst statt vertraut, und ein Linear-Fehler wird zu 502 mit einem
  deutschen Satz.

Laufzeitgrenzen der Edge Functions (Supabase-Doku, per Context7 am 22.09.
gelesen): **256 MB Speicher**, 2 s CPU je Anfrage (asynchrones I/O zählt nicht),
150 s bis zur ersten Antwort.

Grenzen der ChatGPT-Action (OpenAI-Doku, am 22.09. gelesen): **45 s** für den
ganzen Aufruf, Anfrage und Antwort je unter 100.000 Zeichen, höchstens zehn
Dateien. Die Links in `openaiFileIdRefs` gelten fünf Minuten, das Beispiel der
Doku nennt den Host `files.oaiusercontent.com`.

Linear-Datei-Upload (Linear-Doku „How to upload a file to Linear", per Context7
gelesen, entspricht dem Arbeitsauftrag): `fileUpload(contentType, filename,
size)` liefert `uploadFile { uploadUrl, assetUrl, headers { key value } }`. Dann
folgt ein `PUT uploadUrl` mit `Content-Type`, `Cache-Control: public,
max-age=31536000` und **allen** gelieferten Headern. Fehlt einer, antwortet der
Speicher mit 403. Das Ergebnis ist `assetUrl`.

## Goals / Non-Goals

**Goals:**

- Ein Aufruf der Action wird zu genau einem Issue in Linear-Triage, mit allen
  Dateien, die sich laden ließen.
- Nichts, was das Modell schickt, wird geglaubt: Pflichtfelder, Grenzen und das
  Ziel werden serverseitig durchgesetzt.
- Jede Ablehnung ist ein Satz, den der GPT Detlev vorlesen kann.
- Testbar ohne echte Issues.

**Non-Goals:**

- Keine eigene Fläche im Produkt (die Sammelstelle aus AGE-680 entfällt für diesen
  Eingang).
- Kein Aktualisieren, Kommentieren oder Deduplizieren bestehender Issues.
- Keine OAuth-App mit eigenem Akteur. Das ist nachrüstbar und in AGE-830 offen.
- Keine Entscheidung über personenbezogene Daten auf Screenshots, die in AGE-830
  offen ist.
- Keine Änderung an Instructions oder Gesprächsführung des GPT.

## Decisions

### 1. Schnitt: dünner Rumpf, reine Module

```
anforderung-eingang/
  index.ts          Deno.serve; baut Abhängigkeiten (fetch, supabase.rpc, env, now, log)
  pruefung.ts       Rumpf → Anforderung | { fehler }     (reine Funktion)
  beschreibung.ts   Anforderung + Dateiergebnisse + Datum → Markdown   (rein)
  dateien.ts        ein Eintrag → { name, art, assetUrl } | { name, grund }; Fristen, Host, Signatur
  eingang.ts        Ablauf: Schlüssel → Prüfung → Drossel → Dateien → Linear → Zähler → Antwort
                    alle Seiteneffekte als übergebene Abhängigkeiten
  linear.ts         fileUpload, PUT, issueCreate über ein übergebenes fetch
  *.test.ts         deno test je Modul
```

Warum: So ist es in `send-activation` und `redeem-activation` gebaut, und die
Deno-Tests laufen dort bereits in CI. Der Ablauf in `eingang.ts` bekommt `fetch`
übergeben, so kann jeder Test Linear und die Dateilinks ersetzen, ohne dass das
Netz berührt wird.

Verworfen: `@linear/sdk`. Das Paket ist eine neue Abhängigkeit im Deno-Lockfile
(siehe Memory: Dependabot scheitert an `deno.lock`, neue Node-Abhängigkeit macht
den Deno-Job rot) und bringt für zwei Mutationen nichts. callbot kommt mit rohem
GraphQL aus.

Verworfen: `zod`. Vier Felder lassen sich von Hand prüfen, und die deutschen
Fehlersätze müsste man bei zod ohnehin je Feld selbst schreiben.

### 2. Echtheit vor allem anderen, Vergleich in konstanter Zeit

Die Reihenfolge ist: Methode → Secrets vorhanden → Schlüssel → JSON → Rumpf →
Drossel → Dateien → Linear → Zähler. Ein Header über 512 Zeichen wird vor dem
Hashen abgelehnt. Sonst werden beide Seiten mit SHA-256 (`crypto.subtle`)
gehasht und die 32-Byte-Digests per XOR-Schleife verglichen. Konstant ist damit
der **Vergleich**, nicht das Hashen eines Headers, dessen Länge der Angreifer
wählt; die Grenze von 512 Zeichen hält diesen Teil klein. Das Secret ist 32
Zufallszeichen lang (Teil 5 im GPT-Vertrag).

Bei leerem Secret wird mit 500 abgelehnt und nie verglichen, denn sonst würde ein
leerer Header auf ein leeres Secret passen.

### 3. Dateien nacheinander, mit Fristen, Hostliste und Signaturprüfung

Je Eintrag:

1. Form prüfen: Objekt mit `download_link`, `mime_type` aus der Liste. Ein
   String wird unter seinem eigenen Wert als Namen vermerkt, ein Eintrag ohne
   Namen als „Datei {n}".
2. Adresse prüfen: `https:`, Host genau `files.oaiusercontent.com`. Das ist der
   Host aus OpenAIs Doku (developers.openai.com/api/docs/actions/sending-files,
   gelesen am 22.09.). Andere Hosts werden mit ihrem Namen vermerkt.
3. `GET` mit `redirect: "manual"` und einem `AbortSignal`, das an der früheren
   von zwei Fristen abläuft: 12 s für diese Datei, 25 s für alle zusammen. Eine
   Weiterleitung (3xx) wird nicht verfolgt, sondern mit dem Zielhost vermerkt.
   Leitet OpenAI in Wirklichkeit weiter, zeigt der Probelauf auf DEV den Zielhost,
   und die Liste wird erweitert (Task 7.2).
4. Größe: Ist `Content-Length` größer als 25 MB, wird der Rumpf abgebrochen,
   ohne ihn zu lesen. Sonst wird gestreamt gelesen und beim Überschreiten der
   Grenze abgebrochen.
5. Signatur: die ersten Bytes müssen zum erklärten Typ passen (PNG `89 50 4E 47`,
   JPEG `FF D8 FF`, GIF `GIF8`, WebP `RIFF….WEBP`, MP4 und QuickTime `ftyp` an
   Byte 4). Maßgeblich ist der Inhalt, nicht der `Content-Type` der
   Download-Antwort. Die Bilder werden in Linear eingebettet und im Browser
   angezeigt, und Linear übernimmt den Typ, den wir beim `fileUpload` angeben.
   Deshalb darf nur hochgehen, was wirklich ist, was es zu sein behauptet.
6. `fileUpload(mime, name, bytes.length)`, dann `PUT` mit dem Puffer, beides
   unter derselben Frist. Die Header werden in einem `Headers`-Objekt gebaut:
   zuerst `Content-Type` und `Cache-Control`, danach Linears gelieferte Header per
   `set`. Kollidiert ein Name, gewinnt Linears signierter Wert
   (Groß-/Kleinschreibung egal, denn `Headers` normalisiert).
7. Ergebnis: `{ name, art: "bild" | "video", assetUrl }` oder
   `{ name, grund }`.

Der Name wird für Markdown und für `fileUpload` bereinigt: Steuerzeichen raus,
höchstens 100 Zeichen, `\ [ ] ( ) ! * _ \`` im Linktext mit Backslash maskiert.

**Warum puffern statt durchreichen:** `fileUpload` will die Größe vorab, und ein
`PUT` auf eine signierte Speicher-URL mit gestreamtem Rumpf geht als
`Transfer-Encoding: chunked` hinaus. Das lehnen signierte URLs häufig ab.

**Warum nacheinander:** Im Speicher liegt immer nur eine Datei. Das Blockieren
durch eine langsame erste Datei begrenzt die Frist je Datei.

**Warum diese Fristen:** ChatGPT bricht eine Action nach **45 Sekunden** ab
(Doku developers.openai.com/api/docs/actions/production, gelesen am 22.09.:
„45 seconds round trip for API calls"). Die Rechnung ist 25 s für die Dateien
plus 8 s für `issueCreate`, zusammen 33 s. Es bleiben 12 s für den Weg von
OpenAI und zurück, den Kaltstart und die Drossel. Das Versprechen „zehn Dateien
zu 25 MB" gilt deshalb nur für Dateien, die in diese Frist passen. Praktisch sind
das alle Bilder und ein bis zwei große Videos. Was nicht passt, wird vermerkt,
und das Issue entsteht.

### 4. Größengrenze: **25 MB je Datei** (entschieden 22.09.)

Rechnung gegen die 256 MB der Function:

| Posten | Größe |
|---|---|
| Download-Puffer (eine Datei, Entscheidung 3) | ≤ 25 MB |
| Kopie beim Zusammensetzen des gestreamten Lesens (nur ohne `Content-Length`) | ≤ 25 MB |
| Puffer des `PUT` in der Fetch-Schicht, schlimmstenfalls eine weitere Kopie | ≤ 25 MB |
| Laufzeit, Module, JSON, Markdown | ~ 30 MB |
| **Spitze je Aufruf** | **~ 105 MB** |

Ein Isolat kann mehr als eine Anfrage gleichzeitig bedienen. Zwei gleichzeitige
Einreichungen landen bei rund 210 MB und damit noch unter 256 MB. Bei 50 MB je
Datei wären schon zwei gleichzeitige Aufrufe über der Grenze, und das Isolat würde
mitten im Upload beendet. Dann gäbe es kein Issue und keinen Vermerk.

Was 25 MB fachlich bedeutet: jeder Screenshot und jedes erzeugte Bild passt, auch
Retina-PNGs liegen bei 2–8 MB. Eine Bildschirmaufnahme vom Mac oder iPhone passt
etwa bis 20–40 Sekunden. Längere Videos werden mit „zu groß" vermerkt, das Issue
entsteht trotzdem, und Donald fragt nach.


Nicht beziffert ist, ob `fetch` den Puffer beim `PUT` intern noch einmal
kopiert (Plan-Review, opencode). Die Rechnung oben nimmt schlimmstenfalls eine
Kopie an. Mehr als zwei gleichzeitige Aufrufe sind bei einem einzigen
Einreicher, der Anforderungen einzeln bestätigt, nicht zu erwarten.

### 5. Drossel: ein globaler Zähler der **angelegten** Issues

Neue Tabelle `public.anforderung_eingaenge (angelegt_um timestamptz not null
default now())` ohne weitere Spalten, also ohne IP und ohne Inhalt. Dazu zwei
Funktionen, beide `security definer`, `search_path = ''`, EXECUTE nur für
`service_role` (ausdrücklich `revoke … from public, anon, authenticated`):

- `anforderung_frei(p_fenster interval default '1 hour', p_grenze int default
  20) returns boolean`: zählt nur, schreibt nichts. Wird **nach** der
  Rumpfprüfung und **vor** dem ersten Download aufgerufen.
- `anforderung_vermerken(p_fenster interval default '1 hour') returns void`:
  räumt alles außerhalb des Fensters weg und fügt eine Zeile ein. Wird **nur
  nach** einem von Linear bestätigten `issueCreate` aufgerufen.

RLS ist an, eine Policy gibt es nicht, und die Tabelle bekommt keinen Grant.

**Warum getrennt prüfen und vermerken** (Plan-Review, alle drei Reviewer): wer
vor den Downloads einfügt, zählt auch 502, 429 und Probeläufe mit. Eine
Linear-Störung würde so den Eingang für eine Stunde sperren, und ein
gedrosselter Aufruf würde die Sperre verlängern. Gezählt wird, was entstanden
ist.

**Hingenommen: parallele Aufrufe können die Grenze überschreiten.** Zwei Aufrufe
bei Stand 19 sehen beide „frei" und legen beide an, dann steht der Zähler bei 21.
Eine harte Grenze bräuchte eine Reservierung mit Sperre und ein Zurücknehmen bei
Fehlschlag. Das ist viel Bau für eine Grenze, die Missbrauch nur **begrenzen**
soll: ein einziger Einreicher, der einzeln bestätigt, erzeugt keine
Parallelität, und ein Angreifer mit Schlüssel überschreitet sie höchstens um die
Zahl seiner gleichzeitigen Verbindungen. ChatGPT selbst zieht sich nach mehreren
429 zurück (Doku, production).

**Warum nicht je IP und nicht nach Fehlversuchen wie `activation_attempts`:**

- **Die IP ist die von OpenAI.** Alle Aufrufe kommen aus ChatGPTs Egress und
  teilen sich wenige Adressen mit allen anderen GPTs.
- **Fehlversuche zu zählen schützt hier nichts.** Ein Schlüssel aus 32
  Zufallszeichen lässt sich nicht erraten, und ein abgelehnter Aufruf kostet
  keinen Datenbankzugriff. Die Gefahr ist ein **gültiger** Schlüssel in falschen
  Händen oder ein GPT in einer Schleife.

Weil es genau einen Einreicher gibt, ist der globale Zähler dasselbe wie ein
Zähler je Einreicher. Ohne IP entfällt die DSGVO-Überlegung, die
`activation_attempts` braucht.

### 6. Probelauf per Secret `ANFORDERUNG_PROBELAUF=1`

Im Probelauf läuft alles bis einschließlich der Downloads und der
Signaturprüfung echt. `fileUpload`, `issueCreate` und `anforderung_vermerken`
entfallen. Die Antwort ist **200** mit `{ probelauf: true, hinweis }` ohne
`nummer`. 201 bedeutet im Vertrag „angelegt", und eine Scheinnummer könnte der
GPT als echte vorlesen (Plan-Review, codex). Im Log stehen je Datei Typ, Größe,
Host und Ergebnis, aber kein Text, kein Name und kein Link.

So lässt sich mit dem Test-GPT gegen DEV das Entscheidende messen: kommen die
Dateien an, von welchem Host, und passen Typ und Signatur?

Verworfen: ein Header `x-probelauf` vom Aufrufer. Ein GPT, der einen Header
setzt, lässt sich nicht verlässlich steuern, und das Ziel soll nicht vom Aufrufer
abhängen.

### 7. Tests

- `pruefung.test.ts`: jedes Pflichtfeld fehlt einmal, jede Grenze wird um eins
  überschritten (auch mit Nicht-BMP-Zeichen), `art` ist unzulässig, der Rumpf
  ist kein Objekt, `openaiFileIdRefs` ist keine Liste. Jeder Fehler ist ein
  ganzer Satz.
- `beschreibung.test.ts`: die Reihenfolge der Abschnitte, der Abschnitt
  „Bilder" fehlt ohne Dateien, Bild versus Video, nicht übertragene Dateien mit
  Grund, „Route: unklar", das Datum `TT.MM.JJJJ, HH:MM` in Europe/Berlin
  über den Sommerzeitwechsel, und Markdown im Dateinamen und im Einreicher bleibt
  Text.
- `dateien.test.ts`: die Form aus OpenAIs Doku als Fixture (`{ name, id,
  mime_type, download_link }`), String-Eintrag, fremder Host, 3xx, 403,
  `Content-Length` über der Grenze ohne gelesene Bytes, Strom ohne
  `Content-Length` über der Grenze, falsche Signatur, hängender GET (Frist je
  Datei), Gesamtfrist vermerkt die Nachzügler, hängender `PUT`, und
  kollidierende Header im `PUT`.
- `eingang.test.ts` mit einem **aufzeichnenden `fetch`-Ersatz** und
  Drossel-Ersatz: 401 ohne einen einzigen Aufruf, kaputtes JSON gibt 400,
  gedrosselt gibt 429 ohne Download, die Variablen von `issueCreate` tragen die
  fest verdrahteten IDs trotz fremder Felder, ein abgelaufener Link führt
  trotzdem zu 201, `anforderung_vermerken` läuft nur nach bestätigtem
  `issueCreate`, 502 bei Linear-Fehler und bei hängendem `issueCreate`, der
  Probelauf ruft `api.linear.app` nie auf und antwortet 200 ohne `nummer`, jede
  Antwort ab 400 hat `{ fehler }` als JSON, und das Log enthält weder Text noch
  Namen noch Link.
- **Positivkontrolle:** zu jedem „wird nicht aufgerufen" gehört ein Test, in dem
  derselbe Ersatz den Aufruf aufzeichnet. Sonst beweist ein kaputter Ersatz jede
  Negativaussage.
- pgTAP `anforderung_drossel_test.sql`: `anforderung_frei` ist bei 19 frei und
  bei 20 nicht, `anforderung_vermerken` räumt alte Einträge, `anon` und
  `authenticated` haben kein EXECUTE und keinen Tabellenzugriff, `service_role`
  hat EXECUTE. Die Datei kommt in die Liste in `ci.yml`. Abschnitt 6 von
  `grants_test.sql` (Funktionen für `anon`) muss **unverändert** grün bleiben;
  bricht er, fehlt ein `revoke`, und die Liste wird nicht nachgezogen.
- `scripts/functions-config.test.ts`: ein Wächter, dass `anforderung-eingang`
  `verify_jwt = false` hat.
- Ein echtes Issue entsteht nur einmal, von Hand: Donalds Test-GPT gegen DEV mit
  ausgeschaltetem Probelauf.

Die Parallelität der Drossel wird nicht getestet, weil sie ausdrücklich
hingenommen ist (Entscheidung 5).

### 8. Fest verdrahtete Linear-IDs, am 22.09. gegen Linear geprüft

| Was | Name | ID |
|---|---|---|
| Team | AgenticApps | `edf1f698-4f91-4caf-b87e-d129419a90c5` |
| Projekt | eff.bee.zee — Backlog (nach Go-Live) | `b815c05b-f6ed-413c-95a2-755cde30e916` |
| Zustand | Triage (`type: triage`) | `ee8d6b49-8806-4e92-9878-7238f5421632` |
| Label | von-detlev | `ec4878f0-7a29-42e1-b294-8ab40ef9d1d6` |
| Label | Bug (fehler) | `c7e397f3-ae8e-4cb0-8ac3-3fcd471af0e7` |
| Label | Improvement (aenderung) | `dd58d928-d4ec-4b45-b092-39d2f7a51edd` |
| Label | Feature (funktion) | `53ebd9d4-5ed8-44b4-851e-5818336af38c` |
| Label | Idee (idee) | `1eceb218-58a8-4739-a643-7eeca6583eff` |

Gelesen per Linear-MCP (`list_issue_labels`, `list_issue_statuses` für das Team,
Projekt aus AGE-830). Wird eines davon in Linear gelöscht, scheitert
`issueCreate`, und die Function antwortet 502. Das zeigt der erste echte Lauf
nach dem Deploy (Task 7.3).

## Risks / Trade-offs

- **[Doppelte Issues nach einem Abbruch]** → Scheitert die Antwort auf dem
  Rückweg zu ChatGPT, obwohl Linear angelegt hat, kann der GPT erneut senden.
  Die Fristen sind so gelegt, dass die Function unter den dokumentierten 45 s
  antwortet (Entscheidung 3). Eine Doppelerkennung (Plan-Review, codex und
  opencode) wurde verworfen: ChatGPT liefert keinen Schlüssel je Aufruf, und
  eine Erkennung über den Inhalt fängt gerade den gefährlichen Fall nicht ab, in
  dem der erste Aufruf noch läuft, während der zweite kommt. Doppelte führt
  Donald in der Triage zusammen.
- **[502 bei unbekanntem Ausgang]** → Läuft `issueCreate` in die Frist, kann das
  Issue trotzdem entstanden sein. Die Meldung sagt deshalb „nicht bestätigt" und
  nicht „nicht angekommen".
- **[Probelauf bleibt auf PROD an]** → Detlevs Anforderungen würden nicht
  angelegt. Gegenmittel: die Antwort ist 200 ohne `nummer`, der GPT hat also
  keine Nummer vorzulesen, und der `hinweis` sagt „Probelauf". `docs/secrets.md`
  nennt das Secret ausdrücklich nur für DEV, und die Hash-Prüfung nach dem
  Setzen zeigt, ob es auf PROD existiert.
- **[Download-Links aus dem Rumpf]** → Wer den Schlüssel hat, bestimmt die
  Adressen. Die Hostliste, `https` und das Nichtfolgen von Weiterleitungen
  (Entscheidung 3) schließen interne Ziele aus, auch über Umleitungen.
  DNS-Rebinding auf `files.oaiusercontent.com` setzt voraus, dass jemand OpenAIs
  DNS kontrolliert, und liegt außerhalb dieses Modells.
- **[Personenbezogene Daten]** → Screenshots können Mitgliedernamen und Fotos
  zeigen, und sie gehen an OpenAI und an Linear (USA). Das ist in AGE-830 offen,
  und die Entscheidung liegt nicht in diesem Change. **Sie muss vor der Übergabe
  an Detlev fallen** (Task 7.4), nicht vor dem Bau. Die Function selbst
  speichert nichts und loggt keine Inhalte.
- **[Personal API Key]** → Issues erscheinen als von Donald angelegt, und der
  Schlüssel hat Donalds volle Rechte im ganzen Workspace. Ein Leck der Function
  wäre ein Leck des Workspaces. Nachrüstbar ist eine OAuth-App mit `actor=app`
  und eingeschränktem Scope (AGE-830, offen).
- **[Verwaiste Assets]** → Scheitert `issueCreate` nach erfolgreichen Uploads,
  liegen die Dateien unverlinkt in Linears Speicher. Hingenommen.
- **[OpenAI ändert die Form von `openaiFileIdRefs`]** → Dann kommen Dateien als
  „nicht übertragen" an und das Issue entsteht trotzdem. Die Form ist
  dokumentiert und am 22.09. gemessen, und die Fixture in `dateien.test.ts` hält
  fest, wovon der Code ausgeht.

## Migration Plan

1. Migration `…_anforderung_eingang_drossel.sql` (neu, forward-only) über den
   normalen Weg: DEV per CI, PROD per `migrate-prod` nach dem Merge.
2. Secrets setzen (Donald, von Hand, nach `docs/secrets.md`) und per SHA-256 gegen
   `supabase secrets list` prüfen. DEV zusätzlich `ANFORDERUNG_PROBELAUF=1`.
3. `supabase functions deploy anforderung-eingang` auf DEV. Test-GPT im
   Probelauf: Kommen die Dateien vom erwarteten Host? Dann einmal ohne Probelauf
   für ein echtes Issue.
4. Deploy auf PROD, danach die Übergabe an Detlev (Arbeitsauftrag, „Danach von
   Hand"), erst nach der Datenschutzentscheidung.

Rückweg: die Function löschen oder `ANFORDERUNG_SCHLUESSEL` rotieren, dann
erreicht keine Action mehr etwas. Die Tabelle kann stehen bleiben.

## Open Questions

> **Entschieden von Donald am 22.09.:** neue Capability `anforderungen`, 25 MB
> je Datei, Teststrategie (Entscheidung 6 und 7), Drossel global 20/h, 502
> ergänzen, Schema bleibt `array` von `string`.
>
> **Nach dem Plan-Review aus der Doku beantwortet:** ChatGPTs Frist ist 45 s
> (daraus 25 s + 8 s, Entscheidung 3). Der dokumentierte Download-Host ist
> `files.oaiusercontent.com`. Die Objektform trotz `string` im Schema ist von
> OpenAI dokumentiert.

1. **Leitet `files.oaiusercontent.com` weiter?** Der Probelauf auf DEV zeigt es
   (Task 7.2). Bis dahin wird nicht gefolgt.
2. **Datenschutz** (AGE-830): muss vor der Übergabe an Detlev entschieden werden.
