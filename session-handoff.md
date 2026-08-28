# Session Handoff — 2026-08-28 (Abend, AGE-641 Phase B am Gerät abgenommen)

**Worktree:** `fbc-platform.donald-age-642-capacitor-huelle`, Branch
`donald/age-642-capacitor-huelle`. Baum **sauber**, `tsc` grün, **2242 Tests in
202 Dateien grün**, `openspec validate --all` 30/30.

⚠️ **Die drei Commits dieser Sitzung sind NICHT gepusht** (`8736f3c`, `7a2d923`,
`ecef573`). Genau dieser Worktree wurde am 28.08. schon einmal von einer fremden
Aufräum-Sitzung gelöscht. **Erste Aktion: pushen.**

Donald ist mit dem Telefon weg. Alles Geräte-Abhängige wartet auf ihn.

## Accomplished

### AGE-641 Phase B — vollständig am echten iPhone abgenommen

Alle sieben Schritte, jeder mit Grundlinie davor:

| Schritt | Erwartet | Gemessen |
| --- | --- | --- |
| 3 | `push_tokens` = 0 | 0 (18:23) |
| 5 | = 1 nach dem Dialog | 1 (18:34:49), `ios`, **64 Zeichen** = APNs-Länge |
| 6 | Kette | `notifications` +1 · `net._http_response` #372 `200` · `{"zugestellt":2,…}` |
| 7 | Sperrbildschirm | **von Donald gesehen und aufgenommen** |

Damit sind beide Hälften der offenen App-ID-Frage beantwortet: APNs gab ein
Token aus **und** nahm die Zustellung an — `com.effbeezee.app` stimmt.

### Der Befund, der die Aufnahme unterbrochen hat

`hinweis_neue_nachricht` unterdrückte einen zweiten Hinweis, solange für das
Gespräch ein ungelesener lag. Gemeint war die **Glocke**. Am selben INSERT hängt
aber der Push (`notifications_push_webhook`). Folge: **solange irgendein
ungelesener Hinweis für einen Faden lag — auch einer von vorgestern —, war das
Telefon für diesen Chat dauerhaft stumm.**

- 19:11:36 Nachricht bei ungelesenem Hinweis → **null** neue `net._http_response`
- 19:12:52 Hinweis gelesen, Nachricht → #372 `200`
- **nach der Migration, identische Ausgangslage** → 19:31:13 Hinweise 1→2,
  #394 `200`

Gleiche Vorbedingung, gegenteiliges Ergebnis. Der Lauf von 19:11:36 ist die
Positivkontrolle: ohne ihn wäre „der Push kam" von „es lief ohnehin etwas" nicht
zu trennen.

### Drei weitere Fehler, alle am Gerät gefunden

- **Ein Tipp auf die Mitteilung öffnete nur die App.** Das Ziel lag serverseitig
  längst bei (`/chat/<thread_id>`); es hörte niemand zu. `pushZielZuhoerer` hängt
  jetzt am **Montieren der Hülle** — der wichtigste Tipp ist der auf ein
  gesperrtes Telefon, und dabei startet die App kalt aus der Mitteilung heraus.
- **Die Glocken-Liste war auf dem iPhone links abgeschnitten.** Sie hängt mit
  `right-0` am Knopf; rechts stehen Avatar und Zurück-Pfeil. Das vorhandene
  `max-w-[calc(100vw-2rem)]` half nicht — es begrenzt auf die Fensterbreite,
  während die Schranke der Platz **links vom Knopf** ist. Jetzt gemessen
  (`getBoundingClientRect().right`), nicht geraten.
- **Die Aktivitäts-Karte auf der Startseite war ein `<Card>` ohne Link.** Den
  Deeplink `?post=<id>` gab es seit AGE-587; gebaut hatten ihn nur die beiden
  Profilflächen.

### AGE-642 B5 — die Startfläche

Drei Ebenen, alle am Verhältnis der Höhe (Foto 62 %, Schriftzug bei 58 %, 25 %
hoch). `pnpm splash`, 17 Zusagen, drei per Mutations-Gegenprobe.
`Assets.car` 108 KB → 408 KB.

## Decisions

- **Push je Nachricht, nicht je Gespräch** (Donald, 28.08.). Preis ausdrücklich:
  zwanzig Nachrichten wecken zwanzigmal. Die Zusammenfassung gehört in die
  **Anzeige**, nicht ins Ereignis.
- **Verworfen, weil konstruktiv unmöglich:** bestehenden Hinweis erneut anstoßen
  (Primärschlüssel `push_zustellungen`) · Push ohne `notifications`-Zeile
  (`send-push` liest nur die Kennung) · `created_at` auffrischen (27.08. schon
  verworfen, die Glocke sortiert danach).
- **Startfläche: Verlauf als eigene Ebene**, nicht ins Foto gebacken — sonst
  wird er quer mitbeschnitten und die Fotokante wird sichtbar.
- **Android bewusst ausgelassen:** seit Android 12 zeichnet die SplashScreen-API
  aus `windowSplashScreenBackground`; `@drawable/splash` wird nicht mehr gezeigt.
- **`repair --status reverted` NICHT ausgeführt**, als `db:push` über
  `20260828180000` stolperte: das ist AGE-657 aus einer **parallelen Sitzung**,
  echt und angewandt. Stattdessen `origin/main` gemerged.

## Files modified

- `supabase/migrations/20260828200000_push_je_nachricht.sql` — **neu**, auf DEV
  angewandt, **nicht auf PROD**
- `src/lib/push.ts` + `push.ziel.test.ts` — `pushZiel`, `pushZielZuhoerer`
- `src/components/AppShell.tsx` (+ Test-Attrappe) — zweiter Effect, am Montieren
- `src/components/hinweise/HinweisGlocke.tsx` — gemessene Maximalbreite
- `src/components/home/MemberDashboard.tsx` (+ Test) — `<Link>` um die Karte
- `scripts/splash{,.logic,.logic.test}.ts`, `assets/splash-*.svg`,
  `ios/.../{Splash,SplashVerlauf,SplashSchriftzug}.imageset`,
  `ios/.../LaunchScreen.storyboard`
- `openspec/changes/capacitor-huelle/` — Anforderung, B5, REVIEWS.md Runde 2

## Next session: start here

In einem Rutsch, in dieser Reihenfolge — nichts davon braucht das Gerät:

1. **Pushen.** Drei Commits liegen nur lokal.
2. **Glocke fasst je Faden zusammen** — die andere Hälfte der Entscheidung. In
   `fetchHinweise` die `message`-Zeilen je `payload->>'thread_id'` auf die
   neueste eindampfen. **Der Haken:** `markiereHinweisGelesen(id)` muss dann
   ALLE ungelesenen des Fadens markieren, sonst taucht der eingedampfte Eintrag
   sofort mit der älteren Zeile wieder auf. Betrifft `use-hinweise.ts:41` und
   die Signatur von `markiere` in `HinweisGlocke.tsx`. Zweiter Haken: die
   50er-Grenze greift **vor** dem Eindampfen.

   ---

   ### ⭐ NEUE MARKE — der grösste Brocken, von Donald am 28.08. um 19:45 gegeben

   **Die Marke ändert ihre FORM.** Vorlagen liegen im Repo unter
   `docs/marke-neu/` (aus `~/Downloads` gesichert, WhatsApp-Downloads
   verschwinden): `marke-allein.jpeg` · `lockup-quer.jpeg` ·
   `lockup-gestapelt.jpeg` · `lockup-quer-claim.jpeg`.

   Was sich ändert, gegenüber dem heutigen `compass-favicon.svg`:

   | | alt | neu |
   | --- | --- | --- |
   | Ring | ja, `r=15.5`, `stroke-width=3.5` | **weg** |
   | Stern | vier Strahlen | **acht** — vier lange Haupt-, vier kurze Nebenstrahlen |
   | Strahlenform | gerade Rauten | schlank, leicht konkav, spitz auslaufend |
   | Farbe | Blau `#1F53B0` auf durchsichtig | weiss auf Navy (Invers bleibt) |
   | Wortmarke | Inter, Akzentpunkte | in den Vorlagen eine Grotesk **ohne** farbige Punkte — **mit Donald klären, ob die Punkte bleiben** |

   `lockup-quer-claim.jpeg` trägt zusätzlich „YOUR NEXT OPPORTUNITY" gesperrt
   unter der Wortmarke. **Ob dieser Claim übernommen wird, ist offen** — er
   widerspricht dem deutschen „Gemeinsam erfolgreich" der Startfläche.

   **Die Marke liegt im Repo an DREI Stellen, alle drei müssen mit:**

   1. `public/brand/compass-favicon.svg` — die Quelle für `pnpm app:icons`
      **und** `pnpm splash`
   2. `src/components/ui/CompassMark.tsx` — die Web-Fläche
   3. `docs/design-system.html` — die verbindliche Vorlage

   Danach **beide Generatoren neu fahren**: `pnpm app:icons` (fünfzehn Dateien,
   App-Symbol — Donald nennt es ausdrücklich) und `pnpm splash` (drei Ebenen).
   Beide lesen dieselbe Quelle; nachziehen von Hand ist nicht nötig und nicht
   erlaubt.

   **Achtung, zwei Fallen aus B4/B5, die hier wieder zuschlagen:**
   - `app-icons.logic.ts` `leseMarke()` erwartet GENAU einen `<circle>` und
     GENAU einen `<path>` und wirft sonst. Ohne Ring gibt es keinen Kreis mehr
     — **die Lesefunktion muss mit**, samt ihrer Tests.
   - Der Beleg gehört ans **gebaute** Artefakt (mittlere Farbe, `Assets.car`),
     nicht an die Vorlage im Arbeitsbaum.

   ---

3. **Tote Gerätetokens aufräumen.** `zugestellt: 2` kam von Donalds altem Token
   aus der deinstallierten App. APNs meldet es noch eine Weile als gültig, es
   kommt also kein `dauerhaft` — von selbst verschwindet es **nie**.
4. **Spec und Aufgaben nachziehen** für 2 und 3 sowie für Tipp-Ziel, Glocken-
   Breite und Startseiten-Link. Die Delta von `push-fundament` behauptet die
   Zusammenfassung **nicht** (nachgesehen), es fehlt also nur Neues.
5. **`migrate-prod`** — die Migration liegt nur auf DEV. Dispatchen heißt
   anwenden, ohne Rückfrage.
6. **Erst wenn Donald zurück ist:** Startfläche am Gerät bestätigen, Tipp ins
   Gespräch ausprobieren, Startseiten-Link gegenprüfen.

## Open questions

- **Die Startfläche erscheint NICHT — Donald sagt es zum dritten Mal.** Das ist
  ein echter Fehler, keine Wahrnehmung. Stand der Messung:
  - Simulator, eine Sekunde nach dem Start: **weiss**. Nicht beweiskräftig, der
    Launch Screen steht nur ein paar hundert Millisekunden und der WebView
    dahinter ist ebenfalls weiss.
  - Schnellaufnahmen direkt nach dem Kaltstart: die erste ist **schwarz** (Gerät
    hatte noch nicht gezeichnet), die übrigen wurden nicht mehr angesehen —
    `/tmp/start-{1..6}.png`, verfallen mit dem Neustart. **Hier wieder ansetzen.**
  - **Ausgeschlossen:** die Image Sets tragen nur `Scale 1`, aber iOS greift bei
    fehlenden Auflösungen darauf zurück. `UILaunchStoryboardName` steht auf
    `LaunchScreen`, ein konkurrierendes `UILaunchScreen` gibt es nicht, und
    `LaunchScreen.storyboardc` liegt gebaut im Bündel — samt
    `01J-lp-oVM-view-rootView.nib`.
  - **Noch nicht geprüft:** ob die von Hand geschriebenen Constraints zur
    Laufzeit greifen (Verdacht Nummer eins), und ob iOS den alten Launch Screen
    weiter aus dem Zwischenspeicher zeigt. Wegen der neuen Marke wird die Fläche
    ohnehin neu erzeugt — **erst die Marke, dann diesen Fehler**, sonst wird
    zweimal dasselbe gesucht.
- **Zwei Changes auf einem Branch.** `7a2d923` und `ecef573` sind AGE-641 bzw.
  AGE-587 und sitzen auf dem AGE-642-Branch. Entweder trägt PR #277 alles, oder
  es wird herausgepflückt. **Entscheidung offen.**
- **Querformat:** die Startfläche hält (nichts abgeschnitten, keine Kante), aber
  der Bildausschnitt verliert quer beide Gesichter.
- **`pnpm splash --check` in der CI** fehlt — gilt für `pnpm app:icons` genauso.
- **`pnpm build` schmutzt `src/content/release-entries.generated.ts`** — nicht
  `src/data/`, der Pfad hat sich geändert.
- **Der Bearer des Push-Webhooks steht im Funktionsrumpf** und ist per
  `pg_get_functiondef()` für `anon` lesbar — bekannter Befund, unverändert offen.
- **`pnpm db:push` blockt der Klassifikator**; Donald hat es von Hand gefahren.
- Unverändert: B3 (Signaturmaterial), C2, C3, Phase D, Phase E. Beide Changes
  **nicht** archiviert.
