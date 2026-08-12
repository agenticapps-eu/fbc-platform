# Evidence — Overlay-Hygiene (AGE-529)

Gemessen am 2026-08-12 in einem **echten Browser** (Chrome 151, DevTools-MCP)
gegen den lokalen Vite-Server auf dem DEV-Backend. jsdom kann keinen dieser
Werte liefern.

## Der Befund aus 9.7, umgekehrt

Ausgangslage laut AGE-529: „bei offenem Overlay bewegt das Rad den Feed
dahinter, `scrollY` 0 → 600. Wer schließt, steht an anderer Stelle."

Gemessen auf `/aktivitaet`, Fensterbreite 500 px (macOS lässt kein schmaleres
Fenster zu — für die Off-Canvas-Navigation genügt es, sie erscheint unter
1024 px), Off-Canvas-Navigation:

| Schritt | Messwert |
| -- | -- |
| Vor dem Öffnen gescrollt auf | `scrollY = 600` |
| Overlay offen → `body` | `position: fixed`, `top: -600px`, `left: 0px`, `right: 0px` |
| Overlay offen, `scrollBy(0, 400)` | `scrollY` bleibt **0** — die Seite dahinter bewegt sich nicht |
| Nach Escape → `body` | `position: ""`, `top: ""`, `left: ""` |
| Nach Escape → Position | `scrollY = 600` — **exakt** wiederhergestellt |
| Nach Escape → scrollbar? | ja |

Die letzte Zeile ist die, auf die es ankommt: eine halbe Umsetzung stünde hier
bei 0 und wäre schlechter als der Ausgangszustand.

## Der `lg`-Wächter, der ohne den Plan-Review gefehlt hätte

Ohne ihn bliebe `mobileNavOpen` beim Überschreiten des Breakpoints stehen, die
Schublade wäre per `lg:hidden` unsichtbar — und der Body **dauerhaft** gesperrt.
Gemessen:

| Schritt | Messwert |
| -- | -- |
| 500 px, gescrollt auf 400, Navigation geöffnet | offen, `body.position = fixed` |
| Fenster auf 1280 px gezogen | Dialog **weg**, `body.position = ""` |
| Danach | `scrollY = 400`, Seite wieder scrollbar |

## Was hier NICHT gemessen wurde — und warum

- **iOS Safari** (Aufgabe 4.5). Chrome ist nicht Safari, und `position: fixed`
  ist genau dort die Zusage, die nur am Gerät zu prüfen ist. Chrome zeigt, dass
  die richtigen Stile gesetzt und die Position exakt zurückgegeben wird; dass
  Safaris visuelles Viewport sich daran hält, zeigt es nicht.
- **Die 375-px-Kachelmessung** (Aufgabe 4.3). Sie braucht ein **eingeloggtes**
  Konto: der Feedback-Knopf rendert sich für Nicht-Mitglieder gar nicht
  (`FeedbackButton.tsx`, `if (!user) return null`), die Kollision kann ausgeloggt
  also nicht entstehen. Dazu kommt, dass macOS kein Fenster unter 500 px zulässt.
  Beides zusammen heißt: diese Zeile braucht Donald oder den lokalen Stack mit
  einem Testkonto.
- **Lightbox, Cropper und Feedback-Panel** im Browser — alle drei setzen ein
  eingeloggtes Konto voraus. Ihre Anschlüsse sind je durch einen Fokusumlauf-Test
  belegt, und der Hook selbst ist hier am echten Layout gemessen.

## Nebenbefund: der 401 aus AGE-530, im echten Netzwerkverkehr

Beim Messen ausgeloggt mitgeschnitten — dieser Branch trägt den Fix aus PR #163
noch nicht, also ist der Befund hier live zu sehen:

```
/aktivitaet   posts 200 · tags 200 · post_media 200 · post_engagement_counts 200
              profiles_public 401
/events       events 200 · event_registration_counts 200
              profiles_public 401
```

Das bestätigt zweierlei am echten Backend: dass die Umfangserweiterung von
AGE-530 auf `/events` kein theoretischer Fall war, und dass die dortige
`anon`-Positivliste stimmt — alles außer `profiles_public` antwortet mit 200.

Der `partners`-Aufruf fehlt in diesem Mitschnitt, weil **kein** Event auf DEV
heute einen `host_partner_id` trägt. Das Grant ist trotzdem `authenticated`-only
(`20260715140000_explicit_grants.sql:62`); der zweite 401 entstünde, sobald ein
Event einen Partner-Host bekommt.
