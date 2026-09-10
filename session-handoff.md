# Session Handoff — 2026-09-09 (AGE-705; zwei Flächen, 23 Bilder neu)

> ## ⚠ ZUERST — Scope dieser Übergabe
>
> **1. Sie führt AGE-705**, Change `oeffentlicher-release-blog`. Blöcke 1–4 und
> die neuen **Blöcke 7 und 8** sind fertig bis auf **4.5** und **8.7** (beide
> Donald). Offen: 4.5, 8.7, Block 5, Block 6.
>
> **2. Der Arbeitsplatz ist ein Worktree, nicht `main`:**
> `~/worktrees/fbc-platform/donald-age-705-oeffentlicher-release-blog`,
> Branch `donald/age-705-oeffentlicher-release-blog`.
> **Nichts ist committet.** `git status` zeigt die Arbeit, `git log` nicht.
>
> **3. AGE-642/AGE-708 haben eine EIGENE Sitzung.** Die Fassung dieser Datei
> auf `main` gehört ihr — **nicht zusammenführen**.
>
> **4. Die 23 Bilder liegen jetzt IM Repo** (`blog/bilder/`, 5,1 MB, untracked).
> `~/worktrees/fbc-blog-bilder/werkzeug/` bleibt die Werkbank — inklusive
> **`LOKALER-STAND-09-09.md`**: was am lokalen Stack geändert wurde und wie es
> sich wiederherstellen lässt.

## Was diese Sitzung geschafft hat

**Der Blog hat jetzt zwei Flächen** — auf Donalds Befund, die thematische
Gliederung sei verwirrend:

| Fläche | Frage | Ordnung | Quelle |
|---|---|---|---|
| **Blog** (`index.html`) | Was ist neu? | 6 Wochenausgaben, jüngste zuerst | `release-ausgaben.ts` |
| **Tutorial** (`tutorial.html`) | Wie geht das? | 7 Etappen, ein Weg | `release-tutorial.ts` |

Beide zeigen auf dieselbe Kapitelseite; jede verweist auf das nächste Kapitel,
das letzte endet. Links auf **jeder** Seite eine Leiste mit Marke und beiden
Flächen (die aktuelle ausgezeichnet), oben ein Kopfbereich wie in der App —
Motiv aus `public/images/`, Titel darüber. Eine Kapitelseite erbt das Motiv
ihrer Etappe, man sieht also, wo im Weg man steht. Übersichten führen je Eintrag
ein `<article>` mit Bild, Titel, Datum, **Anriss** und „Weiterlesen".

**Alle 23 Screenshots neu aufgenommen** — ohne fremde Gesichter (Entscheidung
unten). Dabei die zwei schwachen Bilder mitkorrigiert: „Ältere laden" steht
jetzt im Bild, und „Mein Profil" trägt kein Männerfoto unter einem Frauennamen.

**Der Artefakt-Wächter wurde erweitert, ohne die Zusage zu verwässern:** `img`
und `aside` kommen in die Erlaubnisliste, und `src` geht durch **dieselbe**
Ursprungsregel wie `href`. Drei rote Tests belegen das.

## Entscheidungen (mit Grund)

- **Die Ausgabedaten sind GESETZT, nicht gemessen** (Donald: „erstmal erfundene
  Daten"). Sechs Wochen ab 1. August, drei bis fünf Funktionen je Ausgabe. Die
  Funktionen sind echt und gegen die Anwendung geprüft — nur die Bündelung in
  Wochen ist redaktionell erfunden. **Das gehört vor dem Live-Gang entschieden**
  (Aufgabe 8.7).
- **Nur die Einleitung einer Ausgabe darf „neu" sagen** — sie ist eine Meldung
  über einen Zeitraum. Der Text der Geschichte bleibt zeitlos, weil er auch im
  Tutorial steht. Als benannte Ausnahme im Spec-Delta, sonst widerspräche der
  Umbau der bestehenden Anforderung.
- **`thema` und `RELEASE_THEMEN` sind raus.** Keine Fläche liest sie mehr; ein
  drittes Ordnungsmerkmal wäre eine zweite Antwort auf dieselbe Frage.
- **Das Kopfbild ist ein `<img>`, kein `background-image`.** Der Wächter liest
  Elemente und Attribute — eine Adresse im Stil entzöge sich ihm, und die
  Erlaubnisliste wäre ab da Dekoration.
- **Keine Avatare von `i.pravatar.cc`** (Donald, auf Vorlage): Fotos echter
  Menschen unter erfundenen Namen, in einem öffentlichen Repo. `avatar_url =
  null`, die App zeigt Monogramme. **Nicht** weichzeichnen — das läse sich wie
  ein zensierter echter Datensatz.
- **Kartencover aus den eigenen Motiven** statt `picsum.photos` — dieselbe Frage
  in klein. `public/images/hero-*.webp`, Unsplash-Lizenz, Nachweis in
  `CREDITS.md`; als 3:1-Zuschnitt, weil die Karte `object-contain` nutzt (AGE-595).
- **Bilder liegen unter `blog/bilder/`, nicht unter `public/`** — sonst gingen
  sie mit jedem App-Deploy mit. Kopiert werden **nur die freigegebenen**, sonst
  läge das Bild eines Entwurfs unter einer erratbaren Adresse.

## Fallen, die Zeit gekostet haben

(Die Screenshot-Fallen — `sips --cropOffset 0 0`, aufgebrauchte Ungelesen-Stände
— stehen in `werkzeug/LOKALER-STAND-09-09.md` und im Memo.)

- **Ein Backtick in einem CSS-Kommentar beendet das Template-Literal.** Der Stil
  steht in einem Template-Literal; `` `opacity` `` als Auszeichnung im Kommentar
  ergab einen Parse-Fehler weit unterhalb der Ursache. Zweimal passiert.
- **`grid-row: 1 / -1` ohne explizite Zeilen fällt auf eine Zeile zusammen.**
  Die Leiste mit `height: 100vh` zog dadurch die erste Zeile auf Bildschirmhöhe,
  und der Kopfbereich daneben wurde 830 px hoch. `grid-template-rows` setzen.
- **`bildUrl()` hält einen Wert ohne Schema für einen Storage-Pfad**
  (`src/lib/bild-url.ts:54`) — die Karten zeigten kaputte Bilder. Absolute
  Adresse nehmen.
- **Der Klassifikator blockt breite `update`-Befehle** — ohne `where`
  abgelehnt, mit `where avatar_url like 'https://i.pravatar.cc%'` ging es.

## Files modified

- **Neu:** `blog/bilder/` — 23 PNG, 5,1 MB, jede einzeln angesehen.
- **Neu:** `src/content/release-ausgaben.ts` — 6 Wochenausgaben mit Einleitung.
- **Neu:** `src/content/release-tutorial.ts` — 7 Etappen, 23 Kapitel in Wegordnung.
- **Neu:** `src/content/release-flaechen.test.ts` — 10 Zusagen, zwei davon
  durch Mutation belegt.
- `src/types/release.ts` — `bild` Pflicht, `ReleaseAusgabe` und
  `TutorialEtappe` dazu, `thema`/`RELEASE_THEMEN` entfernt.
- `src/content/release-geschichten.ts` — 23 Bildfelder, Masse an den Dateien
  gemessen, `thema` entfernt; weiterhin alle `freigegeben: false`.
- `src/content/release-geschichten.test.ts` — vier Zusagen an die Bilder.
- `scripts/build-blog.ts` — **neu gebaut**: zwei Übersichten, Ausgabe- und
  Kapitelseiten, Leiste, Kopfbereich, Anriss, Kopierschritt für Bilder UND
  Motive, Pfadprüfungen, Stil (Grid mit expliziten Zeilen).
- `scripts/build-blog.test.ts` — 26 Zusagen, für die zwei Flächen neu geschrieben.
- `scripts/blog-artefakt-waechter.ts` + `.test.ts` — `img`/`h3`/`article`/`aside`
  in der Erlaubnisliste, `ul`/`li` heraus, `ADRESSEN`-Regel für `href` UND `src`;
  der Test prüft zusätzlich, dass jede Bildadresse eine Datei trifft.
- `src/lib/release-entwurf.test.ts` — Beispielgeschichte um `bild` ergänzt.
- `openspec/changes/oeffentlicher-release-blog/` — fünf neue Requirements,
  `design.md` §1/§2 nachgezogen plus **§2b**, **Blöcke 7 und 8** in `tasks.md`.
- Unberührt: `supabase/`, `release-entries.generated.ts`, `AdminNeuigkeitenPage.tsx`.

## Abnahme

`pnpm test` **2695 Tests grün** (237 Dateien) · `typecheck` Exit 0 · `lint`
Exit 0 (0 Fehler) · `pnpm build` Exit 0 · `openspec validate --all` 32/32 ·
`pnpm blog:build` schreibt **2 Seiten** (beide Übersichten mit ehrlichem
Platzhalter), weil nichts freigegeben ist · Sichtprobe von Blog-Übersicht,
Tutorial und einer Kapitelseite in **hell und dunkel**, auf 1440 und auf 390 px.

## Next session: start here — der Weg live

**Stand: nichts ist committet.** Der Branch hat **null Commits** und liegt
9 Commits hinter `main`. Der Deploy-Workflow ist seit 09.09. 18:07 wieder grün
(die Störung an Googles apt-Index ist weg).

Sechs Schritte, in dieser Reihenfolge:

1. **Rebase auf `main`** (9 Commits Rückstand), dann committen. Ein Merge mit
   `freigegeben: false` veröffentlicht **nichts** — genau dafür gibt es das
   Feld. Aber: das Repository ist öffentlich, mit dem Merge sind die 23 Texte
   und die 23 Bilder auf GitHub lesbar. Der PII-Durchgang (4.4) ist dafür
   gelaufen, die Bilder sind einzeln angesehen.
2. **[Donald] 4.5** redaktionelle Abnahme (`werkzeug/dump.ts` + `fahne.ts`
   erzeugen die Lesefläche neu) und **8.7** die gesetzten Ausgabedaten
   bestätigen. Danach `freigegeben: true` — **erst dann** schreibt
   `pnpm blog:build` mehr als die zwei leeren Übersichten.
3. **[Donald] 5.1** Cloudflare-Pages-Projekt anlegen. Der Name ist die einzige
   Angabe, die 5.2 braucht (Vorschlag: `fbc-blog`). Der vorhandene
   `CLOUDFLARE_API_TOKEN` in Infisical muss dieses Projekt abdecken.
4. **5.2** Deploy: ein **eigener Job** in `deploy.yml`, nicht ein Schritt im
   bestehenden — die Anforderung verlangt, dass ein Fehlschlag des einen das
   andere unverändert lässt, und ein Schritt im selben Job liefe nach einem
   gescheiterten App-Deploy gar nicht erst. Muster steht in `deploy.yml:677`;
   der Blog braucht keinen `pnpm build`, nur `pnpm blog:build` und
   `wrangler pages deploy ./dist-blog --project-name=…`.
   **Bewusst noch nicht geschrieben:** solange das Projekt aus 5.1 nicht
   existiert, wäre der Job auf jedem PR und auf `main` rot.
5. **[Donald] 5.3** Bei Strato `www.effbeezee.com` als CNAME auf
   `<projekt>.pages.dev`, danach die Domain im Pages-Projekt eintragen. `www`
   geht denselben Weg wie `app.effbeezee.com` seit dem 01.09.; der nackte Apex
   kann kein CNAME (AGE-256).
6. **5.4** Live-Adresse aufrufen. Ein grüner Workflow belegt die Auslieferung
   **nicht**. Dabei gegenprüfen, dass keine nicht freigegebene Geschichte
   erreichbar ist.

Vorher ansehen ohne die Quelle anzufassen: aus dem Worktree heraus
`pnpm exec tsx ~/worktrees/fbc-blog-bilder/werkzeug/vorschau.ts <ordner>` —
baut alle 31 Seiten mit `freigegeben: true`.

## Open questions

- **Bleiben die gesetzten Ausgabedaten (8.7)?** Ab 1. August, wöchentlich, sechs
  Ausgaben — die Bündelung ist erfunden, die Funktionen sind echt.
- **Wie fällt die redaktionelle Abnahme aus (4.5)?** Unbeantwortet.
- **Sollen die Texte kürzer werden?** Weiter kürzen heißt Inhalt streichen.
- **Release-Notes in der Aktivität — bleibt das draußen?** Unverändert offen.
- **`pnpm format:check` ist rot** — repoweiter Vorzustand, meine Dateien sind
  nicht darunter, läuft in KEINEM CI-Workflow.
- **`effbeezee.com` ohne `www`** — Weiterleitung bei Strato, oder gar nicht?
