## ADDED Requirements

### Requirement: Die Domain weist beide Plattformen aus

Das System SHALL unter `app.effbeezee.com` zwei Verifizierungsdateien
ausliefern: `/.well-known/apple-app-site-association` für iOS und
`/.well-known/assetlinks.json` für Android.

Beide SHALL aus `public/.well-known/` stammen und damit demselben Weg folgen wie
jedes andere statische Gut der Anwendung. Gemessen am 11.09.: Vite kopiert das
Punktverzeichnis unverändert nach `dist/`.

Die Datei `apple-app-site-association` trägt **keine Dateiendung**. Das System
SHALL ihr über `public/_headers` den Inhaltstyp `application/json` zuweisen.
Apple lehnt sie andernfalls ab, und die Ablehnung ist an der ausgelieferten
Datei nicht zu sehen.

Der SPA-Fallback `/*  /index.html  200` SHALL unverändert bleiben. Statische
Dateien haben bei Cloudflare Pages Vorrang vor der Catch-all-Regel; die Regel zu
ändern hiesse, den Deep-Link-Weg im Browser zu brechen, um ihn in der App zu
öffnen.

**Eine Prüfung dieser Anforderung SHALL den Rumpf lesen, nicht den Status.**
Vor dieser Änderung antworteten beide Adressen mit **HTTP 200** und lieferten
die Startseite — zeichengleich mit `/`, 7986 Bytes, `text/html`. Ein Test, der
auf `200` prüft, war grün, bevor es die Dateien gab.

#### Scenario: Beide Dateien sind als sie selbst abrufbar

- **WHEN** `/.well-known/apple-app-site-association` und
  `/.well-known/assetlinks.json` unter der Live-Domain abgerufen werden
- **THEN** antworten beide mit gültigem JSON, das die App-Kennung nennt, und
  **nicht** mit dem Rumpf der Startseite

#### Scenario: Die endungslose Datei trägt den richtigen Inhaltstyp

- **WHEN** `/.well-known/apple-app-site-association` abgerufen wird
- **THEN** ist der Inhaltstyp `application/json`

#### Scenario: Der Browserweg bleibt unberührt

- **WHEN** eine beliebige Anwendungsroute im Browser aufgerufen wird
- **THEN** liefert sie weiterhin die Startseite mit Status 200, und das
  Client-Routing löst sie auf

### Requirement: Die App meldet die Domain auf beiden Plattformen an

Das System SHALL auf iOS `com.apple.developer.associated-domains` mit
`applinks:app.effbeezee.com` führen, und auf Android **einen** `intent-filter`
mit `android:autoVerify="true"`, der `VIEW`, `DEFAULT` und `BROWSABLE` trägt,
`android:scheme="https"` und `android:host="app.effbeezee.com"`.

**Beide Plattformen SHALL dieselbe Pfadmenge beanspruchen** — und zwar mit
derselben Weite. Der `intent-filter` SHALL die vier Pfade einschränken und NOT
die ganze Domain beanspruchen. Ein Pfad, der auf `/` endet, SHALL als
`android:pathPrefix` stehen; ein Pfad ohne `/` am Ende ist eine einzelne Route
und SHALL als `android:path` stehen.

Die Unterscheidung ist nicht Feinschliff: `pathPrefix="/aktivierung"` träfe
auch `/aktivierungsfeier`, während die AASA daneben exakt bleibt und das
Client-Routing den Pfad verwirft. Android öffnete dann die App, der Router
wiese die Adresse ab, und das Mitglied säße in einer App, die nichts tut,
während iOS den Browser öffnet — dieselbe Asymmetrie wie unten, nur eine Ebene
tiefer und schwerer zu sehen.

Ohne diese Einschränkung beansprucht Android jede Adresse des Hosts, während
AASA auf vier Pfade begrenzt: ein Passwort-Link, `/login` oder eine künftige
Seite öffnete dann auf Android die App und auf iOS den Browser. Diese
Asymmetrie hat niemand entschieden, und der Zuhörer im Client fängt sie nicht
auf — er lässt die App geöffnet und leer stehen, statt den Browser den Link
bedienen zu lassen.

Die Fähigkeit *Associated Domains* SHALL an der App-ID im Apple-Portal aktiv
sein. Fehlt sie, greift die automatische Signierung zum Wildcard-Profil, und das
kann den Eintrag nicht tragen — dieselbe Mechanik, die `aps-environment` beim
Push erzwungen hat.

Ein eigenes URL-Schema SHALL NOT an die Stelle der Universal Links treten. Ein
Schema öffnet nichts, wenn die App fehlt, und der Aktivierungslink erreicht
gerade die Menschen, die sie noch nicht haben.

#### Scenario: Ein geteilter Link öffnet die installierte App

- **WHEN** ein Mitglied auf einem Gerät mit installierter App einen Link auf
  `/events/:id` aus einer Mail oder aus einer Nachricht öffnet
- **THEN** öffnet sich die App auf dem Event, nicht der Browser

#### Scenario: Ohne App führt derselbe Link auf die Website

- **WHEN** derselbe Link auf einem Gerät ohne installierte App geöffnet wird
- **THEN** öffnet sich die Website und führt den Vorgang zu Ende

### Requirement: Der Aktivierungsweg hat Vorrang vor jeder Werbung für die App

Das System SHALL den Aktivierungsvorgang auf `/aktivierung` **nicht** durch
einen Hinweis auf die App verstellen — weder durch ein Banner, noch durch ein
Overlay, noch durch eine Zwischenseite.

Der Aktivierungslink ist für viele Mitglieder der **erste** Kontakt mit der
Plattform. Wer dort zuerst zum Installieren aufgefordert wird, bricht ab, und
die Einladung ist verbraucht. Erst aktivieren lassen, dann fragen.

#### Scenario: Die Aktivierung läuft ohne Umweg durch

- **WHEN** ein eingeladenes Mitglied ohne installierte App seinen
  Aktivierungslink öffnet
- **THEN** steht der Aktivierungsvorgang unverstellt auf dem Schirm, und kein
  Hinweis auf die App liegt davor

### Requirement: Die geöffnete Adresse erreicht das Client-Routing

Das System SHALL eine Adresse, mit der die App geöffnet wurde, in den Pfad
übersetzen und dorthin navigieren. Das gilt für den Kaltstart wie für eine
bereits laufende App.

Der Zuhörer SHALL stehen, sobald die Hülle steht, und NOT erst nach dem
Anmelden. Ein Kaltstart aus einem Link heraus trifft sonst ein, bevor jemand
zuhört, und der Sprung fällt genau dann aus, wenn er am meisten bedeutet —
dieselbe Begründung, aus der `pushZielZuhoerer` früh steht.

**Die Übersetzung SHALL `pathname`, `search` UND `hash` mitführen.** Der
Aktivierungs-Token steht im **Fragment** (`/aktivierung#token=…`), nicht im
Query. Eine Übersetzung, die nur die ersten beiden Teile nimmt, öffnet die App
auf dem Aktivierungspfad **ohne Token** — und zwar auf genau dem Weg, der am
teuersten ist.

Eine Adresse, die zu keinem bekannten Pfad gehört, SHALL die App dort lassen, wo
sie ist. Ein Sprung auf gut Glück wäre schlechter als keiner.

Die Menge der bekannten Pfade SHALL **einmal** ausgesprochen sein; AASA und
Manifest SHALL im Kommentar darauf verweisen. Vier Pfade an drei Stellen laufen
sonst auseinander, und die Abweichung zeigt sich erst am Gerät.

#### Scenario: Ein Kaltstart aus dem Link landet am Ziel

- **WHEN** die App geschlossen ist und ein Link auf `/chat/:threadId` geöffnet
  wird
- **THEN** startet die App und steht in dieser Unterhaltung, nicht auf der
  Startseite

#### Scenario: Eine laufende App springt ans Ziel

- **WHEN** die App im Hintergrund läuft und ein Link auf `/p/:id` geöffnet wird
- **THEN** steht sie auf diesem Profil

#### Scenario: Der Aktivierungs-Token überlebt die Übersetzung

- **WHEN** die App über `/aktivierung#token=…` geöffnet wird
- **THEN** steht der Aktivierungsvorgang mit diesem Token bereit, das Fragment
  ist also nicht verlorengegangen

#### Scenario: Eine unbekannte Adresse bewegt nichts

- **WHEN** die App über eine Adresse geöffnet wird, die zu keinem bekannten Pfad
  gehört
- **THEN** bleibt die Anzeige, wo sie war

### Requirement: Das Ziel überlebt die Anmeldung

Das System SHALL ein Mitglied, das über einen Link auf eine geschützte Fläche
kommt und nicht angemeldet ist, nach dem Anmelden an dieses **ursprüngliche
Ziel** führen und NOT auf der Startseite abladen.

Browser und App führen getrennte Sitzungsspeicher. Wer im Browser angemeldet
ist, ist es in der App nicht — das ist keine Störung, sondern die Bauart. Ohne
Zielerhaltung endet jeder Link aus einer Nachricht auf der Startseite, und das
Mitglied sucht die Unterhaltung von Hand.

Beim **Aktivierungs-Token** SHALL das nicht greifen: das Token trägt die
Identität selbst, es gibt nichts wiederherzustellen.

**Das erhaltene Ziel SHALL ein anwendungsinterner Pfad sein.** Das System SHALL
jedes Ziel verwerfen, das ein Schema, eine Host-Angabe oder ein führendes `//`
trägt, und in diesem Fall auf die Startseite führen.

Ohne diese Verengung ist die Zielerhaltung eine **offene Weiterleitung**: wer
einen Link baut, der auf die Anmeldung zeigt und ein fremdes Ziel mitführt,
lässt die Anwendung nach erfolgreicher Anmeldung auf eine fremde Seite
weiterleiten — unter dem Vertrauen, das die Anwendung beim Mitglied geniesst,
und im gefährlichsten Moment, nämlich direkt nach der Eingabe der Zugangsdaten.
Die Zielerhaltung existiert für Deep Links; ein fremder Host ist nie einer.

Das Ziel SHALL **nicht** über die Adresse der Anmeldeseite reisen. Ein Ziel im
Query steht in jedem Zugriffsprotokoll und in jedem Verlauf; der Weg über den
Navigationszustand hinterlässt keine Spur.

Ein angemeldetes, aber **nicht aktiviertes** Konto SHALL sein Ziel ebenfalls
behalten. Das folgt heute aus der Bauart — die Aktivierungswand tauscht den
gerenderten Baum aus und navigiert NOT, die Adresse bleibt also stehen — und
SHALL als Zusage geprüft sein, statt sich weiter auf diese Bauart zu verlassen.

#### Scenario: Ein nicht aktiviertes Konto behält sein Ziel

- **WHEN** ein angemeldetes, nicht aktiviertes Mitglied einen Link auf
  `/events/:id` öffnet und die Aktivierung abschliesst
- **THEN** steht dieses Event auf dem Schirm und NOT die Startseite

#### Scenario: Nach dem Anmelden steht die Unterhaltung da

- **WHEN** ein nicht angemeldetes Mitglied einen Link auf `/chat/:threadId`
  öffnet und sich danach anmeldet
- **THEN** steht diese Unterhaltung auf dem Schirm

#### Scenario: Ein fremder Host wird als Ziel verworfen

- **WHEN** die Anmeldung mit einem erhaltenen Ziel aufgerufen wird, das auf
  einen fremden Host zeigt
- **THEN** führt die Anmeldung auf die Startseite und NOT auf diesen Host

#### Scenario: Der Aktivierungslink braucht keine Anmeldung

- **WHEN** ein Aktivierungslink geöffnet wird
- **THEN** läuft der Vorgang über das Token, ohne dass vorher eine Anmeldung
  verlangt wird

### Requirement: Der Android-Fingerabdruck ist bis zur Store-Einreichung unvollständig

Das System SHALL in `assetlinks.json` den SHA-256-Fingerabdruck jedes
Schlüssels führen, mit dem eine ausgelieferte Fassung der App signiert ist.

Unter Play App Signing hält **Google** den Signaturschlüssel der verteilten App;
der Schlüssel in Infisical ist der **Upload**-Schlüssel. Bis ein
Play-Console-Eintrag besteht, existiert Googles Fingerabdruck nicht und kann
NOT eingetragen werden.

Die Datei SHALL deshalb zunächst den Upload-Fingerabdruck führen, womit sich die
Android-Seite an einem **direkt installierten** Paket belegen lässt. Der
Fingerabdruck von Play App Signing SHALL in AGE-644 nachgetragen werden.

Diese Unvollständigkeit SHALL dort vermerkt sein, wo sie jemand findet — in
`public/_headers` neben der Regel, die nur wegen dieser Dateien existiert, und
in der Abnahme von AGE-644. **NOT in `assetlinks.json` selbst:** die Datei ist
strikt geparstes JSON, ein zusätzlicher Schlüssel wäre ein Fehler statt eines
Hinweises. Ohne den Nachtrag verifiziert die über Play verteilte App ihre Links
nicht, und das Fehlerbild lautet „Deep Links funktionieren nicht" statt „ein
Fingerabdruck fehlt".

#### Scenario: Ein direkt installiertes Paket verifiziert

- **WHEN** eine mit dem Upload-Schlüssel signierte Fassung direkt auf einem
  Gerät installiert wird
- **THEN** verifiziert Android die App Links gegen `assetlinks.json`

#### Scenario: Die offene Stelle ist auffindbar vermerkt

- **WHEN** jemand `assetlinks.json` liest
- **THEN** findet er in `public/_headers` den Vermerk, dass der Fingerabdruck
  von Play App Signing noch fehlt und wo er nachgetragen wird
