# Session Handoff — 2026-09-10 (AGE-705; der Blog liegt auf `main`)

> ## ⚠ ZUERST — Scope dieser Übergabe
>
> **1. Sie führt AGE-705**, Change `oeffentlicher-release-blog`. Blöcke 1–4 und
> die neuen **Blöcke 7 und 8** sind fertig bis auf **4.5** und **8.7** (beide
> Donald). Offen: 4.5, 8.7, Block 5, Block 6.
>
> **2. Alles ist gemergt.** PR #387, Squash `c8bcfdb`, 10.09. 07:15 UTC.
> Der Arbeitsplatz bleibt der Worktree
> `~/worktrees/fbc-platform/donald-age-705-oeffentlicher-release-blog`
> (Branch gleichen Namens, nicht gelöscht). `main` ist hier NICHT auscheckbar —
> das Hauptverzeichnis hält es.
> **Der Merge hat nichts veröffentlicht:** 23× `freigegeben: false` auf `main`
> nachgezählt, 0× `true`. Öffentlich lesbar sind die Texte und Bilder aber
> sehr wohl — das Repository ist öffentlich.
>
> **3. AGE-642/AGE-708 haben eine EIGENE Sitzung.** Diese Datei auf `main`
> gehörte ihr und trug den Zeiger auf M3/AGE-643; mit `c8bcfdb` ersetzt sie
> diese Fassung. Die alte steht im Verlauf: `git show 6a22bd9:session-handoff.md`.
> Die Sitzung ist per `SendMessage` unterrichtet. **Nicht zusammenführen.**
>
> **4. Die 23 Bilder liegen im Repo** (`blog/bilder/`, 5,0 MB, auf `main`).
> `~/worktrees/fbc-blog-bilder/werkzeug/` bleibt die Werkbank, mit
> `LOKALER-STAND-09-09.md` (Änderungen am lokalen Stack und ihre Rücknahme).

## Was diese Sitzung geschafft hat

**Der Blog hat jetzt zwei Flächen** — auf Donalds Befund, die thematische
Gliederung sei verwirrend:

| Fläche | Frage | Ordnung | Quelle |
|---|---|---|---|
| **Blog** (`index.html`) | Was ist neu? | 6 Wochenausgaben, jüngste zuerst | `release-ausgaben.ts` |
| **Tutorial** (`tutorial.html`) | Wie geht das? | 7 Etappen, ein Weg | `release-tutorial.ts` |

Beide zeigen auf dieselbe Kapitelseite; jede verweist aufs nächste Kapitel, das
letzte endet. Links auf jeder Seite eine Leiste mit beiden Flächen, oben ein
Kopfbereich wie in der App; eine Kapitelseite erbt das Motiv ihrer Etappe, man
sieht also, wo im Weg man steht.

**Alle 23 Screenshots neu aufgenommen**, ohne fremde Gesichter. **Der
Artefakt-Wächter** nahm `img`/`aside` in die Erlaubnisliste auf, und `src` geht
durch **dieselbe** Ursprungsregel wie `href` — drei rote Tests belegen das.

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

## Fallen, die Zeit gekostet haben

Alle vier dauerhaft im Gedächtnis unter `blog-bau-vier-fallen` (Backtick im
CSS-Kommentar, `grid-row: 1 / -1`, `bildUrl()`, `update` ohne `where`); die
Screenshot-Fallen in `werkzeug/LOKALER-STAND-09-09.md`.

## Files modified

Alles in `c8bcfdb`; `git show --stat c8bcfdb` ist die vollständige Liste. Die
Stellen, an denen man weiterarbeitet:

- `src/content/release-ausgaben.ts` / `release-tutorial.ts` — die zwei Ordnungen.
- `src/content/release-geschichten.ts` — 23 Kapitel, alle `freigegeben: false`.
  **Hier setzt 4.5 an.**
- `scripts/build-blog.ts` — alle Seiten, Leiste, Kopfbereich, Kopierschritt, Stil.
- `scripts/blog-artefakt-waechter.ts` — Erlaubnisliste, `ADRESSEN` für beide.
- `openspec/changes/oeffentlicher-release-blog/tasks.md` — Blöcke 5 und 6 offen.
- Unberührt: `supabase/`, `release-entries.generated.ts`, `AdminNeuigkeitenPage.tsx`.

## Abnahme

**Alle Zahlen NACH dem Rebase gemessen**, nicht davor — er zog 18 fremde
Commits ein, die eigene Tests mitbrachten.

`pnpm test` **2751 grün** (239 Dateien) · `typecheck` 0 · `lint` 0 (0 Fehler,
7 Warnungen Vorzustand) · `pnpm build` 0 · `openspec validate --all` 33/33 ·
`pnpm blog:build` schreibt **2 Seiten**, weil nichts freigegeben ist ·
Sichtprobe beider Übersichten und einer Kapitelseite in hell und dunkel, auf
1440 und 390 px (vor dem Rebase).

**CI auf PR #387** alle grün (`verify` 4m24s, `migrations` 2m21s, `deploy`
1m15s); `drift-gate`/`functions`/`migrate-dev` übersprungen, keine Migration.
**Nach dem Merge auf `main`:** `CI` und `Deploy` `success`. Der
Edge-Functions-Schritt meldet „Nichts auszuliefern" — richtig, der Blog fasst
`supabase/` nicht an. **PROD ist unverändert.**

## Next session: start here — die Freigabe, dann Cloudflare

**Stand: Schritt 1 ist erledigt.** Der Code liegt auf `main` (`c8bcfdb`), CI und
Deploy dort grün, AGE-705 steht wieder auf **In Progress** — der Merge hatte es
über den Branchnamen auf „Done" gesetzt, das war falsch und ist zurückgenommen.

**Der nächste Schritt ist keiner, den eine Sitzung tun kann: 4.5 und 8.7 sind
Donalds Entscheidungen.** Ohne sie baut `blog:build` zwei leere Übersichten,
und ein Cloudflare-Deploy lieferte genau die aus.

Die verbleibenden Schritte:

1. ~~**Rebase, committen, PR, Merge.**~~ **Erledigt 10.09.**, PR #387 →
   `c8bcfdb`. Konflikte in `package.json` (beide Seiten behalten) und
   `session-handoff.md` (eigene Fassung, andere Sitzung unterrichtet).
2. **[Donald] 4.5** redaktionelle Abnahme (`werkzeug/dump.ts` + `fahne.ts`
   erzeugen die Lesefläche neu) und **8.7** die gesetzten Ausgabedaten
   bestätigen. Danach `freigegeben: true` — **erst dann** schreibt
   `pnpm blog:build` mehr als die zwei leeren Übersichten.
3. **[Donald] 5.1** Cloudflare-Pages-Projekt anlegen — der Name ist die einzige
   Angabe, die 5.2 braucht (Vorschlag `fbc-blog`); der vorhandene
   `CLOUDFLARE_API_TOKEN` in Infisical muss es abdecken.
4. **5.2** Deploy: ein **eigener Job** in `deploy.yml`, nicht ein Schritt im
   bestehenden — ein Fehlschlag des einen muss das andere unverändert lassen,
   und ein Schritt im selben Job liefe nach einem gescheiterten App-Deploy gar
   nicht erst. Muster in `deploy.yml:677`; der Blog braucht kein `pnpm build`,
   nur `pnpm blog:build` und `wrangler pages deploy ./dist-blog`.
   **Bewusst noch nicht geschrieben:** ohne das Projekt aus 5.1 wäre der Job
   auf jedem PR und auf `main` rot.
5. **[Donald] 5.3** Bei Strato `www.effbeezee.com` als CNAME auf
   `<projekt>.pages.dev`, danach die Domain im Pages-Projekt eintragen. `www`
   geht denselben Weg wie `app.effbeezee.com` seit dem 01.09.; der nackte Apex
   kann kein CNAME (AGE-256).
6. **5.4** Live-Adresse aufrufen — ein grüner Workflow belegt die Auslieferung
   **nicht**. Dabei gegenprüfen, dass keine nicht freigegebene Geschichte
   erreichbar ist.

Vorher ansehen, ohne die Quelle anzufassen, aus dem Worktree heraus:
`pnpm exec tsx ~/worktrees/fbc-blog-bilder/werkzeug/vorschau.ts <ordner>` baut
alle 31 Seiten mit `freigegeben: true`.

## Open questions

- **4.5 und 8.7** — beide unbeantwortet, beide blockieren alles Weitere.
- **Sollen die Texte kürzer werden?** Weiter kürzen heißt Inhalt streichen.
- **Release-Notes in der Aktivität** — unverändert offen, bleibt draußen?
- **`pnpm format:check` ist rot** — Vorzustand, läuft in KEINEM CI-Workflow.
- **`effbeezee.com` ohne `www`** — Weiterleitung bei Strato, oder gar nicht?
