# Aufgaben — `support-bereich` (AGE-904)

## 1. Bilder ins Bündel der Anwendung

- [ ] 1.1 `blog/bilder/*.png` nach `public/tutorial/*.webp` wandeln (`cwebp -q 82`), Abmessungen gegen die Quelle prüfen — sie müssen zeichengleich zu `width`/`height` in `release-geschichten.ts` bleiben
- [ ] 1.2 `blog/bilder/` entfernen; `public/images/CREDITS.md` daraufhin lesen, ob es die Kapitelbilder nennt (Motive bleiben unberührt)
- [ ] 1.3 In `src/content/release-geschichten.ts` die 23 `bild.src` auf `/tutorial/<name>.webp` setzen — nur diese Zeilen, keine Textänderung
- [ ] 1.4 `src/types/release.ts`: den Kommentar an `ReleaseGeschichte.bild` umschreiben — die Datei liegt jetzt im Bündel der Anwendung, nicht im Ausgabeordner des Blogs
- [ ] 1.5 `src/content/release-geschichten.test.ts`: Pfadmuster auf `^/tutorial/[a-z0-9-]+\.webp$`, Fundort auf `public/tutorial` — die Zusage „Bild ohne Datei fällt auf" bleibt
- [ ] 1.6 `scripts/build-blog.ts`: `BILDER_QUELLE`, `BILDPFAD` und der Ausgabeordner auf `tutorial`; `bilderZumAusliefern` schneidet das neue Präfix ab. Motive (`public/images` → `/bilder/`) unverändert
- [ ] 1.7 Gegenprobe: `pnpm blog:build` (oder das entsprechende Skript) läuft, und im Artefakt liegt zu jeder freigegebenen Geschichte ihre Bilddatei unter `tutorial/`

## 2. Route und Seite

- [ ] 2.1 `src/pages/HilfeTutorialsPage.tsx` anlegen: Sprungmarken über die Etappen, darunter Etappe für Etappe die Kapitel mit Bild und Absätzen (D7), Bilder ab dem zweiten mit `loading="lazy"` (D8)
- [ ] 2.2 Nur freigegebene Geschichten zeigen; eine Etappe ohne freigegebenes Kapitel fällt ganz weg (wie im Blog)
- [ ] 2.3 `src/config/nav.ts`: `navItem` `/hilfe/tutorials` am ENDE der Liste, `section: "sub"`, `requiresAuth: true`, kein `minTier`, `lazy()`-Import wie die anderen Seiten
- [ ] 2.4 `src/config/nav.test.ts`: `ALLE_ROUTEN` um die Zeile ergänzen (14 → 15)
- [ ] 2.5 Tests zur Seite: Reihenfolge der Etappen (erste ist „Ankommen"), Entwurf erscheint nicht, Sprungmarke trägt das Ziel der Etappe, jedes Bild trägt Breite und Höhe und zeigt auf `/tutorial/`

## 3. Support-Abschnitt in der Seitenleiste

- [ ] 3.1 `AppShell.tsx` Desktop-Fuss: aus dem `<div>` mit dem `FeedbackButton` einen Abschnitt „Support" mit zwei Einträgen machen; Überschrift eingeklappt verborgen, Einträge behalten ihren zugänglichen Namen
- [ ] 3.2 `AppShell.tsx` Schublade: derselbe Abschnitt; „Tutorials" über den bestehenden `onNavigate`-Weg, `onOffenChange={setFeedbackInSchublade}` bleibt am Feedback-Eintrag
- [ ] 3.3 `FeedbackButton.tsx` NICHT anfassen; der Kommentarkopf darf eine Zeile bekommen, die auf den Abschnitt verweist
- [ ] 3.4 Tests: beide Einträge offen, eingeklappt und in der Schublade erreichbar; „Tutorials" aus der Schublade navigiert und schliesst sie; die sieben Menüeinträge sind unverändert

## 4. Die alten Zusagen halten

- [ ] 4.1 `src/components/AppShell.overlay.test.tsx` läuft unverändert grün — genau ein `aria-modal` (AGE-688), Escape trifft erst das Formular (AGE-697)
- [ ] 4.2 `src/components/feedback/FeedbackButton.test.tsx` läuft unverändert grün, inklusive „schwebt GAR NICHT MEHR"
- [ ] 4.3 `pnpm test` und `pnpm typecheck` grün; `pnpm format:check` statt `pnpm format`

## 5. Gemessen, nicht vermutet

- [ ] 5.1 `pnpm build`, danach **sofort** `git checkout -- src/content/release-entries.generated.ts`
- [ ] 5.2 Bündelgrösse am gebauten Artefakt messen (`dist`), Vorher/Nachher in den PR schreiben — der Wert wird für AGE-907 gebraucht
- [ ] 5.3 Lokal im Browser zeigen: Tutorial-Fläche in BEIDEN Themes (hell und navy, `data-variant`), Leiste offen und eingeklappt, Schublade auf 375 px — Screenshots in den PR
- [ ] 5.4 Gegenprobe zur Bildherkunft: auf der laufenden Seite trägt kein `img` eine Adresse ausserhalb der Anwendung

## 6. Abschluss

- [ ] 6.1 `openspec validate --all` grün
- [ ] 6.2 Signierte Conventional Commits mit `(AGE-904)`, Branch `donald/age-904-support-bereich`
- [ ] 6.3 PR gegen `main`; im Text: die gemessene Bündelgrösse, die Screenshots, und der Hinweis, dass AGE-906 danach `www` abschaltet
- [ ] 6.4 AGE-904 in Linear auf In Progress (erst `get_issue`, dann schreiben)
