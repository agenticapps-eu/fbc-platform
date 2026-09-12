## Context

AGE-643, M3. Gemessen am 11.09. auf `d9721f4`, gegen die Live-Fläche und den
Arbeitsbaum.

Die Hülle steht (M2), der Push-Weg steht (M1). Was fehlt, ist der Weg von einem
Link **ausserhalb** der App zurück in die App. Der Weg aus einer Push-Mitteilung
ins Gespräch ist bereits gebaut und wird hier nicht angefasst:

```
Mail / WhatsApp ──?──> App          ← dieser Change
Push-Mitteilung ──────> App         ← gebaut (pushZielZuhoerer, M1)
```

**Vier Wege sollen in die App führen**, in dieser Rangfolge ihrer Bedeutung:

| Pfad | Woher |
| --- | --- |
| `/aktivierung#token=…` | die Aktivierungsmail — für viele der erste Kontakt überhaupt |
| `/chat/:threadId` | geteilte Links auf eine Unterhaltung |
| `/events/:id` | Event-Hinweise und Weiterleitungen |
| `/p/:id` | ein weitergereichtes Mitgliedsprofil |

**Der Blocker ist weg.** AGE-256 ist durch: `app.effbeezee.com` läuft seit dem
01.09. als CNAME bei Strato auf `fbc-platform.pages.dev`. Der Vorgang trägt den
Blockervermerk noch, er ist überholt.

## Goals / Non-Goals

**Goals:**

- Ein Link aus Mail oder Nachricht öffnet die installierte App am richtigen Ort.
- Derselbe Link ohne App öffnet die Website und führt den Vorgang zu Ende.
- Das Ziel überlebt eine zwischenzeitliche Anmeldung.
- Der Browserweg bleibt zeichengleich, wie er ist.

**Non-Goals:**

- **Kein eigenes URL-Schema.** Siehe Entscheidung 1.
- **Keine Änderung am Push-Weg.** Er leistet seinen Sprung bereits.
- **Kein Hinweis auf die App im Aktivierungsvorgang.** Ausdrücklich verboten,
  nicht bloss weggelassen — siehe das Spec-Delta.
- **Keine Store-Einreichung.** Das ist AGE-644.
- **Keine Auflösung der Fingerabdruck-Lücke.** Siehe Entscheidung 6.

## Decisions

### 1. Universal Links und App Links, nicht ein eigenes Schema

`effbeezee://` wäre in einer Stunde gebaut und braucht keine Datei auf dem
Server. Es ist trotzdem falsch.

Ein Schema **tut nichts**, wenn die App fehlt. Der Aktivierungslink erreicht
gerade die Menschen, die sie noch nicht haben — er ist ihr erster Kontakt mit
der Plattform. Ein toter Link an dieser Stelle verbraucht die Einladung.

Universal Links leisten beides aus einer Adresse: installierte App öffnen,
sonst die Website. Der Preis ist die Verifizierungsdatei, und die ist die
eigentliche Arbeit dieses Changes.

### 2. Die Dateien liegen in `public/`, nicht in einer Pages Function

*Gewählt:* `public/.well-known/apple-app-site-association` und
`public/.well-known/assetlinks.json`.

**Gemessen, nicht angenommen:** eine Sonde `public/.well-known/probe.txt` lag
nach `pnpm build` als `dist/.well-known/probe.txt` vor. Vite kopiert das
Punktverzeichnis. Das war die offene Frage — ein Werkzeug, das Punktdateien
überspringt, hätte die Dateien still verschluckt.

*Verworfen — eine Pages Function:* sie könnte den Inhaltstyp selbst setzen und
den Fingerabdruck zur Laufzeit einsetzen. Beides braucht niemand: die Werte sind
fest, und `_headers` setzt den Typ. Eine Function wäre Laufzeit für etwas, das
ein Build erledigt, plus eine zweite Stelle, an der die Auslieferung brechen
kann.

### 3. Der SPA-Fallback bleibt, wie er ist

`public/_redirects` trägt `/*  /index.html  200`. Die naheliegende Sorge ist,
dass er die beiden Dateien verschluckt. Er tut es nicht: statische Dateien haben
bei Cloudflare Pages Vorrang vor der Catch-all-Regel.

Die Regel anzufassen wäre das eigentliche Risiko. Sie ist der Grund, warum
`/chat/abc` im Browser überhaupt lädt — also warum der Weg **ohne** App
funktioniert. Ihn zu brechen, um den Weg mit App zu bauen, verfehlte das Ziel.

**Was daraus für die Abnahme folgt:** die Prüfung muss den **Rumpf** lesen. Vor
dieser Änderung antworteten beide Adressen mit `200` und der Startseite, 7986
Bytes, `text/html`, zeichengleich mit `/`. Ein Test auf den Statuscode war grün,
bevor es die Dateien gab. Dieselbe Falle steht im Gedächtnis unter
`cloudflare-pages-pruefen-fuenf-fallen` — dort kostete sie die Prüfbarkeit einer
ganz anderen Zusage.

### 4. Der Zuhörer steht früh, nach dem Vorbild des Push-Zuhörers

`appUrlOpen` wird registriert, sobald die Hülle steht, nicht nach dem Anmelden.

Die Begründung ist wörtlich die, die schon an `pushZielZuhoerer` steht: ein
Kaltstart **aus** dem Link heraus trifft ein, bevor jemand zuhört. Der Sprung
fiele genau dann aus, wenn er am meisten bedeutet — beim ersten Öffnen aus einer
Einladung.

Eine unbekannte Adresse bewegt nichts. Auch das ist übernommen: „Ohne Ziel
bleibt die App dort, wo sie ist. Ein Sprung auf gut Glück wäre schlechter als
keiner."

### 5. Die Zielerhaltung greift nicht beim Aktivierungs-Token

Wer über einen Link auf eine geschützte Fläche kommt und nicht angemeldet ist,
landet nach dem Anmelden am ursprünglichen Ziel.

**Ausgenommen ist `/aktivierung`**, und zwar nicht als Sonderfall, sondern weil
es dort nichts zu erhalten gibt: das Token trägt die Identität selbst. Eine
Zielerhaltung, die auch dort griffe, speicherte ein Token in einem Zwischenspeicher
— ein Geheimnis an einer Stelle, an der es nicht gebraucht wird.

### 6. Der Fingerabdruck bleibt unvollständig, und das steht in der Datei

`assetlinks.json` braucht den SHA-256-Fingerabdruck des Schlüssels, der die
**installierte** App signiert. Unter Play App Signing hält Google diesen
Schlüssel — unserer ist der Upload-Schlüssel.

*Gewählt:* jetzt den Upload-Fingerabdruck eintragen. Die Datei nimmt mehrere
auf. Damit ist die Android-Seite **an einem direkt installierten Paket** am
Gerät belegbar, und der Nachtrag in AGE-644 ist eine Zeile.

*Verworfen — die Android-Hälfte bis AGE-644 zurückstellen:* dann bliebe M3 ohne
Gerätebeleg auf Android, und der Fehler fiele erst im Store auf, wo eine Runde
Tage kostet.

*Verworfen — auf den Play-Eintrag warten:* das kehrte die von Donald gewählte
Reihenfolge um.

**Der Vermerk muss dort stehen, wo jemand ihn findet** — und das ist nicht die
Datei selbst: `assetlinks.json` ist strikt geparstes JSON ohne Kommentarsyntax,
und Google prüft das Schema. Ein zusätzlicher Schlüssel wäre kein Vermerk,
sondern ein Fehler.

Der Vermerk geht deshalb an zwei Stellen, die beide gelesen werden: als
`#`-Kommentar neben die Inhaltstyp-Regel in `public/_headers`, die ohnehin nur
wegen dieser beiden Dateien existiert, und in die Abnahme von AGE-644.

Ohne den Nachtrag verifiziert die über Play verteilte App ihre Links nicht, und
das Fehlerbild lautet „Deep Links funktionieren nicht" — eine Beschreibung, die
in die Irre führt und niemanden auf einen fehlenden Fingerabdruck bringt.

### 7. `native-shell` trägt alles, `notifications` wird gemieden

Alle neuen Anforderungen sind **ADDED** in `native-shell`. Keine bestehende
Anforderung wird enger oder falsch.

`notifications` und `deployment-environments` bleiben unberührt — nötig, weil
die aktiven Changes `push-fundament` und `push-waechter` dort `MODIFIED`-Blöcke
halten. Zwei Changes auf derselben Anforderung machen den zweiten
unarchivierbar. Dass es sachlich trägt, ist kein Zufall: dieser Change erzeugt
keine Mitteilung, er öffnet einen zweiten Eingang.

### 8. Das Token steht im FRAGMENT, und das Fragment muss überleben

**Befund der Plan-Review (opencode, MITTEL), am Repo bestätigt.** Der erste
Entwurf dieses Dokuments schrieb `/aktivierung?token=…`. Falsch: der Token steht
im **Fragment** — `src/instrument.test.ts:37`, `App.test.tsx:232` und
`ActivationRedeemPage.test.tsx` zeigen durchgehend `/aktivierung#token=…`,
`public/_headers` sagt es im Kommentar.

Für AASA und Manifest ändert das nichts — beide sehen Fragmente ohnehin nicht.
Für **diesen** Change ändert es alles: die Übersetzung von `appUrlOpen` ins
Routing muss `pathname`, `search` **und `hash`** mitführen. Wer nur die ersten
beiden nimmt, baut einen Aktivierungsweg, der die App öffnet und dort ohne Token
ankommt — und zwar auf genau dem Pfad, der am teuersten ist.

Dass der Token nicht im Query steht, ist im Übrigen kein Zufall: ein Fragment
wird nicht an den Server gesendet und landet in keinem Zugriffsprotokoll.

### 9. Android beansprucht dieselben vier Pfade wie iOS, nicht die ganze Domain

**Befund der Plan-Review (opencode, HOCH).** Der Entwurf sagte an einer Stelle
„zwei `intent-filter`", an einer anderen „je einen", und nannte nirgends eine
Pfadeinschränkung. Ohne sie beansprucht Android **jede** Adresse der Domain,
während AASA auf vier Pfade einschränkt.

Die Folge wäre eine Asymmetrie, die niemand entschieden hat: ein
Passwort-Link, `/login` oder ein künftiger Werbelink öffnete auf Android die App
und auf iOS den Browser. Dass der Zuhörer im Client „unbekannte Adresse bewegt
nichts" sagt, rettet das nur scheinbar — die App stünde dann geöffnet und leer
da, statt dass der Browser den Link bedient hätte.

*Gewählt:* **ein** `intent-filter` mit `VIEW`, `DEFAULT`, `BROWSABLE`,
`android:scheme="https"`, `android:host="app.effbeezee.com"` und je einem
`android:pathPrefix` für die vier Pfade. Damit sind beide Plattformen auf
dieselbe Menge eingeschränkt.

*Verworfen — die ganze Domain beanspruchen:* einfacher, aber es macht jede
künftige Seite auf `app.effbeezee.com` still zu einem App-Link.

**Die vier Pfade stehen dann an drei Stellen** (AASA, Manifest, Client-Zuhörer).
Das ist eine echte Dublette. Sie wird **einmal** im Client als Modul
ausgesprochen, und AASA wie Manifest verweisen im Kommentar darauf; eine echte
Einzelquelle gäbe es nur über einen Generator, und der wäre für vier Zeilen mehr
Maschinerie als Nutzen.

### 10. `/passwort-neu` bleibt bewusst draußen

**Befund der Plan-Review (opencode, NIEDRIG).** Der Passwort-Link hat dieselbe
Gestalt wie der Aktivierungslink (`/passwort-neu#token=…`, dieselbe Seite im
Rücksetz-Modus) und erreicht Menschen ebenso per Mail.

Er bleibt trotzdem außerhalb der vier Pfade: wer sein Passwort zurücksetzt, tut
das typischerweise, weil er gerade **nicht** hineinkommt, und der Browser ist
dafür der verlässlichere Ort. Mit Entscheidung 9 ist das jetzt auch auf Android
so — ohne Pfadeinschränkung wäre er als Nebenwirkung in der App gelandet.

Festgehalten, damit es später als Entscheidung und nicht als Lücke gelesen wird.

### 11. Die Zielerhaltung sitzt in `RequireAuth`, nicht im Anmeldeweg allgemein

**Befund der Plan-Review (opencode, HOCH), am Repo bestätigt.**
`src/components/RequireAuth.tsx` tut heute `<Navigate to="/login" replace />`
und **verwirft den Ort dabei vollständig**. Der Entwurf sagte nur „die
Zielerhaltung im Anmeldeweg" und die Aufgabe sagte „Umsetzen" — das ist ein
Platzhalter, keine Aufgabe.

*Gewählt:* `RequireAuth` reicht das Ziel über `state` weiter,
`LoginPage` liest es und navigiert nach erfolgreicher Anmeldung dorthin.

*Verworfen — ein Query-Parameter `?ziel=`:* `LoginPage` führt bereits
`?modus=` (`LoginPage.tsx:89`), und ein zweiter Parameter müsste mit ihm
koexistieren. Vor allem aber steht ein Ziel im Query in jedem Zugriffsprotokoll
und in jedem Verlauf — `state` wird nicht übertragen.

**Die zweite Wand ist geprüft und ist keine.** `ActivationGate` blendet für ein
angemeldetes, nicht aktiviertes Konto `<ActivationScreen />` ein — „egal welche
Route aufgerufen wurde". Das ist aber ein **Austausch des gerenderten Baums**,
keine Navigation: die Adresse bleibt stehen. Das Ziel geht dort also nicht
verloren. Die Review vermutete das Gegenteil; die Zusage gehört trotzdem
gepinnt, weil sie heute aus der Bauart folgt und nicht ausgesprochen ist.

## Risks / Trade-offs

**Das Entitlement kann die Signierung brechen** → ein zweiter Schlüssel in
`App.entitlements` verlangt eine App-ID, an der *Associated Domains* aktiv ist.
Ist sie es nicht, greift die automatische Signierung zum Wildcard-Profil und der
Bau scheitert — dieselbe Mechanik, die `aps-environment` in M2 erzwungen hat.
Mitigation: die Fähigkeit im Portal **vor** dem ersten Bau setzen, und den Bau
als eigenen Schritt prüfen, bevor irgendetwas am Gerät gemessen wird.

**Apple zwischenspeichert die Verifizierungsdatei** → eine frisch ausgelieferte
Datei erreicht ein Gerät nicht sofort. Ein Beleglauf misst dann den alten Stand
und sieht wie ein Fehlschlag aus. Mitigation: beim Messen am Gerät den
Entwicklermodus der Association verwenden, der den Zwischenspeicher umgeht, und
das im Beleg festhalten. Ein grüner Lauf ohne diesen Vermerk belegt nicht, was
er zu belegen scheint.

**Die Android-Verifizierung ist unvollständig** → siehe Entscheidung 6. Der
Beleg gilt für ein direkt installiertes Paket, nicht für die Play-Fassung.

**Der Aktivierungsweg ist der teuerste Fehlerfall** → er trifft Menschen beim
ersten Kontakt, und niemand meldet ihn, weil niemand weiss, dass es anders sein
sollte. Mitigation: er wird als erster belegt, nicht als letzter, und auf beiden
Plattformen mit und ohne installierte App.

**Ein Test kann die Auslieferung nicht belegen** → alles an diesem Change hängt
an zwei Dateien auf einem fremden Host. Ein grüner Unit-Test über den Inhalt der
Datei im Arbeitsbaum sagt nichts darüber, was `app.effbeezee.com` ausliefert.
Mitigation: die Abnahme misst live, gegen die Adresse, und liest den Rumpf.

## Open Questions

- **Der Upload-Fingerabdruck muss aus Infisical gelesen werden.** Der Keystore
  liegt dort als `ANDROID_KEYSTORE_BASE64`. Ob diese Sitzung ihn lesen darf, ist
  noch nicht gemessen; andernfalls ist es ein Handgriff für Donald.
- **AGE-643 trägt im Rumpf noch „blockiert durch AGE-256"**, obwohl AGE-256
  erledigt ist. Gehört beim Abschluss richtiggestellt.
