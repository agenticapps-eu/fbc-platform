---
reviewers: [gemini, opencode]
models: [gemini-cli (Modell nicht protokolliert), Kimi-K3]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
not_counted: [codex]
reviewed_artifacts_sha: 063a29876a3916db (git diff main...HEAD -- supabase/ src/)
---

# Diff-Review — academy-lite-and-feed-weave (AGE-533 / C9)

Schritt 4 des Workflows: auf dem **Diff**, nicht auf dem Plan. Zwei Anbieter
haben gelesen, beide verlangen Änderungen. Der Diff-Review hat einen echten
Fehler gefunden, den ich beim Beheben des vorigen selbst eingebaut hatte — und
eine falsche Zusage in einem Migrationskopf.

## Nicht gezählt

- **codex** — nach ~26 Minuten abgebrochen, **0 Bytes** Ausgabe. Kein Urteil,
  keine Befunde. Ersetzt durch `opencode`; damit stehen zwei Anbieter, keiner
  davon der dieses Hosts.

## Reviewer: gemini

VERDICT: REQUEST-CHANGES

- **[HIGH] `src/lib/academy.ts:90`** — `fetchGelikteVideos` filtert nicht
  ausdrücklich auf `profile_id`, verlässt sich also allein auf die RLS.

## Reviewer: opencode (Kimi-K3)

VERDICT: REQUEST-CHANGES

- **[HIGH] `20260813090000:104`** — `~*` macht das **ganze** Muster
  case-insensitiv, auch den Pfad. `youtube.com/WATCH?v=x` landet in
  `video_url`, `parseVideoUrl` liefert dafür `null`.
- **[HIGH] `MemberDashboard.tsx:151`** — der Event-Zweig sei toter Code, weil
  `dashboard.ts` auf `kind='member'` filtert.
- **[MEDIUM] `20260813100000`** — die Zusage „ein Event-Beitrag trägt niemals
  `post_media`" ist durch das Engerfassen von `posts_write_own` nicht
  hergestellt: `post_media_insert_own` hängt allein an der Autorschaft.
- **[MEDIUM]** anon und `events`: der Fall ist ungetestet.
- **[MEDIUM] `CommunityFeed.event.test.tsx:110`** — der Test „zeigt KEINEN
  leeren Beitragstext" prüft auf den Lightbox-Knopf und beweist nichts.
- **[LOW]** der Bildlink der Event-Karte hat keinen zugänglichen Namen.
- **[LOW]** `kind` ist als `string` getypt, obwohl es eine geschlossene Menge ist.

## Resolution

### opencode HIGH 1 — `~*` greift zu weit. Angenommen, und es war mein Fehler.

**Der schwerste Befund, und er entstand beim Beheben des vorigen.** Der
Plan-Review hatte `~` (case-sensitiv) als Abweichung zu `parseVideoUrl` erkannt,
das den Host kleinschreibt. Meine Antwort war `~*` — und die macht in Postgres
das **ganze** Muster unempfindlich, also auch den Pfad. `parseVideoUrl`
vergleicht aber `url.pathname === "/watch"` und `searchParams.get("v")`
case-**sensitiv**.

Gemessen, nicht geglaubt — der verworfene Entwurf gegen die neue Fassung:

```
https://youtube.com/WATCH?v=dQw4w9WgXcQ      ALT=<akzeptiert>  NEU=NULL
https://www.youtube.com/watch?V=dQw4w9WgXcQ  ALT=<akzeptiert>  NEU=NULL
https://www.youtube.com/EMBED/dQw4w9WgXcQ    ALT=<akzeptiert>  NEU=NULL
https://player.vimeo.com/VIDEO/123456789     ALT=<akzeptiert>  NEU=NULL
```

Alle vier lehnt TypeScript ab. Der alte Spiegel hätte sie in `video_url`
geschrieben: der Beitrag stünde in der Academy, die Karte bettete nichts ein.

**Die Lösung ist nicht ein anderes Flag, sondern eine Zerlegung.** Postgres
kennt keine gruppenlokalen Optionen — `(?i:…)` wirft `invalid regular
expression`, gemessen. `erste_video_url` zerlegt den Token jetzt in Host und
Rest, schreibt **nur den Host** klein und entfernt ein führendes `www.` — genau
das, was `new URL()` plus `hostname.replace(/^www\\./)` tut. Pfad und Query
bleiben unberührt.

Der Paritätskorpus wächst um sieben Fälle (39 → 46) und deckt beide Richtungen:
Großschreibung im Host wird akzeptiert, Großschreibung im Pfad nicht.

### opencode MEDIUM 1 — die Zusage stand da, bevor sie wahr war. Angenommen.

`post_media_insert_own` (20260812090000:69) prüft `p.author_id = auth.uid()` und
sonst nichts — und der Host **ist** der Autor seines Event-Beitrags. Er hätte
also Bilder anhängen können, und `post_media_lesbar` hätte sie signiert. Der
Kopf der Migration behauptete das Gegenteil.

**Die Behauptung wird wahr gemacht, nicht gestrichen:** die Policy bekommt
`and p.kind = 'member'`. Dazu zwei pgTAP-Fälle — der Host wird abgewiesen, und
als Gegenprobe geht es an seinem eigenen Mitglieds-Beitrag weiterhin. Ohne die
Gegenprobe wäre die erste Behauptung auch dann grün, wenn die Policy alles
ablehnte.

### opencode MEDIUM 2 — anon und `events`. Angenommen als Testlücke.

Die *Prämisse* stimmt nicht: `events_select_public_anon` besteht seit
20260612082726, ein ausgeloggter Besucher liest öffentliche Events sehr wohl.
Die *Lücke* ist real — §22.18 deckte nur den `members`-Fall. Zwei neue Fälle
prüfen jetzt beides: der Beitrag eines `public`-Events ist ausgeloggt sichtbar,
und das Event dazu auch (sonst hätte die Karte nichts zu joinen).

### opencode MEDIUM 3 — der Test, der nichts bewies. Angenommen.

Er prüfte das Fehlen des Lightbox-Knopfes — den es an einem Beitrag ohne Bilder
ohnehin nie gibt. Grün und wertlos, also genau die Falle, gegen die dieses
Repo eine eigene Erfahrung hat.

Der Test füllt den Body jetzt **absichtlich**, obwohl der Trigger ihn leer
anlegt: bei leerem Body wäre „kein Text sichtbar" auch dann wahr, wenn die
Karte den Body brav renderte. Negativkontrolle: rendert man `post.body` in der
Event-Karte, fällt genau dieser Test.

### opencode LOW 1 + LOW 2 — beide angenommen.

Der Bildlink bekommt `aria-label={\`Titelbild: ${event.title}\`}` — sein einziger
Inhalt ist ein Bild mit leerem `alt`, ein Screenreader läse sonst die rohe URL.
Und `FeedPost.kind` ist jetzt `PostKind = "member" | "event"`, verengt an der
Grenze in `fetchFeed`; eine dritte Ausprägung fällt beim Übersetzen auf, statt
still als Mitgliedsbeitrag zu erscheinen.

### gemini HIGH — angenommen, mit korrigierter Begründung.

`.eq("profile_id", uid)` ist ergänzt. Die **Begründung des Befunds stimmte
nicht**: der Reviewer schrieb, `fetchFeed` trage den Filter bereits — das tut es
nicht (`feed.ts:391` verlässt sich ausdrücklich auf die owner-only-Policy), und
sein Codevorschlag setzte `.eq()` vor `.select()`, was nicht übersetzt.

Übernommen wurde der Vorschlag, nicht seine Begründung. Die Redundanz steht dort,
wo sie einen eigenen Grund hat: im Like-Regal bilden die Zeilen den **Inhalt**,
in `fetchFeed` nur ein Boolean. Fiele die Grenze, zeigte der Feed ein falsches
Herz — dieses Regal fremde Markierungen.

### opencode HIGH 2 — nicht angenommen, Prämisse widerlegt.

Der Event-Zweig in `MemberDashboard` ist **nicht** tot. Die Liste dort kommt aus
`fetchFeed` (`MemberDashboard.tsx:51` und `:70`), nicht aus `fetchDashboard` —
der Reviewer hat die beiden Datenquellen derselben Datei verwechselt.
`fetchDashboard` speist die Widgets, und **dort** ist der `kind='member'`-Filter
richtig. Auch der Zusatz „`formatEventDate` ohne Import" trifft nicht: die Datei
importiert es seit AGE-498 in Zeile 13.

Keine Änderung — außer dieser Notiz, damit der nächste Leser nicht dieselbe
Verwechslung macht.

## Was der Diff-Review über sich selbst sagt

Zwei der vier schwersten Befunde beruhten auf falschen Prämissen (gemini HIGH,
opencode HIGH 2), und beide führten trotzdem zu etwas: der eine zu einer
sinnvollen Änderung mit anderer Begründung, der andere zu dieser Notiz. Die
zwei, die trugen — `~*` und `post_media` —, hätte kein Test gefunden: der eine
war grün, weil der Korpus den Fall nicht kannte, der andere, weil niemand ihn
versucht hat.
