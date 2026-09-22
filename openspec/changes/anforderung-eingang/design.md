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

### 1. Schnitt: dünner Rumpf, drei reine Module

```
anforderung-eingang/
  index.ts          Deno.serve; baut Abhängigkeiten (fetch, supabase.rpc, env, now, log)
  pruefung.ts       Rumpf → Anforderung | { fehler }     (reine Funktion)
  beschreibung.ts   Anforderung + Dateiergebnisse + Datum → Markdown   (rein)
  eingang.ts        Ablauf: Schlüssel → Prüfung → Drossel → Dateien → Linear → Antwort
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

Die Reihenfolge ist: Methode → Secrets vorhanden → Schlüssel → Rumpf → Drossel →
Dateien → Linear. Der Schlüsselvergleich hasht beide Seiten mit SHA-256
(`crypto.subtle`) und vergleicht die 32-Byte-Digests per XOR-Schleife. So ist
die Laufzeit unabhängig von Länge und Inhalt. `crypto.subtle.timingSafeEqual`
gibt es in Deno nicht verlässlich.

Bei leerem Secret wird mit 500 abgelehnt und nie verglichen, denn sonst würde ein
leerer Header auf ein leeres Secret passen.

### 3. Dateien nacheinander, jeweils ganz im Speicher, mit Größenprüfung vor dem Lesen

Je Eintrag:

1. Form prüfen: Objekt mit `download_link` (https), `mime_type` aus der Liste.
   Sonst wird der Eintrag vermerkt und übersprungen.
2. `GET download_link` mit eigener Frist. Ist `Content-Length` größer als die
   Grenze, wird der Rumpf verworfen, ohne ihn zu lesen. Fehlt der Header, wird
   gestreamt gelesen und beim Überschreiten der Grenze abgebrochen.
3. `fileUpload(mime, name, bytes.length)`, dann `PUT` mit dem Puffer.
4. Ergebnis: `{ name, art: "bild" | "video", assetUrl }` oder
   `{ name, grund }`.

**Warum puffern statt durchreichen:** `fileUpload` will die Größe vorab, und ein
`PUT` auf eine signierte Speicher-URL mit gestreamtem Rumpf geht als
`Transfer-Encoding: chunked` hinaus. Das lehnen signierte URLs häufig ab. Der
Puffer macht die Größe exakt und den `PUT` langweilig.

**Warum nacheinander:** Im Speicher liegt immer nur eine Datei. Das Parallele
wäre schneller, aber dann liegen bei 10 Dateien 10 Puffer gleichzeitig im
Speicher (siehe Entscheidung 4 und die Risiken zur Zeit).

**Typ:** Maßgeblich ist `mime_type` aus dem Eintrag. Weicht der `Content-Type`
der Download-Antwort davon ab, gewinnt die Liste: beide müssen darin stehen, sonst
„unzulässiger Typ". Eine Prüfung der magischen Bytes bleibt weg, weil die Datei nur
an Linear geht und nirgends ausgeführt oder angezeigt wird, wo sie Schaden täte.

### 4. Größengrenze: **25 MB je Datei** (Vorschlag, Donald entscheidet)

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

### 5. Drossel: ein globaler Zähler der **angenommenen** Anforderungen

Neue Tabelle `public.anforderung_eingaenge (angenommen_um timestamptz)` und die
Funktion `public.anforderung_zaehlen(p_fenster interval default '1 hour',
p_grenze int default 20) returns table (anzahl int, gedrosselt boolean)`,
`security definer`, `search_path = ''`. Die Grants werden ausdrücklich
ausgesprochen: `revoke … from public, anon, authenticated`, `grant … to
service_role`. RLS ist an, eine Policy gibt es nicht, und die Tabelle bekommt
keinen Grant. Die Funktion räumt erst auf, fügt dann ein und zählt zuletzt, wie
`note_failed_activation`. Aufgerufen wird sie **nach** der Rumpfprüfung und
**vor** dem ersten Download.

**Warum das Muster hier anders gezählt wird als bei `activation_attempts`:** dort
ist das Subjekt eine IP und gezählt werden Fehlversuche. Hier ist beides
sinnlos:

- **Die IP ist die von OpenAI.** Alle Aufrufe kommen aus ChatGPTs Egress und
  teilen sich wenige Adressen mit allen anderen GPTs der Welt. Ein Zähler je IP
  würde nichts unterscheiden.
- **Fehlversuche zu zählen schützt hier nichts.** Ein Schlüssel aus 32
  Zufallszeichen lässt sich nicht erraten, und ein abgelehnter Aufruf kostet
  keinen Datenbankzugriff. Die Gefahr ist das Gegenteil: ein **gültiger**
  Schlüssel in falschen Händen oder ein GPT, der in eine Schleife läuft, und
  beides erzeugt echte Issues und Downloads.

Weil es genau einen Einreicher gibt, ist ein globaler Zähler dasselbe wie ein
Zähler je Einreicher. Die Tabelle speichert **keine IP**, damit entfällt die
DSGVO-Überlegung, die `activation_attempts` braucht.

20 je Stunde: Detlev reicht erfahrungsgemäß wenige Anforderungen am Tag ein, und
eine lange Sitzung mit „mach drei Anforderungen daraus" bleibt weit darunter.

### 6. Probelauf per Secret `ANFORDERUNG_PROBELAUF=1`

Im Probelauf läuft alles bis einschließlich der Downloads echt. `fileUpload` und
`issueCreate` entfallen, die Antwort ist 201 mit `nummer: "PROBELAUF"` und einem
`hinweis`, der sagt, dass nichts angelegt wurde. Die fertige Beschreibung steht
im Log. So lässt sich mit dem Test-GPT gegen DEV das Entscheidende messen: kommen
die Dateien an, und stimmen Typ und Größe? Und es entsteht kein Issue.

Verworfen: ein Header `x-probelauf` vom Aufrufer. Das wäre bequemer, aber ein
GPT, der einen Header setzt, lässt sich nicht verlässlich steuern, und das Ziel
soll nicht vom Aufrufer abhängen.

### 7. Tests

- `pruefung.test.ts`: jedes Pflichtfeld fehlt einmal, jede Grenze wird um eins
  überschritten, `art` ist unzulässig, und der Rumpf ist kein Objekt. Jeder
  Fehler ist ein Satz, der mit einem Punkt endet.
- `beschreibung.test.ts`: die Reihenfolge der Abschnitte, der Abschnitt
  „Bilder" fehlt ohne Dateien, Bild versus Video, nicht übertragene Dateien mit
  Grund, „Route: unklar", und ein Datum in Europe/Berlin über den
  Sommerzeitwechsel.
- `eingang.test.ts` mit einem **aufzeichnenden `fetch`-Ersatz**: 401 ohne einen
  einzigen `fetch`-Aufruf und ohne Drosselaufruf; 429 ohne Download; die
  Variablen von `issueCreate` tragen die fest verdrahteten IDs, auch wenn der
  Rumpf `teamId`/`labelIds` mitschickt; ein abgelaufener Link führt trotzdem zu
  201; der Probelauf ruft `api.linear.app` nie auf; eine zu große Datei wird
  nicht gelesen (der Ersatz zählt die gelesenen Bytes); der `PUT` trägt alle
  gelieferten Header.
- **Positivkontrolle:** zu jedem „wird nicht aufgerufen" gehört ein Test, in dem
  derselbe Ersatz den Aufruf aufzeichnet. Sonst beweist ein kaputter Ersatz jede
  Negativaussage.
- pgTAP für `anforderung_zaehlen`: die 21. Zählung wird gedrosselt, alte Einträge
  werden geräumt, `anon`/`authenticated` haben kein EXECUTE und kein SELECT auf die
  Tabelle. Dazu kommt die Dateiliste in `ci.yml` und der Golden-Snapshot von
  `grants_test` (siehe Memory: jede neue Tabelle bricht CI).
- `scripts/functions-config.test.ts`: ein Wächter, dass `anforderung-eingang`
  `verify_jwt = false` hat.
- Ein echtes Issue entsteht nur einmal, von Hand: Donalds Test-GPT gegen DEV mit
  ausgeschaltetem Probelauf.

## Risks / Trade-offs

- **[Zeit: ChatGPT bricht eine Action nach einer festen Frist ab]** → Die Frist ist
  nicht gemessen (siehe offene Frage 3). Zehn große Dateien nacheinander, jede
  heruntergeladen und wieder hochgeladen, können sie überschreiten. Dann hat
  Linear das Issue vielleicht schon angelegt, Detlev hört aber „Fehler", und der
  GPT sendet erneut. Das ergibt ein doppeltes Issue. Gegenmittel: eine
  Gesamtfrist für die Dateiarbeit (Vorschlag 30 s). Was bis dahin nicht fertig
  ist, wird mit „Zeit überschritten" vermerkt, und das Issue wird rechtzeitig
  angelegt. Doppelte führt Donald in der Triage zusammen, denn die Spec sagt
  ausdrücklich „legt an, ändert nie".
- **[Probelauf bleibt auf PROD an]** → Detlevs Anforderungen würden verschwinden,
  mit 201. Gegenmittel: der `hinweis` sagt „Probelauf", und der GPT liest ihn
  vor. `docs/secrets.md` nennt das Secret ausdrücklich nur für DEV, und die
  Hash-Prüfung nach dem Setzen zeigt, ob es auf PROD existiert.
- **[`download_link` ist ein beliebiger URL aus dem Rumpf]** → Wer den Schlüssel
  hat, kann die Function einen beliebigen https-URL laden lassen (SSRF-artig).
  Die Folge ist klein, denn die Function erreicht nichts Internes, und das
  Ergebnis landet nur als Datei in Linear. Eine Beschränkung auf OpenAI-Hosts
  wäre enger, aber die Hostnamen sind nicht gemessen (offene Frage 5).
- **[Personal API Key]** → Issues erscheinen als von Donald angelegt, und der
  Schlüssel hat Donalds volle Rechte im ganzen Workspace. Ein Leck der Function
  wäre ein Leck des Workspaces. Nachrüstbar ist eine OAuth-App mit `actor=app`
  und eingeschränktem Scope (AGE-830, offen).
- **[Linear lehnt ab, nachdem Dateien schon hochgeladen sind]** → Die Assets
  liegen verwaist in Linears Speicher. Das ist hinnehmbar, denn sie sind
  unverlinkt und privat.

## Migration Plan

1. Migration `…_anforderung_eingang_drossel.sql` (neu, forward-only) über den
   normalen Weg: DEV per CI, PROD per `migrate-prod` nach dem Merge.
2. Secrets setzen (Donald, von Hand, nach `docs/secrets.md`) und per SHA-256 gegen
   `supabase secrets list` prüfen. DEV zusätzlich `ANFORDERUNG_PROBELAUF=1`.
3. `supabase functions deploy anforderung-eingang` auf DEV, Test-GPT im
   Probelauf, dann einmal mit ausgeschaltetem Probelauf für ein echtes Issue.
4. Deploy auf PROD, danach die Übergabe an Detlev (Arbeitsauftrag, „Danach von
   Hand").

Rückweg: die Function löschen oder `ANFORDERUNG_SCHLUESSEL` rotieren, dann
erreicht keine Action mehr etwas. Die Tabelle kann stehen bleiben.

## Open Questions

1. **Capability `anforderungen` (neu) oder Delta auf `feedback-qm`?** Empfehlung:
   neu. `feedback-qm` beschreibt Feedback von **Mitgliedern**, das in
   `public.feedback` unter RLS liegt und im Admin gelesen wird. Hier kommt ein
   **Nicht-Mitglied** über ein geteiltes Geheimnis, nichts wird in der Plattform
   gespeichert, und das Ziel ist ein Fremdsystem. Als Delta müsste der Purpose von
   `feedback-qm` umgeschrieben werden, und der Eingang wäre dort ein Fremdkörper.
   Donald entscheidet.
2. **Größengrenze 25 MB** (Entscheidung 4). Donald entscheidet.
3. **Wie lange wartet ChatGPT auf eine Action?** Nicht gemessen. Davon hängen die
   Gesamtfrist und die Frage ab, ob die Dateien doch parallel geladen werden
   müssen. Messbar mit dem Test-GPT und einem künstlichen `sleep` in der
   `bildtest`-Function, bevor sie gelöscht wird.
4. **Drossel: global 20/Stunde auf angenommene Anforderungen** statt je IP auf
   Fehlversuche (Entscheidung 5). Das weicht vom Wortlaut „Muster
   `activation_attempts`" ab: die Bauform ist dieselbe, das Subjekt ein anderes.
   Donald bestätigt.
5. **Von welchem Host kommen die `download_link`s?** Der `bildtest`-Bericht hat
   den Host nicht protokolliert. Ist er bekannt und stabil, kann die Function auf
   ihn beschränken (Risiko SSRF).
6. **Antwort 502 bei Linear-Ausfall** fehlt im OpenAPI-Schema (Teil 4). Sie wird
   ergänzt. Offen ist, ob der GPT dann erneut senden soll: die Dateilinks sind
   dann womöglich abgelaufen, und ob ChatGPT beim zweiten Aufruf frische Links
   erzeugt, ist nicht gemessen.
7. **`openaiFileIdRefs` im Schema bleibt `array` von `string`** (die von OpenAI
   dokumentierte Form), obwohl Objekte kommen. Die Function parst defensiv. Ein
   Umstellen des Schemas auf Objekte könnte die Action brechen, darum
   unverändert.
