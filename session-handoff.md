# Session Handoff — 2026-09-10 (AGE-705; alles gemergt, es fehlt die Freigabe)

> ## ⚠ ZUERST — und die erste Handlung steht ganz unten
>
> **1. Sie führt AGE-705**, Change `oeffentlicher-release-blog`. Blöcke 1–4, 7
> und 8 sind fertig **bis auf 4.5 und 8.7 — beides Donalds Entscheidungen und
> beides blockiert alles Weitere.** Offen ausserdem: Block 5, Block 6.
>
> **2. Der Code ist vollständig gemergt.** PR #387 → `c8bcfdb`, PR #388 →
> `3eedaf3`, beide am 10.09. CI und Deploy auf `main` grün.
> Arbeitsplatz bleibt der Worktree
> `~/worktrees/fbc-platform/donald-age-705-oeffentlicher-release-blog`
> (Branch gleichen Namens, nicht gelöscht, steht auf `3eedaf3`).
> **`main` ist hier NICHT auscheckbar** — das Hauptverzeichnis hält es.
>
> **3. Nichts ist veröffentlicht.** 23× `freigegeben: false`, 0× `true` auf
> `main` nachgezählt; `pnpm blog:build` schreibt darum zwei leere Übersichten.
> Öffentlich *lesbar* sind Texte und Bilder gleichwohl — das Repo ist öffentlich.
>
> **4. AGE-642/AGE-708 haben eine EIGENE Sitzung.** Diese Datei gehörte auf
> `main` ihr und trug den Zeiger auf M3/AGE-643; `c8bcfdb` hat sie ersetzt, die
> alte steht in `git show 6a22bd9:session-handoff.md`, die Sitzung ist per
> `SendMessage` unterrichtet. **Nicht zusammenführen.**
>
> **5. Der Merge setzt AGE-705 jedes Mal auf „Done"** — der Branchname genügt
> dafür. Zweimal passiert, zweimal zurückgesetzt. **Nach jedem Merge nachsehen.**

## Was gebaut wurde

**Der Blog hat zwei Flächen** — auf Donalds Befund, die thematische Gliederung
sei verwirrend:

| Fläche | Frage | Ordnung | Quelle |
|---|---|---|---|
| **Blog** (`index.html`) | Was ist neu? | 6 Wochenausgaben, jüngste zuerst | `release-ausgaben.ts` |
| **Tutorial** (`tutorial.html`) | Wie geht das? | 7 Etappen, ein Weg | `release-tutorial.ts` |

Beide zeigen auf dieselbe Kapitelseite; jede verweist aufs nächste, das letzte
endet. Links auf jeder Seite eine Leiste mit beiden Flächen, oben ein
Kopfbereich wie in der App; eine Kapitelseite erbt das Motiv ihrer Etappe.

**Alle 23 Screenshots** ohne fremde Gesichter. **Der Artefakt-Wächter** nahm
`img`/`aside` in die Erlaubnisliste auf, und `src` geht durch **dieselbe**
Ursprungsregel wie `href` — drei rote Tests belegen das.

## Entscheidungen (mit Grund)

- **Die Ausgabedaten sind GESETZT, nicht gemessen** (Donald: „erstmal erfundene
  Daten"): sechs Wochen ab 1. August, 3–5 Funktionen je Ausgabe. Die Funktionen
  sind echt und gegen die Anwendung geprüft, nur die Bündelung in Wochen ist
  redaktionell erfunden. **Vor dem Live-Gang zu entscheiden** (8.7).
- **Nur die Einleitung einer Ausgabe darf „neu" sagen** — sie meldet einen
  Zeitraum; der Text der Geschichte bleibt zeitlos, weil er auch im Tutorial
  steht. Als benannte Ausnahme im Spec-Delta.
- **`thema` und `RELEASE_THEMEN` sind raus.** Keine Fläche liest sie mehr; ein
  drittes Ordnungsmerkmal wäre eine zweite Antwort auf dieselbe Frage.
- **Keine Avatare von `i.pravatar.cc`** (Donald, auf Vorlage): Fotos echter
  Menschen unter erfundenen Namen, in einem öffentlichen Repo. `avatar_url =
  null`, die App zeigt Monogramme. **Nicht** weichzeichnen — das läse sich wie
  ein zensierter echter Datensatz. Kartencover aus den eigenen
  `public/images/hero-*.webp` statt `picsum.photos`, dieselbe Frage in klein.
- **Das Kopfbild ist ein `<img>`, kein `background-image`** — der Wächter liest
  Elemente und Attribute; eine Adresse im Stil entzöge sich ihm.
- **Bilder unter `blog/bilder/`, nicht `public/`** — sonst gingen sie mit jedem
  App-Deploy mit; kopiert werden **nur die freigegebenen**.

## Fallen

Vier dauerhaft im Gedächtnis unter `blog-bau-vier-fallen` (Backtick im
CSS-Kommentar, `grid-row: 1 / -1`, `bildUrl()`, `update` ohne `where`); die
Screenshot-Fallen in `werkzeug/LOKALER-STAND-09-09.md`. **Und: ein Werkzeug der
Werkbank kann an einer Änderung im Repo brechen, ohne dass es jemand merkt** —
`dump.ts` lag einen Tag tot, weil `RELEASE_THEMEN` entfiel. Vor dem Weiterreichen
ausführen, nicht nur nennen.

## Files modified

Alles in `c8bcfdb` (`git show --stat c8bcfdb`). Wo man weiterarbeitet:

- `src/content/release-geschichten.ts` — 23 Kapitel, alle `freigegeben: false`.
  **Hier setzt 4.5 an.**
- `release-ausgaben.ts` / `release-tutorial.ts` — die zwei Ordnungen.
- `scripts/build-blog.ts` und `blog-artefakt-waechter.ts` — Erzeuger und Wächter.
- `openspec/changes/oeffentlicher-release-blog/tasks.md` — Blöcke 5 und 6 offen.
- Unberührt: `supabase/`, `release-entries.generated.ts`, `AdminNeuigkeitenPage.tsx`.

## Abnahme (Stand `3eedaf3`)

`pnpm test` **2751 grün** (239 Dateien) · `typecheck` 0 · `lint` 0 (0 Fehler,
7 Warnungen Vorzustand) · `pnpm build` 0 · `openspec validate --all` 33/33 ·
`pnpm blog:build` schreibt **2 Seiten**, weil nichts freigegeben ist ·
Sichtprobe beider Übersichten und einer Kapitelseite in hell und dunkel, auf
1440 und 390 px. CI auf #387 und #388 grün, danach `CI` und `Deploy` auf `main`
`success`. Der Edge-Functions-Schritt meldet „Nichts auszuliefern" — richtig,
der Blog fasst `supabase/` nicht an, **PROD ist unverändert.**

Alle Zahlen NACH dem Rebase gemessen — er zog 18 fremde Commits ein, die eigene
Tests mitbrachten; die alten 2695/237 beschrieben eine Basis, die es nicht gibt.

## Next session: start here

**Die erste Handlung ist, Donald die 23 Texte zum Lesen zu geben.** Alles
Weitere hängt daran: solange nichts freigegeben ist, baut `blog:build` zwei
leere Übersichten, und ein Cloudflare-Deploy lieferte genau die aus.

```
cd ~/worktrees/fbc-platform/donald-age-705-oeffentlicher-release-blog
pnpm exec tsx ~/worktrees/fbc-blog-bilder/werkzeug/dump.ts /tmp/abnahme.json
pnpm exec tsx ~/worktrees/fbc-blog-bilder/werkzeug/fahne.ts /tmp/abnahme.json /tmp/abnahme.html
open /tmp/abnahme.html
```

Erwartet: `23 Geschichten, 7 Etappen` · `freigegeben=true: 0` · `23 Fahnen`.
Kein lokaler Stack nötig. **`dump.ts` war kaputt und ist am 10.09. repariert** —
es importierte `RELEASE_THEMEN`, das mit diesem Change entfiel; es gruppiert
jetzt nach den Tutorial-Etappen. Eine erzeugte Fassung liegt zum Vergleich als
`werkzeug/abnahme-BEISPIEL.html`.

Den fertigen Blog ansehen, ohne die Quelle anzufassen (setzt die Freigabe nur
im Lauf, nicht in der Datei):
`pnpm exec tsx ~/worktrees/fbc-blog-bilder/werkzeug/vorschau.ts <ordner>` — 31 Seiten.

Danach, in dieser Reihenfolge:

1. **[Donald] 4.5** die Abnahme, **8.7** die Ausgabedaten bestätigen. Dann
   `freigegeben: true` setzen — **erst dann** schreibt `blog:build` mehr als
   die zwei leeren Übersichten.
2. **[Donald] 5.1** Cloudflare-Pages-Projekt anlegen; der Name ist die einzige
   Angabe, die 5.2 braucht (Vorschlag `fbc-blog`). Der vorhandene
   `CLOUDFLARE_API_TOKEN` in Infisical muss es abdecken.
3. **5.2** Deploy als **eigener Job** in `deploy.yml`, nicht als Schritt im
   bestehenden — ein Fehlschlag des einen muss das andere unverändert lassen,
   und ein Schritt im selben Job liefe nach einem gescheiterten App-Deploy gar
   nicht erst. Muster in `deploy.yml:677`; kein `pnpm build` nötig, nur
   `pnpm blog:build` und `wrangler pages deploy ./dist-blog`.
   **Bewusst noch nicht geschrieben:** ohne das Projekt aus 5.1 wäre er rot.
4. **[Donald] 5.3** Bei Strato `www.effbeezee.com` als CNAME auf
   `<projekt>.pages.dev`, danach die Domain im Pages-Projekt eintragen. Der
   nackte Apex kann kein CNAME (AGE-256).
5. **5.4** Live-Adresse aufrufen — ein grüner Workflow belegt die Auslieferung
   **nicht**. Dabei gegenprüfen, dass keine nicht freigegebene Geschichte
   erreichbar ist.

## Open questions

- **4.5 und 8.7** — beide unbeantwortet, beide blockieren alles Weitere.
- **Sollen die Texte kürzer werden?** Weiter kürzen heißt Inhalt streichen.
- **Release-Notes in der Aktivität** — unverändert offen, bleibt draußen?
- **`pnpm format:check` ist rot** — Vorzustand, läuft in KEINEM CI-Workflow.
- **`effbeezee.com` ohne `www`** — Weiterleitung bei Strato, oder gar nicht?
