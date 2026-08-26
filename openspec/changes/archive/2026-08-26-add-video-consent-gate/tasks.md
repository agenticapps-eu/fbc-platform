# Tasks — Video-Player erst auf Anforderung laden (AGE-611)

> Ueberarbeitet nach der Plan-Review (`REVIEWS.md`, drei Fremdanbieter, dreimal
> REQUEST-CHANGES). Elf Befunde uebernommen. Die Abschnitte 2.8, 4.5, 5.3, 6.1
> und 7 gaebe es ohne die Review nicht.

## 1 · Den Befund messen, bevor irgendetwas geaendert wird

- [x] 1.1 Zwei oeffentliche Beitraege mit YouTube- und Vimeo-Link im lokalen
      Stack angelegt; der Trigger hat `video_url` korrekt gefuellt
- [x] 1.2 **RED belegt**: ausgeloggt auf `/` gehen zwei Aufrufe an fremde
      Ursprünge — `www.youtube.com` und `player.vimeo.com`. Gemessen an
      `performance.getEntriesByType("resource")`, nicht im Quelltext:
      `loading="lazy"` verschiebt den Aufruf, es verhindert ihn nicht
- [x] 1.3 **Belegt**, dass `scripts/probe-c9-parser-paritaet.ts` die
      **Quell-URL** vergleicht (`extractFirstVideo(body)?.url` gegen
      `public.erste_video_url`) und nicht die gebaute Embed-URL. Abschnitt 4
      bleibt damit im Change
- [x] 1.4 ~~RED auf einem oeffentlichen Profil mit hinterlegtem Video~~ —
      **entfaellt, die Aufgabe stand auf einer falschen Annahme.** `/p/:id`
      liegt hinter `RequireAuth` (`src/App.tsx:118-128`), das Profil ist ohne
      Konto gar nicht erreichbar. Es gibt genau EINE ausgeloggt erreichbare
      Flaeche mit Video, die Startseite

## 2 · Die Vorschaufläche

- [x] 2.1 Test zuerst: `VideoEmbed` rendert beim ersten Mal **kein** `<iframe>`
- [x] 2.2 Test: nach Aktivierung steht das `<iframe>` da
- [x] 2.3 Test: die Flaeche nennt den Anbieter, benennt die Folge der
      Aktivierung und verlinkt `/datenschutz`
- [x] 2.4 Test: die Flaeche traegt **kein** `<img>` mit fremdem Ursprung
- [x] 2.5 Test: sie ist ein **`<button>`** mit zugaenglichem Namen, der den
      Anbieter nennt, und per Tastatur ausloesbar — kein `div` mit `onClick`
- [x] 2.6 Test: zwei Videos auf einer Seite, eines aktiviert — das andere
      bleibt Flaeche
- [x] 2.7 Test: die Einwilligung haengt an der **URL**, nicht an der Instanz.
      Wechselt die URL bei stehender Komponente, faellt die Flaeche zurueck.
      Der Profil-Editor schluesselt Zeilen nach Index — ohne das laedt eine
      geaenderte Zeile den neuen Anbieter ohne neue Aktivierung
- [x] 2.8 Test: die Aktivierung ueberlebt kein Neumontieren
- [x] 2.9 Implementieren. Gespeichert wird die **aktivierte URL**, nicht ein
      `boolean`. Der Verweis auf `/datenschutz` liegt **ausserhalb** des
      Knopfes — ein Link im Knopf ist ungueltiges Markup und eine Tastaturfalle
- [x] 2.10 Flaeche und Rahmen teilen sich `aspect-video`, damit die Aktivierung
      nichts verschiebt
- [x] 2.11 Nach dem Austausch wandert der Fokus auf den Rahmen, statt auf
      `document.body` zu fallen

## 3 · Autoplay — sonst ist das Tor eine Verschlechterung

> Aus der Review, von zwei Anbietern unabhaengig: ein nachtraeglich eingesetztes
> `iframe` laedt den Player **pausiert**. Ohne diesen Abschnitt muesste der
> Besucher ein zweites Mal klicken, diesmal im fremden Rahmen.

- [x] 3.1 Test: die URL des aktivierten Rahmens traegt `autoplay=1`
- [x] 3.2 `autoplay=1` wird **in `VideoEmbed`** an die aktivierte URL gehaengt,
      **nicht** in `parseVideoUrl` — die kanonische Grenze bleibt sauber und die
      SQL-Paritaet unberuehrt
- [x] 3.3 Das `allow`-Attribut fuehrt `autoplay` bereits; belegen, dass die
      Freigabe an den fremden Rahmen durchgereicht wird
- [x] 3.4 Im Browser belegen, dass nach **einem** Klick tatsaechlich abgespielt
      wird — bei YouTube **und** bei Vimeo

## 4 · Die datensparsamsten Adressen

- [x] 4.1 Test: die gebaute YouTube-URL zeigt auf `youtube-nocookie.com`
- [x] 4.2 Test: die gebaute Vimeo-URL traegt `dnt=1`
- [x] 4.3 Test: die **akzeptierten Quell-Hosts** sind unveraendert — ein
      `youtube-nocookie`-Link bleibt abgelehnt, genau wie heute
- [x] 4.4 `parseVideoUrl` anpassen (nur die gebaute URL)
- [x] 4.5 **`src/lib/feed.test.ts` anpassen** — sieben Assertions pinnen
      `embedUrl: "https://www.youtube.com/embed/…"` (Zeilen 91, 126, 130, 132,
      134, 148). Anpassen, nicht loeschen
- [x] 4.6 `scripts/probe-c9-parser-paritaet.ts` laufen lassen und gruen belegen

## 5 · Die bestehenden Tests, die rot werden

- [x] 5.1 `src/components/ui/VideoEmbed.test.tsx` — erwartet heute das `<iframe>`
      beim ersten Rendern
- [x] 5.2 **`src/pages/HomePage.test.tsx:43-53`** — erwartet
      `expect(iframe).not.toBeNull()` beim ersten Rendern und `src` mit
      `youtube.com/embed/…`. Die Zusage „die nackte Watch-URL steht nicht mehr
      im Text" **bleibt erhalten**
- [x] 5.3 `grep` auf `youtube\|vimeo\|iframe` ueber alle `*.test.*`, um eine
      vierte Suite nicht erst in CI zu finden

## 6 · Alle fuenf Aufrufer

- [x] 6.1 Belegen, dass keine Aufrufstelle am `VideoEmbed` vorbei einbettet.
      **Nicht nur `<iframe`** — auch nach den Anbieter-Domaenen, `<embed`,
      `<object` und dynamisch erzeugten Rahmen suchen
- [x] 6.2 Sichtprobe je Flaeche: Startseite, oeffentliches Profil, Feed,
      Academy, Profil-Editor

## 7 · Die Rechtstexte — drei Stellen, nicht zwei

- [x] 7.1 `src/content/legal/datenschutz.ts:43` — offener Punkt entfaellt
- [x] 7.2 `src/content/legal/datenschutz.ts:452 ff.` — der Abschnitt zu
      YouTube/Vimeo beschreibt das Tor statt des Mangels
- [x] 7.3 `src/content/legal/cookies.ts:26` — offener Punkt entfaellt
- [x] 7.4 **`src/content/legal/cookies.ts:601`** — dort steht „Ihre Einwilligung
      erfolgt über unser Cookie-Consent-Banner." Diesen Satz stehen zu lassen,
      waehrend die Einwilligung je Video an der Flaeche erfolgt, macht den Text
      widerspruechlich
- [x] 7.5 Bestehende Tests unter `src/content/legal/` gegen die alten
      Formulierungen pruefen

## 8 · Gegenprobe im Browser

- [x] 8.1 **GREEN:** ausgeloggt auf `/` — die **Menge aller fremden Ursprünge
      ist leer**. Keine Ausschlussliste: eine Liste ist immer eine Zeile zu
      kurz, und `youtube-nocookie.com` haette in der ersten Fassung genau
      gefehlt
- [x] 8.2 ~~Dasselbe auf dem oeffentlichen Profil~~ — **entfaellt mit 1.4.**
      Die Zusage fuer diese Flaeche ist strukturell: im ganzen Quelltext gibt es
      **genau ein** `<iframe>`, und das steht in `VideoEmbed`. Kein `<embed>`,
      kein `<object>`, kein dynamisch erzeugter Rahmen, kein `preconnect`
- [x] 8.3 Positivkontrolle: nach der Aktivierung **erscheint** der Aufruf. Ohne
      sie ist ein Leerlauf vom Erfolg nicht zu unterscheiden
- [x] 8.4 Video spielt nach **einem** Klick, YouTube und Vimeo
- [x] 8.5 Beide Themes (`hell` und `navy`) und 320 px

## 9 · Abschluss

- [x] 9.1 `pnpm lint && pnpm typecheck && pnpm test && pnpm build` gruen
- [x] 9.2 Diff-Review durch einen unabhaengigen Leser
- [x] 9.3 `openspec validate --all` gruen, Change archivieren
- [x] 9.4 PR, Linear auf Done
