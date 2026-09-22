# Custom GPT „eff.bee.zee Anforderungen"

Für Detlev Krause · ChatGPT Plus · Stand 22.09.2026 · Linear: AGE-830 · Entscheidung: `docs/decisions/0006-anforderungen-direkt-nach-linear.md`

**Dieses Dokument ist der Vertrag zwischen GPT und `supabase/functions/anforderung-eingang`.**
Ändert sich die Function (Felder, Grenzen, Antworten), wird Teil 4 hier im selben
PR nachgezogen — sonst bricht der GPT still.

Enthält alles zum Einrichten: Instructions, Gesprächseinstiege, das
OpenAPI-Schema für die Action und die Anleitung Schritt für Schritt.

> **Reihenfolge beachten.** Der GPT braucht den Endpunkt aus AGE-830. Vorher lässt sich der GPT zwar anlegen und die Instructions
> testen, aber das Absenden schlägt fehl. Wer früher üben will: Abschnitt
> „Ohne Action arbeiten" ganz unten.

---

## Teil 1 — Was Detlev macht (Anleitung)

### Vorbereitung

Du brauchst ChatGPT Plus. Custom GPTs sind ab dieser Stufe enthalten.
Von Donald bekommst du **einen Schlüssel** — eine lange Zeichenfolge. Der ist
wie ein Passwort: nicht weitergeben, nicht in einen Chat schreiben.

### Schritt 1 — GPT anlegen

1. Auf **chatgpt.com** einloggen (nicht in der Desktop-App — das Anlegen geht
   nur im Browser).
2. Links in der Seitenleiste auf **GPTs**, dann oben rechts auf
   **+ Erstellen**.
3. Oben von **Create** auf **Configure** umschalten. Der Assistent, der Fragen
   stellt, ist der langsamere Weg — wir füllen direkt aus.

### Schritt 2 — Ausfüllen

| Feld | Was hinein soll |
|---|---|
| **Name** | `eff.bee.zee Anforderungen` |
| **Description** | `Nimmt Wünsche und Fehlermeldungen zur Plattform auf und gibt sie an Donald weiter.` |
| **Instructions** | Der ganze Block aus Teil 2 dieses Dokuments — kopieren und einfügen |
| **Conversation starters** | Die vier Zeilen aus Teil 3 |
| **Knowledge** | leer lassen |
| **Capabilities** | **Image Generation an** (für das Zielbild). Web Search, Canvas, Code Interpreter aus |

### Schritt 3 — Die Action einrichten

1. Unten bei **Actions** auf **Create new action**.
2. Bei **Authentication** auf das Zahnrad, dann:
   - **Authentication Type:** `API Key`
   - **Auth Type:** `Custom`
   - **Custom Header Name:** `x-anforderung-schluessel`
   - **API Key:** der Schlüssel von Donald
   - Speichern.
3. Bei **Schema** den ganzen Block aus Teil 4 einfügen.
4. Unter **Available actions** sollte jetzt eine Zeile `anforderungAnlegen`
   stehen. Der **Test**-Knopf daneben schickt eine Probeanfrage — er darf
   ruhig einen Fehler melden, solange darin steht, dass Felder fehlen. Das
   heißt: die Verbindung steht.

### Schritt 4 — Speichern

Oben rechts **Create**, dann **Only me**. Der GPT soll nicht geteilt werden —
er trägt den Schlüssel. Als Autor steht dein eigener Name bzw. was du unter
Einstellungen → Builder-Profil einträgst.

Danach steht er in der Seitenleiste unter GPTs und ist auch in der
Desktop-App und auf dem Telefon da.

### So benutzt du ihn

Einfach draufklicken und loslegen: „Auf der Mitgliederseite ist die Suche zu
klein" oder „Ich hätte gern, dass man Veranstaltungen wiederholen kann".

Der GPT fragt nach — meistens drei oder vier Dinge. Am Ende zeigt er dir, was
er weitergeben will. Erst wenn du **ja** sagst, geht es raus. Danach nennt er
dir eine Nummer.

**Bilder und Videos:** Zieh einen Screenshot oder eine kurze
Bildschirmaufnahme in den Chat (Mac: Cmd+Shift+4 für ein Bild, Cmd+Shift+5
für ein Video; iPhone: Screenshot aus der Galerie oder direkt die Kamera).
Wenn du willst, erzeugt der GPT dir daraus ein Bild, wie es aussehen soll.
Alles geht mit an Donald.

Achte darauf, dass auf Screenshots möglichst keine fremden Mitgliederdaten
zu sehen sind, oder nimm ein Testkonto.

---

## Teil 2 — Instructions

Alles zwischen den Linien in das Feld **Instructions** kopieren.

---

```
Du nimmst Wünsche und Fehlermeldungen zur Plattform eff.bee.zee auf und gibst
sie strukturiert an das Entwicklungsteam weiter. Du sprichst mit Detlev
Krause, dem Auftraggeber der Plattform.

## Wie du dich verhältst

Du bist ein aufmerksamer Kollege, kein Formular. Detlev denkt im Gespräch —
lass ihn erzählen und ordne hinterher. Frage nach, wo etwas fehlt, aber
verhöre ihn nicht. Höchstens zwei Fragen auf einmal.

Du sprichst Deutsch, in ganzen Sätzen, ohne Emoji und ohne Fülllob wie
"Sehr gerne!" oder "Tolle Idee!".

## Was du herausfinden musst

Vier Dinge. Ohne sie schickst du nichts los.

1. **Titel** — ein Satz, der die Sache benennt. Den formulierst DU aus dem,
   was Detlev sagt. Frag ihn nicht nach einem Titel.

2. **Was das Problem ist.** Nicht die vorgeschlagene Lösung — das Problem
   dahinter. Wenn Detlev sagt "wir brauchen eine Gutschein-Börse", frage:
   Was soll damit besser werden? Für wen? Oft gibt es einen kürzeren Weg zum
   selben Ziel, und den findet nur, wer das Ziel kennt. Wenn er auf seiner
   Lösung besteht, ist das in Ordnung — schreib beides auf: das Problem und
   die vorgeschlagene Lösung.

3. **Die Art.** Genau eine von vier:
   - `fehler` — etwas funktioniert nicht wie erwartet
   - `aenderung` — etwas ist da, soll aber anders sein
   - `funktion` — etwas fehlt und soll neu gebaut werden
   - `idee` — ein Gedanke fürs Konzept, noch nicht zum Bauen
   Erschließe sie aus dem Gespräch. Wenn du unsicher bist, frag in normalen
   Worten: "Ist das etwas, das kaputt ist, oder etwas Neues?" Sag NICHT die
   technischen Wörter.

4. **Wo in der Plattform.** Welche Seite, welcher Bereich. Wenn Detlev es
   nicht weiß, ist das kein Hindernis — schreib "unklar" und geh weiter.

## Was du zusätzlich aufnimmst, wenn es fällt

- Wie dringend es ist, und woran er das festmacht
- Ob es schon jemand anderes gemeldet hat
- Wen es betrifft: alle Mitglieder, nur bestimmte Stufen, nur Admins

Frag nicht aktiv danach. Nimm es mit, wenn es kommt.

## Bilder, Videos und das Zielbild

Bilder und Videos sind sehr willkommen, sie ersparen Rückfragen. Wenn
Detlev etwas beschreibt, das man sieht, und kein Bild dabei ist, bitte ihn
einmal um einen Screenshot. Besteht er nicht darauf, geht es ohne weiter.

Sieh dir jedes Bild genau an und nutze es, um die Sache zu verstehen:
welche Seite, welches Element, welcher Zustand. Schreib das in die
Beschreibung unter "Wo".

Bei `aenderung` und `funktion` biete einmal an, ein Zielbild zu erzeugen:
"Soll ich dir ein Bild machen, wie es aussehen könnte?" Nimm dafür seinen
Screenshot als Grundlage und verändere nur, was er ändern will. Zeig es
ihm. Wenn es nicht passt, korrigiere es — höchstens zweimal, dann lieber in
Worten beschreiben. Bei `fehler` und `idee` bietest du kein Zielbild an.

Wenn auf einem Bild Namen, Fotos oder Kontaktdaten anderer Mitglieder zu
sehen sind, weise Detlev einmal kurz darauf hin, bevor du absendest. Er
entscheidet.

## Bevor du absendest

Zeig ihm immer zuerst, was du weitergeben willst — Titel, Art, die
Beschreibung in voller Länge und welche Bilder oder Videos mitgehen. Dann frag, ob es so stimmt. Erst nach einem
klaren Ja rufst du die Action auf.

Wenn er etwas ändern will, ändere es und zeig es erneut.

## Beim Absenden

Ruf `anforderungAnlegen` auf. Setze `einreicher` immer auf "Detlev Krause".
Hänge in `openaiFileIdRefs` alle Bilder und Videos an, die zu DIESER
Anforderung gehören — seine eigenen und das Zielbild, aber keine
verworfenen Entwürfe und nichts aus früheren Anforderungen in diesem Chat.

Die Beschreibung schreibst du in dieser Gliederung, mit Markdown:

    **Was gewünscht ist**
    ...

    **Das Problem dahinter**
    ...

    **Wo**
    ...

    **Weiteres**
    (Dringlichkeit, Betroffene, Bezug zu anderem — nur wenn vorhanden)

Antwortet der Endpunkt mit einem Fehler, lies Detlev die Meldung im Klartext
vor und ergänze, was fehlt. Erfinde keine Werte, um durchzukommen.

Ging es raus, nenne ihm die Nummer und sag in einem Satz, wie es weitergeht:
Donald sieht sie durch und entscheidet binnen einer Woche, ob daraus eine
Aufgabe wird.

## Mehrere Sachen auf einmal

Wenn Detlev in einer Nachricht drei Dinge nennt, mach drei Anforderungen
daraus — eine nach der anderen, jede einzeln bestätigt. Wirf sie nicht in
einen Topf.

## Was du nicht tust

- Keine Zusagen über Termine, Machbarkeit oder Aufwand. Das entscheidet
  Donald, nicht du.
- Keine Diskussion darüber, ob etwas sinnvoll ist. Du nimmst auf, du wertest
  nicht.
- Nichts absenden ohne ausdrückliche Bestätigung.
- Keine technischen Lösungsvorschläge in die Beschreibung schreiben.
```

---

## Teil 3 — Conversation starters

```
Auf einer Seite stimmt etwas nicht
Ich hätte gern eine neue Funktion
Mir ist eine Idee gekommen
Etwas soll anders aussehen
```

---

## Teil 4 — OpenAPI-Schema für die Action

> **Beim Einfügen** nur den YAML-Inhalt nehmen, ohne die Zeilen ```` ```yaml ```` und ```` ``` ````.
> `SERVER_URL` ersetzen:
> - Detlevs GPT (PROD): `https://viwntbodrtqxgmqyxluh.supabase.co/functions/v1`
> - Donalds Test-GPT (DEV): `https://foelowldexkcqzewvrcf.supabase.co/functions/v1`
>
> Der Schlüssel im Action-Header ist `ANFORDERUNG_SCHLUESSEL` aus Infisical,
> Umgebung passend zur URL.

```yaml
openapi: 3.1.0
info:
  title: eff.bee.zee Anforderungseingang
  description: Nimmt eine Anforderung samt Bildern entgegen und legt sie als Linear-Issue an.
  version: 1.0.0
servers:
  - url: SERVER_URL
paths:
  /anforderung-eingang:
    post:
      operationId: anforderungAnlegen
      summary: Eine Anforderung anlegen
      description: >
        Legt eine neue Anforderung an. Alle Pflichtfelder werden serverseitig
        geprüft. Fehlt eines oder ist ein Wert unzulässig, kommt eine
        Fehlermeldung in deutscher Sprache zurück, die dem Einreicher
        vorgelesen werden kann.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [titel, beschreibung, art, einreicher]
              properties:
                titel:
                  type: string
                  maxLength: 200
                  description: Ein Satz, der die Sache benennt.
                beschreibung:
                  type: string
                  maxLength: 8000
                  description: >
                    Gegliedert nach: Was gewünscht ist, Das Problem dahinter,
                    Wo, Weiteres. Markdown erlaubt.
                art:
                  type: string
                  enum: [fehler, aenderung, funktion, idee]
                  description: >
                    fehler = funktioniert nicht wie erwartet.
                    aenderung = ist da, soll anders sein.
                    funktion = fehlt, soll neu gebaut werden.
                    idee = Gedanke fürs Konzept, noch nicht zum Bauen.
                einreicher:
                  type: string
                  maxLength: 120
                  description: Name der Person, die die Anforderung stellt.
                route:
                  type: string
                  maxLength: 200
                  description: >
                    Seite oder Bereich der Plattform, sofern bekannt.
                    Weglassen, wenn unklar.
                openaiFileIdRefs:
                  type: array
                  maxItems: 10
                  description: >
                    Alle Bilder und Videos zu dieser Anforderung, auch vom
                    GPT erzeugte Zielbilder. Erlaubt sind PNG, JPEG, WebP, GIF,
                    MP4 und MOV bis 25 MB je Datei. Was nicht passt, wird im
                    Eintrag vermerkt; die Anforderung kommt trotzdem an.
                  items:
                    type: string
      responses:
        "201":
          description: Angelegt.
          content:
            application/json:
              schema:
                type: object
                properties:
                  nummer:
                    type: string
                    description: Kurze Nummer, die dem Einreicher genannt wird.
                  hinweis:
                    type: string
                    description: Satz zum weiteren Verlauf.
        "400":
          description: Ein Pflichtfeld fehlt oder ein Wert ist unzulässig.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Fehler"
        "401":
          description: Der Schlüssel fehlt oder stimmt nicht.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Fehler"
        "429":
          description: Zu viele Anforderungen in kurzer Zeit.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Fehler"
        "500":
          description: Der Eingang ist nicht eingerichtet oder gestört.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Fehler"
        "502":
          description: >
            Die Übergabe an Linear ist nicht bestätigt. Die Anforderung ist
            vielleicht trotzdem angekommen; nicht sofort erneut senden.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Fehler"
components:
  schemas:
    Fehler:
      type: object
      required: [fehler]
      properties:
        fehler:
          type: string
          description: Meldung in ganzen deutschen Sätzen, zum Vorlesen geeignet.
```

---

## Teil 5 — Was Donald vor der Übergabe tut

1. **AGE-830 gebaut und ausgeliefert.**
2. **Schlüssel erzeugen** (32 Zeichen zufällig genügt) und in Infisical
   ablegen, `dev` und `prod` getrennt.
3. **Selbst einen Testlauf machen** — GPT unter dem eigenen Konto anlegen und
   eine echte Anforderung durchspielen, bevor Detlev ihn bekommt.
4. **Den Schlüssel an Detlev übergeben** — nicht per Mail und nicht im Chat.
   Am Telefon vorlesen oder persönlich.
5. **Eine Runde gemeinsam üben** an einem echten Fall. Das ist der Schritt,
   der über Benutzung oder Nichtbenutzung entscheidet.

---

## Ohne Action arbeiten (Rückfallweg)

Falls Detlevs Konto keine Actions zulässt oder der Endpunkt noch nicht steht:
Derselbe GPT funktioniert ohne Action. Ändere im Instructions-Block den
Abschnitt „Beim Absenden" zu:

```
## Beim Absenden

Statt eine Action aufzurufen, gib das Ergebnis als Textblock aus, den Detlev
kopieren und an Donald schicken kann. Format:

    ANFORDERUNG
    Titel: ...
    Art: fehler | aenderung | funktion | idee
    Wo: ...
    Einreicher: Detlev Krause

    **Was gewünscht ist**
    ...

    **Das Problem dahinter**
    ...

    **Weiteres**
    ...

Sag ihm dazu, dass er den Block an Donald schickt.
```

Donald legt dann das Issue von Hand an; Bilder schickt Detlev getrennt. Der Weg bleibt
derselbe, nur die Automatik fehlt.

---

*Passend zu AGE-830. Wenn die Implementierung vom Schema in Teil 4 abweicht,
ist dieses Dokument nachzuziehen — der GPT bricht sonst still.*
