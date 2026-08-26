# Video-Player erst auf Anforderung laden

## Why

Linear: **AGE-611**. Gefunden in AGE-497 beim Schreiben der Datenschutz-
erklaerung, dort **dokumentiert statt behoben** — der wichtigste offene Punkt
jenes Changes.

`src/components/ui/VideoEmbed.tsx` rendert unmittelbar ein `<iframe>` auf
`youtube.com/embed/…` bzw. `player.vimeo.com/video/…`. Der Aufruf geht damit
**beim Rendern der Seite** an den Anbieter, mitsamt IP-Adresse, User-Agent und
gesetzten Cookies — bevor irgendjemand gefragt wurde.

`loading="lazy"` verschiebt diesen Aufruf, es verhindert ihn nicht. Sobald der
Rahmen in Sichtweite kommt, geht er raus.

### Wo das oeffentlich wirkt

Gemessen am 26.08. wird die Komponente an fuenf Stellen gerendert:

| Ort | Datei | ohne Konto erreichbar |
| -- | -- | -- |
| Startseite, Beitragsvorschau | `src/pages/HomePage.tsx:238` | **ja** |
| Oeffentliches Profil | `src/pages/PublicProfilePage.tsx:316` | **ja** |
| Aktivitaetsfeed | `src/components/community/CommunityFeed.tsx:1185` | nein |
| Academy | `src/pages/AcademyPage.tsx:75`, `:302` | nein |
| Profil-Editor, Vorschau | `src/components/profile/VideoLinksInput.tsx:64` | nein |

Die ersten beiden Zeilen sind der eigentliche Punkt: ein Besucher ohne Konto
loest den Drittanbieter-Aufruf aus, ohne je gefragt worden zu sein. Die Seite
sagt das heute selbst — `src/content/legal/datenschutz.ts:43` und
`src/content/legal/cookies.ts:26` fuehren es als offenen Punkt sichtbar auf.

### Warum Zwei-Klick und nicht das Consent-Banner aus AGE-260

Weil die Komponente **eine** Stelle ist. Eine Aenderung dort deckt alle fuenf
Aufrufer gleichzeitig ab, und fuer Videos wird dann **gar kein** Banner mehr
gebraucht — es gibt nichts mehr einzuwilligen, solange niemand klickt.

Ein Banner bleibt fuer AGE-260 relevant (andere Kategorien), ist aber fuer
diesen Punkt die groessere und spaetere Loesung. Diese hier ist die kleinste,
die den Befund tatsaechlich schliesst.

## What Changes

### 1 · Vorschaufläche statt sofortigem `<iframe>`

`VideoEmbed` rendert zunaechst eine Flaeche **ohne jeden Drittanbieter-
Verkehr**: Anbietername, Abspielsymbol, und darunter ein Satz, der benennt, was
beim Aktivieren geschieht, mit Verweis auf `/datenschutz`. Erst die Aktivierung
ersetzt die Flaeche durch das `<iframe>` — unveraendert wie heute.

### 2 · Kein Vorschaubild vom Anbieter

Die naheliegende Verschoenerung waere ein Standbild von `img.youtube.com` oder
`vumbnail.com`. **Das waere derselbe Fehler mit einem anderen Hostnamen** — der
Aufruf traegt exakt die Daten, die das Tor zurueckhalten soll. Die Flaeche wird
deshalb lokal gezeichnet und bleibt schlicht.

Das ist die eine Stelle, an der dieser Change bewusst haesslicher ist als
moeglich.

### 3 · Autoplay — ohne das waere das Tor eine Verschlechterung

**Aus der Plan-Review, von zwei Anbietern unabhaengig gefunden.** Ein
nachtraeglich eingesetztes `iframe` laedt den Player **pausiert**. Der Besucher
klickt also auf unsere Flaeche und muesste danach ein **zweites** Mal klicken,
diesmal im fremden Rahmen. Der erste Entwurf dieses Changes haette das
Einwilligungstor gebaut und die Bedienung dabei verschlechtert.

Deshalb traegt die aktivierte URL `autoplay=1`. Das ist keine Zugabe, sondern
die Bedingung dafuer, dass ein Klick genau das tut, was der Klickende erwartet.

Angehaengt wird der Parameter **in `VideoEmbed`**, nicht in `parseVideoUrl`: die
kanonische Grenze bleibt so unberuehrt, und die SQL-Paritaet ebenfalls.

### 4 · Die datensparsamsten Adressen je Anbieter

YouTube ueber `youtube-nocookie.com`, Vimeo mit `dnt=1`.

Der erste Entwurf hatte nur YouTube. Zwei Reviewer haben unabhaengig
angemerkt, dass dieselbe Begruendung fuer Vimeo gilt und die Asymmetrie
unbegruendet war — sie hatten recht.

**Was die Anforderung sagt, ist bewusst enger als die erste Fassung.** Sie sagt,
welche Adresse **das System anfragt** — nicht, was der Anbieter dann tut. Eine
Zusage ueber fremdes Cookie-Verhalten liesse sich aus diesem Repository nicht
belegen, und eine unbelegbare Anforderung ist keine.

**Diese Aenderung ist rein TypeScript-seitig und erzeugt keine Drift.** Die
Migration `20260813090000` teilt ausdruecklich auf: *SQL entscheidet, OB ein
Body ein Video enthaelt und WELCHE URL das ist. TypeScript entscheidet, WIE
diese URL eingebettet wird.* Der Erkenner in SQL prueft den **Quell**-Host, den
ein Mitglied einfuegt; `youtube-nocookie` steht dort bewusst nicht und muss
dort auch weiterhin nicht stehen. Geaendert wird nur die **gebaute** Embed-URL.

`scripts/probe-c9-parser-paritaet.ts` vergleicht die Erkennung, nicht die
Embed-URL, und bleibt davon unberuehrt. Das ist vor dem Bauen zu belegen, nicht
zu behaupten.

### 5 · Die Rechtstexte beschreiben den neuen Zustand — an vier Stellen

`datenschutz.ts` und `cookies.ts` fuehren das heutige Verhalten als offenen
Punkt. Diese Stellen werden umgeschrieben — sonst behauptet die Seite einen
Mangel, den es nicht mehr gibt.

**Die vierte Stelle hat erst die Review gefunden:** `cookies.ts:601` sagt „Ihre
Einwilligung erfolgt über unser Cookie-Consent-Banner." Nur den offenen Punkt zu
streichen und diesen Satz stehen zu lassen haette den Text widerspruechlich
zurueckgelassen — ein Banner gibt es nicht, und fuer Videos soll es auch keines
geben.

## Impact

- **Spec:** zwei neue Anforderungen in `design-system`, neben den bestehenden
  „Fonts are served from the application's own origin" und „Imagery is served
  from the application's own origin". Dieselbe Klasse: kein fremder Ursprung
  ohne Not. Dazu ein **MODIFIED**-Delta auf `academy-library` — dessen Szenario
  fordert heute wortwoertlich „an embedded external video player" beim Oeffnen
  der Seite und wuerde nach dem Archivieren gleichzeitig sofortigen Player und
  Einwilligungstor verlangen.
- **Keine** Migration, **keine** RLS-Aenderung, **keine** neue Tabelle.
- `src/components/ui/VideoEmbed.tsx`, `src/lib/video-url.ts` (nur die gebaute
  Embed-URL), `src/content/legal/datenschutz.ts`, `src/content/legal/cookies.ts`
- **Drei** bestehende Testdateien werden rot. Der erste Entwurf nannte nur die
  erste — die anderen beiden hat die Review gefunden:
  - `src/components/ui/VideoEmbed.test.tsx` — erwartet das `<iframe>` beim
    ersten Rendern
  - `src/pages/HomePage.test.tsx:43-53` — dasselbe, und zwar fuer genau die
    oeffentliche Flaeche, um die es hier geht
  - `src/lib/feed.test.ts` — sieben Assertions pinnen
    `embedUrl: "https://www.youtube.com/embed/…"`

  Alle drei sind **anzupassen, nicht zu loeschen**.

## Was dieser Change NICHT tut

- **Kein Consent-Banner**, keine Einwilligungsverwaltung, kein Speichern der
  Entscheidung ueber den Seitenaufruf hinaus. Wer zwei Videos ansehen will,
  aktiviert zweimal. Ein Gedaechtnis dafuer waere selbst eine
  Einwilligungsverwaltung und gehoert zu AGE-260.
- **Keine Sonderfaelle je Aufrufer.** Auch der Profil-Editor zeigt die Flaeche.
  Eine Ausnahme dort waere eine zweite Kontrollflaeche, die still driftet.
- Keine Aenderung daran, welche Links ueberhaupt als Video erkannt werden.

## Die offene Frage ist beantwortet

Gefragt war, ob `youtube-nocookie.com` in diesen Change gehoert. Die Review hat
sie in beide Richtungen geschaerft: **ja** — aber dann auch `dnt=1` fuer Vimeo,
und die Anforderung darf nur beschreiben, was **das System anfragt**, nicht was
der Anbieter verspricht.

## Was bleibt offen, wissentlich

- **Die fuenf Aufrufstellen sind heute vollstaendig, aber nichts haelt sie so.**
  Ein `grep` ist eine Momentaufnahme, keine Dauerkontrolle. Ein Waechter dagegen
  ist ein eigener Vorgang, wie AGE-542 es fuer die Anon-Lesepfade ist.
- **Die Rechtstexte bleiben `provisorisch: true`.** Dieser Change **verringert**
  die Zahl der offenen Punkte; er erhebt keinen Text zur geprueften Endfassung.
  Die anwaltliche Freigabe laeuft ueber AGE-610.
