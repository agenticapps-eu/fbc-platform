## Context

Dieser Change korrigiert eine Anforderung, die drei Dinge falsch sagt, und
schreibt eine PII-Lage auf, die bisher **nirgends** stand. Er ändert kein
Verhalten. Das ist seine ungewöhnlichste Eigenschaft und zugleich sein einziges
echtes Risiko: ein Change ohne Verhaltensdiff kann jede Behauptung aufstellen,
ohne dass etwas widerspricht.

**Ausgangslage, gemessen am 2026-08-13 und im Plan-Review nachgeprüft:**

| Fläche | Stand | Beleg |
|---|---|---|
| `displayAuthor.ts` | Ausgeloggt „Ein Mitglied", kein Avatarbild | `displayAuthor.test.ts` |
| `feed.ts` `fetchAuthors` | Ohne Session wird `profiles_public` nicht angefragt | `anon-anreicherung.test.ts` |
| `events.ts` `hostsFor` | Ohne Session weder `profiles_public` noch `partners` | dito |
| `HomePage.tsx` `PublicHome` | Events, Beiträge, Testimonials, Kennzahlen — **keine Mitgliederliste** | gelesen |
| `profiles_public` | `security_invoker = off`, `grant select … to authenticated` | `20260612082726:64`, `20260715140000:118` |

Die letzte Zeile ist der Anlass für die Neufassung. **Jedes aktivierte Konto,
auch ein frei registriertes `basic`, liest darüber jeden öffentlichen Namen** —
unabhängig von `profiles_select_self_or_discover`, weil die View die Policies der
Basistabelle nicht auswertet.

> **Was der Plan-Review gekippt hat.** Der erste Entwurf strich das stufenweise
> Auflösen mit der Begründung, die RLS gattere Namen schon nach Stufe. Das gilt
> für **Zeilen** über `search_directory`, nicht für **Namen** über
> `profiles_public`. Die Streichung ist zurückgenommen; die Entscheidung heißt
> jetzt **vertagen und ehrlich benennen**.

## Goals / Non-Goals

**Goals:**

- Die Anforderung sagt, was gilt — einschließlich der unbequemen Hälfte.
- Die stufenweise Auflösung bleibt offen, aber **mit Adresse** statt als
  heimatloses „pending".
- Das Geländer für anon-Flächen sagt, wie weit es reicht, statt eine Zusage zu
  geben, die es nicht hält.
- Die Behauptung „das Verhalten steht schon und ist festgenagelt" wird
  **belegt**, nicht behauptet.

**Non-Goals:**

- Kein neues Verhalten, keine Migration, keine Policy.
- **Keine Änderung an `finish-ui-polish`.** Es bleibt aktiv und behält AGE-291.
- Kein Bau der stufenweisen Auflösung, in keiner Richtung.
- Kein Schließen der Funktionsaufruf-Lücke im anon-Wächter — sie wird benannt.
- Keine Änderung an `HomePage.tsx`, auch nicht an den erfundenen Kennzahlen.

## Decisions

### 1. `MODIFIED` statt `REMOVED` — damit sich zwei Changes nicht gegenseitig sperren

`finish-ui-polish` entfernt dieselbe Anforderung, unter **exakt demselben Kopf**,
aus der Gegenrichtung. Entfernten beide, machte der zuerst archivierte den
anderen unarchivierbar — genau die Lage, die `add-academy-content` heute
blockiert.

Der Kopf „Author name masking is only partially resolved" ist unter der
Vertagungs-Entscheidung ohnehin **wahr**: teilweise gelöst ist genau der Stand.
Falsch war nie der Kopf, sondern welcher Teil gelöst sei und was in der
Zwischenzeit gilt. Also bleibt er stehen, und der Rumpf wird richtig.

Damit ist die Reihenfolge einseitig entschärft: archiviert **dieser** Change
zuerst, findet `finish-ui-polish` seine Anforderung unverändert vor. Der
umgekehrte Fall bliebe problematisch — er tritt nicht ein, weil dieser Change
klein und jener ungebaut ist. Benannt, nicht weggeredet.

Verworfene Alternative: den Kopf umbenennen. Dann fände `finish-ui-polish` beim
Archivieren nichts mehr — dieselbe Falle, nur später.

### 2. Der Beleg ist eine Mutationsprobe, kein neuer Test

Die Regel des Repos ist RED vor GREEN. Ein Change ohne Verhaltensdiff hat nichts,
was rot werden könnte — und ein **neu geschriebener** Test, der sofort grün ist,
belegt nichts. Es wäre der Vakuumtest, den dieses Repo schon zweimal gefangen
hat.

Der Beleg läuft andersherum: die **bestehenden** Tests werden einmal rot gemacht,
indem der Produktionscode vorübergehend kaputtgemacht wird, und danach wieder
grün. Das misst die einzige offene Frage — **halten die Tests die Anforderung
wirklich, oder wären sie auch ohne sie grün?**

| Probe | Eingriff | Muss rot werden in |
|---|---|---|
| A — Anzeige | `displayAuthor` gibt auch ausgeloggt den echten Namen | `displayAuthor.test.ts` |
| B — Daten | `fetchAuthors` fragt `profiles_public` auch ohne Session an | `anon-anreicherung.test.ts` |
| C — Positivliste | eine gesperrte, in keinem Test genannte Relation ausgeloggt anfragen | „Die Regel, nicht der Einzelfall" |

**Probe C hat ihre Aussage im Review verloren und behält nur die kleinere.** Sie
belegt, dass der Wächter einen unvorhergesehenen Verstoß **innerhalb des
bestehenden Aufrufgraphen** fängt. Sie belegt **nicht**, dass er eine neue Datei
oder einen Funktionsaufruf fängt — er tut es nachweislich nicht. Genau deshalb
steht die Reichweite jetzt in der Anforderung.

**Sicherheitsregeln für die Proben**, aus dem Review übernommen:

- Sie laufen **nach** Validierung und Plan-Review, nicht davor. 2b liegt vor
  jeder Code-Änderung, auch vor einer, die zurückgenommen wird.
- Sie laufen nur, wenn das Ziel **sauber** ist. `git checkout -- <datei>` auf
  eine Datei mit vorbestehenden Änderungen vernichtet diese. Die Datei nur zu
  notieren schützt sie nicht — die Probe wird verweigert.
- Der Blob-Hash der Zieldatei wird vor und nach der Rücknahme verglichen. „Sieht
  wieder aus wie vorher" ist keine Messung.

### 3. Der Change ist nicht spec-only, und das wird nicht gerettet

`displayAuthor.ts:6` sagt „Folgeschritt (nicht hier): stufenweise Auflösung je
Mitgliedsstufe" — die einzige Stelle im Produktionscode, die den Folgeschritt
benennt, und sie nennt keine Adresse. Sie bekommt eine. Dazu ein Kommentar über
`ANON_DARF_LESEN`, der Rolle **und Grenze** des Wächters festhält, weil ein
späterer Leser dort sonst nur die Liste findet und den Rest annimmt.

Beides sind Kommentare, kein Verhalten. Der frühere Stand behauptete trotzdem
„kein Produktionscode" — das war falsch und ist korrigiert statt umformuliert.

### 4. Zwei Anforderungen, nicht eine

Die erste beschreibt den **Ist-Zustand** samt Preisgabe. Die zweite ist eine
**Regel für künftige Flächen** samt ihrer Reichweite. In eine gegossen fasste
jede spätere Änderung am Ist-Zustand die Regel mit an.

## Risks / Trade-offs

**Ein Change ohne Verhaltensdiff kann sich nicht irren, weil er nichts tut — und
genau deshalb kann seine Beschreibung falsch sein, ohne dass es auffällt.**
→ Der erste Entwurf war der Beweis: seine tragende Begründung war falsch, und
`validate` war grün. Die Gegenmaßnahmen sind die Mutationsprobe und der
Plan-Review; beide haben gegriffen.

**Die aufgeschriebene Preisgabe kann als neue Lücke gelesen werden.**
→ Sie ist keine neue, sondern eine seit AGE-235 bestehende, bisher
undokumentierte. Sie hinzuschreiben verschlechtert nichts und ist die
Voraussetzung dafür, dass jemand sie entscheidet.

**Zwei aktive Changes zu AGE-291 sind ein Zustand, kein Ziel.**
→ Solange `finish-ui-polish` ungebaut ist, tragen beide dieselbe offene Frage.
Entscheidung 1 sorgt dafür, dass sie einander nicht sperren; sie ersetzt nicht,
dass `finish-ui-polish` irgendwann gebaut oder zurückgezogen wird.

**Der Spec-Slot ist `directory-search`, obwohl die Maskierung im Feed sitzt.**
→ Bewusst: dort steht die alte Anforderung, dort entfernt `finish-ui-polish`
sie, und `community-feed` trägt bereits die Feed-Seite derselben Sache
(Zeile 464-494). Ein dritter Slot machte drei Stellen aus zweien.
