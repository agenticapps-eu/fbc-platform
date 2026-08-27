# Tasks — Video-Freigabe merken (AGE-621)

## 1. Die Freigabe als eigener Ort

- [x] `src/lib/video-freigabe.ts`: lesen, setzen, widerrufen je Anbieter,
      gespeichert unter genau einem Schlüssel. Jeder Zugriff auf den Speicher
      gefangen — er wirft in abgeschotteten Kontexten, und er wird beim Rendern
      gelesen.
- [x] Ein Abonnement, damit die übrigen Flächen derselben Seite ohne Neuladen
      nachziehen (`useSyncExternalStore`).
- [x] RED zuerst: Test, dass eine Freigabe über eine neue Montage hinweg gilt,
      dass sie nicht auf den anderen Anbieter übergreift, und dass ein
      werfender Speicher weder die Anzeige noch das Tor beschädigt.

## 2. `VideoEmbed` auf die Freigabe umstellen

- [x] Offen ist die Fläche, wenn der **Anbieter** freigegeben ist — nicht mehr,
      wenn diese eine URL angeklickt wurde.
- [x] `autoplay=1` **nur** beim frischen Klick auf genau diese URL. Der Test
      dafür muss rot werden können: zwei Videos eines freigegebenen Anbieters,
      keines trägt `autoplay`.
- [x] `focus()` **nur** beim frischen Klick. Sonst wandert beim Seitenaufruf der
      Fokus in einen fremden Rahmen.
- [x] Der Hinweistext unter der Fläche sagt, dass die Entscheidung gemerkt wird
      und wo sie zurückzunehmen ist.

## 3. Widerruf auf der Datenschutzseite

- [x] `src/components/VideoFreigabeWiderruf.tsx`: nennt die freigegebenen
      Anbieter und nimmt sie einzeln zurück; sagt ausdrücklich, wenn keiner
      freigegeben ist.
- [x] In `LegalPage` für die Datenschutzseite gerendert — **nicht** als vierte
      Blockart. `types.ts` begründet, warum es genau drei gibt.
- [x] Ohne Konto erreichbar. Das Tor betrifft ausgeloggte Besucher der
      Startseite; eine Einstellungsseite hinter der Anmeldung scheidet aus.

## 4. Rechtstexte nachziehen

Sie behaupten heute wörtlich das Gegenteil. Vier Stellen:

- [x] `datenschutz.ts` — Absatz „Ihre Entscheidung gilt für dieses eine Video
      und wird nicht gespeichert […] Wir bitten Sie also bei jedem Video
      erneut".
- [x] `datenschutz.ts` — `offenePunkte`: das Verfahren ist ein anderes.
- [x] `cookies.ts` — Absatz „Diese Entscheidung gilt für dieses eine Video und
      wird nicht gespeichert."
- [x] `cookies.ts` — der gespeicherte Wert ist eine Technologie im Sinne des
      §25 TTDSG und wird benannt, samt Speicherdauer und Widerrufsweg.
- [x] `datenschutz.test.ts` gegengeprüft: bleibt grün, **ohne** Änderung. Der
      Test hängt an Struktur und Metadaten, nicht am Wortlaut der geänderten
      Absätze — nichts nachzuziehen, also auch nichts angefasst.

## 5. Abnahme am Artefakt, nicht am Test

Gemessen auf **`/academy`**, nicht auf `/`. Die Startseite zieht ihre Videos aus
dem Feed und braucht dafür gesäte Beiträge; `/academy` trägt drei feste Videos —
**zwei YouTube und ein Vimeo**. Das ist die schärfere Fläche: nur dort lässt sich
„zweites Video desselben Anbieters lädt mit" und „der andere Anbieter tut es
nicht" in derselben Messung zeigen. Die Seite liegt hinter der Anmeldung, die
Messung lief also eingeloggt.

- [x] Speicher leer: **Menge** aller fremden Ursprünge ist `[]`, 0 iframes,
      3 Flächen. Gemessen wird die Menge, keine Ausschlussliste — eine Liste ist
      immer eine Zeile zu kurz.
- [x] Klick auf Video 1: fremde Ursprünge genau
      `["https://www.youtube-nocookie.com"]`, geklicktes Video `autoplay=1` und
      fokussiert, **Video 2 geladen** mit `autoplay: null` und ohne Fokus,
      Vimeo bleibt Fläche, gespeichert `"youtube"`.
- [x] Neu laden: beide YouTube-Rahmen da, **beide `autoplay: null`**,
      `document.activeElement` ist `BODY`.
- [x] Widerruf auf `/datenschutz`, zurück auf `/academy`: wieder `[]` fremde
      Ursprünge, 0 iframes, 3 Flächen.
- [x] Breite am Inhaltsbedarf gemessen, nicht am Fenster: der Knopf brauchte
      246 px bei 248 px verfügbarem Innenraum (320 px − `px-4` − `p-5`). Zwei
      Pixel, und `size="sm"` hat eine feste Höhe — ein Umbruch wäre beschnitten
      worden. Kürzerer Text: **226 px**, 22 px Reserve, eine Zeile.
- [x] `pnpm test`, `pnpm build`, `pnpm lint`, `pnpm format:check` grün.
      Nie `pnpm format` — das schreibt fremde Dateien um.
