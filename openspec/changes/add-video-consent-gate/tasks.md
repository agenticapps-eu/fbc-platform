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
- [ ] 1.4 RED auf einem oeffentlichen Profil mit hinterlegtem Video

## 2 · Die Vorschaufläche

- [ ] 2.1 Test zuerst: `VideoEmbed` rendert beim ersten Mal **kein** `<iframe>`
- [ ] 2.2 Test: nach Aktivierung steht das `<iframe>` da
- [ ] 2.3 Test: die Flaeche nennt den Anbieter, benennt die Folge der
      Aktivierung und verlinkt `/datenschutz`
- [ ] 2.4 Test: die Flaeche traegt **kein** `<img>` mit fremdem Ursprung
- [ ] 2.5 Test: sie ist ein **`<button>`** mit zugaenglichem Namen, der den
      Anbieter nennt, und per Tastatur ausloesbar — kein `div` mit `onClick`
- [ ] 2.6 Test: zwei Videos auf einer Seite, eines aktiviert — das andere
      bleibt Flaeche
- [ ] 2.7 Test: die Einwilligung haengt an der **URL**, nicht an der Instanz.
      Wechselt die URL bei stehender Komponente, faellt die Flaeche zurueck.
      Der Profil-Editor schluesselt Zeilen nach Index — ohne das laedt eine
      geaenderte Zeile den neuen Anbieter ohne neue Aktivierung
- [ ] 2.8 Test: die Aktivierung ueberlebt kein Neumontieren
- [ ] 2.9 Implementieren. Gespeichert wird die **aktivierte URL**, nicht ein
      `boolean`. Der Verweis auf `/datenschutz` liegt **ausserhalb** des
      Knopfes — ein Link im Knopf ist ungueltiges Markup und eine Tastaturfalle
- [ ] 2.10 Flaeche und Rahmen teilen sich `aspect-video`, damit die Aktivierung
      nichts verschiebt
- [ ] 2.11 Nach dem Austausch wandert der Fokus auf den Rahmen, statt auf
      `document.body` zu fallen

## 3 · Autoplay — sonst ist das Tor eine Verschlechterung

> Aus der Review, von zwei Anbietern unabhaengig: ein nachtraeglich eingesetztes
> `iframe` laedt den Player **pausiert**. Ohne diesen Abschnitt muesste der
> Besucher ein zweites Mal klicken, diesmal im fremden Rahmen.

- [ ] 3.1 Test: die URL des aktivierten Rahmens traegt `autoplay=1`
- [ ] 3.2 `autoplay=1` wird **in `VideoEmbed`** an die aktivierte URL gehaengt,
      **nicht** in `parseVideoUrl` — die kanonische Grenze bleibt sauber und die
      SQL-Paritaet unberuehrt
- [ ] 3.3 Das `allow`-Attribut fuehrt `autoplay` bereits; belegen, dass die
      Freigabe an den fremden Rahmen durchgereicht wird
- [ ] 3.4 Im Browser belegen, dass nach **einem** Klick tatsaechlich abgespielt
      wird — bei YouTube **und** bei Vimeo

## 4 · Die datensparsamsten Adressen

- [ ] 4.1 Test: die gebaute YouTube-URL zeigt auf `youtube-nocookie.com`
- [ ] 4.2 Test: die gebaute Vimeo-URL traegt `dnt=1`
- [ ] 4.3 Test: die **akzeptierten Quell-Hosts** sind unveraendert — ein
      `youtube-nocookie`-Link bleibt abgelehnt, genau wie heute
- [ ] 4.4 `parseVideoUrl` anpassen (nur die gebaute URL)
- [ ] 4.5 **`src/lib/feed.test.ts` anpassen** — sieben Assertions pinnen
      `embedUrl: "https://www.youtube.com/embed/…"` (Zeilen 91, 126, 130, 132,
      134, 148). Anpassen, nicht loeschen
- [ ] 4.6 `scripts/probe-c9-parser-paritaet.ts` laufen lassen und gruen belegen

## 5 · Die bestehenden Tests, die rot werden

- [ ] 5.1 `src/components/ui/VideoEmbed.test.tsx` — erwartet heute das `<iframe>`
      beim ersten Rendern
- [ ] 5.2 **`src/pages/HomePage.test.tsx:43-53`** — erwartet
      `expect(iframe).not.toBeNull()` beim ersten Rendern und `src` mit
      `youtube.com/embed/…`. Die Zusage „die nackte Watch-URL steht nicht mehr
      im Text" **bleibt erhalten**
- [ ] 5.3 `grep` auf `youtube\|vimeo\|iframe` ueber alle `*.test.*`, um eine
      vierte Suite nicht erst in CI zu finden

## 6 · Alle fuenf Aufrufer

- [ ] 6.1 Belegen, dass keine Aufrufstelle am `VideoEmbed` vorbei einbettet.
      **Nicht nur `<iframe`** — auch nach den Anbieter-Domaenen, `<embed`,
      `<object` und dynamisch erzeugten Rahmen suchen
- [ ] 6.2 Sichtprobe je Flaeche: Startseite, oeffentliches Profil, Feed,
      Academy, Profil-Editor

## 7 · Die Rechtstexte — drei Stellen, nicht zwei

- [ ] 7.1 `src/content/legal/datenschutz.ts:43` — offener Punkt entfaellt
- [ ] 7.2 `src/content/legal/datenschutz.ts:452 ff.` — der Abschnitt zu
      YouTube/Vimeo beschreibt das Tor statt des Mangels
- [ ] 7.3 `src/content/legal/cookies.ts:26` — offener Punkt entfaellt
- [ ] 7.4 **`src/content/legal/cookies.ts:601`** — dort steht „Ihre Einwilligung
      erfolgt über unser Cookie-Consent-Banner." Diesen Satz stehen zu lassen,
      waehrend die Einwilligung je Video an der Flaeche erfolgt, macht den Text
      widerspruechlich
- [ ] 7.5 Bestehende Tests unter `src/content/legal/` gegen die alten
      Formulierungen pruefen

## 8 · Gegenprobe im Browser

- [ ] 8.1 **GREEN:** ausgeloggt auf `/` — die **Menge aller fremden Ursprünge
      ist leer**. Keine Ausschlussliste: eine Liste ist immer eine Zeile zu
      kurz, und `youtube-nocookie.com` haette in der ersten Fassung genau
      gefehlt
- [ ] 8.2 Dasselbe auf dem oeffentlichen Profil
- [ ] 8.3 Positivkontrolle: nach der Aktivierung **erscheint** der Aufruf. Ohne
      sie ist ein Leerlauf vom Erfolg nicht zu unterscheiden
- [ ] 8.4 Video spielt nach **einem** Klick, YouTube und Vimeo
- [ ] 8.5 Beide Themes (`hell` und `navy`) und 320 px

## 9 · Abschluss

- [ ] 9.1 `pnpm lint && pnpm typecheck && pnpm test && pnpm build` gruen
- [ ] 9.2 Diff-Review durch einen unabhaengigen Leser
- [ ] 9.3 `openspec validate --all` gruen, Change archivieren
- [ ] 9.4 PR, Linear auf Done
