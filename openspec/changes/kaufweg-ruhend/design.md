# Entwurf — Kaufweg ruhend

## Entscheidung 1: Unerreichbar per Redirect, nicht bloß entlinkt

**Gewählt:** `navItem` entfällt, `App.tsx` leitet `/mitgliedschaft` auf `/` um.

Das Repository kennt drei Muster für „diese Fläche soll weg", und alle drei
stehen als Kommentar in `nav.ts`:

| Muster | Beispiel | Ergebnis |
| --- | --- | --- |
| Menüeintrag weg, Route bleibt `sub` | AGE-494: `/kompass`, `/kontakte`, `/mitgliedschaft` | per URL und per Link erreichbar |
| `navItem` weg **plus** Redirect | AGE-450: `/meine-chancen` | unerreichbar, Seite bleibt im Code |
| Seite gelöscht plus Redirect | AGE-533: `/meine-kurse` | weg |

Das erste Muster ist bereits im Einsatz und **hat nicht gewirkt**: `nav.ts`
schreibt für `/mitgliedschaft` „nichts wird gelöscht, es wird nur unerreichbar",
während sieben Stellen dorthin verlinkten. Dieselbe Zusage ein zweites Mal zu
geben wäre kein Plan, sondern eine Wiederholung. Das dritte Muster nimmt, was
AGE-908 vielleicht zurückholt.

**Verworfen: die Route erreichbar lassen und nur die Preiskarten sperren**
(`canUpgrade` immer `false`). Es fasst mehr Code an — `MitgliedschaftPage` und
`PricingCard` statt keines von beiden —, macht `startUpgrade` zu totem Code, und
eine sichtbare Preistabelle für digitale Inhalte ohne In-App-Kauf ist unter
3.1.1 selbst nicht unbedenklich. Der Rückweg wäre mehrzeilig statt zweizeilig.

**Dies ist kein ADR.** Ein Decision Record verlangt „schwer umkehrbar". Der
ganze Zweck dieser Entscheidung ist, dass sie zwei Zeilen kostet.

## Entscheidung 2: Der Requirement-Kopf bleibt, obwohl er spannt

Der Delta ändert `### Requirement: The membership page drives self-service
upgrades`. Nach dieser Änderung ist der Kopf für den heutigen Zustand
irreführend — die Seite treibt gar nichts, sie ist unerreichbar.

**Der Kopf bleibt trotzdem unverändert.** Zwei Gründe:

1. **`openspec archive` ordnet über den Kopf zu.** Ein geänderter Kopf wirkt wie
   `REMOVED` und lässt einen späteren Change die Anforderung nicht mehr finden.
   Dieselbe Mechanik bricht schon `add-academy-content`.
2. **Ein `REMOVED` plus `ADDED` wäre inhaltlich derselbe Text.** Jede Klausel des
   alten Rumpfs ist weiter wahr — sechs Stufen, Schalter, aktuelle Stufe
   markiert, Upgrade nur auf höhere zahlende Stufen, `create-checkout-session`
   plus Weiterleitung. Die Seite ist unverändert; nur niemand kommt hin. Alles
   müsste in den `ADDED`-Block wandern, und man hätte den Kopf gegen dasselbe
   getauscht.

Der Rumpf sagt die Spannung deshalb selbst aus: er beschreibt zuerst, was die
Seite leistet, **wenn** sie gerendert wird, und danach, dass nichts sie rendert.
Die beiden Szenario-Titel bleiben zeichengleich; zwei Szenarien kommen hinzu.

## Entscheidung 3: Jeder der sieben Einstiege einzeln

Kein Sammel-Schalter, kein `KAUFWEG_AKTIV`-Flag. Ein Flag für einen Zustand mit
einem Wert ist Konfiguration für einen Verbraucher, der nicht existiert — und es
verteilte die Frage „warum ist das aus?" auf acht Stellen statt auf eine im
Change.

| Stelle | Behandlung | Was bleibt stehen |
| --- | --- | --- |
| `MembershipSummary.tsx:30` | Aufrufer übergibt `showManageCta` nicht mehr | Eigenschaft, Test, Karte mit Stufe |
| `AppShell.tsx:246` | Menüeintrag entfällt | `TierBadge` im selben Menü nutzt `tier` weiter |
| `MemberDashboard.tsx:180` | nur `to` entfällt | Kachel zeigt die Stufe; `cta` bleibt, wie bei der Event-Kachel ohne Event |
| `EinstellungenPage.tsx:279` | Knopf entfällt | Karte „Mitgliedschaft" mit Abzeichen und Stufenname |
| `MembershipGate.tsx:52` | Knopf wird ein Satz | „Zur Startseite" bleibt |
| `HeaderSearch.tsx:224` | Verzweigung entfällt, immer ins Verzeichnis | der Hinweis „ab Discover verfügbar" |
| `EventDetailPage.tsx:649` | Link entfällt | der Satz mit der nötigen Stufe |

**`MemberDashboard`: nur `to` weg, `cta` bleibt.** `DashTile` hat `to?: string`
optional und `cta: string` verpflichtend, und `{to && …}` bewacht den Link
(`MemberDashboard.tsx:456`). Die Event-Kachel macht es zwei Zeilen höher genau
so, wenn kein Event ansteht. Dem Muster folgen ist billiger, als die Typen zu
ändern.

**`HeaderSearch`: eine Verzweigung verschwindet.** Heute lautet Zeile 224
`navigate(reichtStufe ? directoryUrlForQuery(begriff) : "/mitgliedschaft")`.
Künftig immer `directoryUrlForQuery(begriff)`. Für ein `basic`-Konto zeigt
`/mitglieder` dann die Wand von `MembershipGate` (`minTier: "connect"`), und die
Wand sagt nach Entscheidung 5, wie man die Stufe bekommt — der Satz direkt über
dem Knopf hat es ohnehin schon angekündigt. Der Knopf in derselben Liste heißt
dann „Im Verzeichnis weitersuchen" wie im Zweig darüber, nicht mehr
„Mitgliedschaft ansehen".

## Entscheidung 4: `showManageCta` fällt ganz weg — korrigiert beim Bauen

**Geplant war das Gegenteil,** und es war falsch. Der Entwurf sagte: die
Eigenschaft existiert schon, hat einen Test, und sie stehen zu lassen kostet eine
Zeile am Aufrufer statt drei Dateien — ein benanntes Scharnier für AGE-908.

**Der Wächter hat den Widerspruch gezeigt.** `MembershipSummary.tsx` hätte den
Link auf die Route weiter im Baum getragen, eine Eigenschaft von der Rückkehr
entfernt, und `redirect-targets.test.ts` meldet genau das als toten Link. Die
Abhilfe wäre eine Ausnahme für diese Datei gewesen — und eine Ausnahmeliste
versteckt den nächsten Verstoß. Von zwei Hälften des Tauschs ist der Wächter die
wertvollere: ein Link, der eine Boolesche Variable von der Rückkehr entfernt ist,
ist genau das, was in einem Review niemand sieht.

Also: Eigenschaft, Knopf und die beiden Zusagen dazu entfallen. Der Rückweg ist,
die vier Zeilen wieder zu schreiben; sie stehen in der Historie dieses Commits.
„Keine Flexibilität für Aufrufer, die es nicht gibt" hat von Anfang an dasselbe
gesagt.

## Entscheidung 5: Die Wand bekennt, wer die Stufe vergibt

`MembershipGate` sagt heute „Deine Mitgliedsstufe reicht für diesen Bereich noch
nicht" und bietet „Upgrade". Ohne Kaufweg bliebe nur der Mangel ohne Ausweg.

**Gewählt** (Donald, 25.09.): der Knopf wird ein Halbsatz — höhere Stufen
schaltet der Club frei. Das ist die Wahrheit nach V5 und AGE-707, wo der Admin
die Stufe in der Mitgliederliste setzt.

**Verworfen:** nur den Knopf entfernen. Kleinster Diff, aber eine Wand, die den
Mangel benennt und schweigt, wohin man sich wenden soll, erzeugt genau die
Support-Anfrage, die der Satz beantwortet.

## Entscheidung 6: Kein neuer Wächter — der bestehende wird geschärft

**Geplant war ein eigener Wächter** (`scripts/kaufweg-ruhend.test.ts`), der in
`src/` nach `to="/mitgliedschaft"` und `navigate("/mitgliedschaft")` sucht. Er
wurde geschrieben, lief rot, und ist dann **gelöscht** worden.

Der Grund: `src/config/redirect-targets.test.ts` leistet das seit AGE-494 schon —
und besser. Er **leitet** die Liste der reinen Redirect-Routen aus `App.tsx` ab,
statt sie zu pflegen, und sein Kopf erklärt, warum: „gemessen am 05.08. blieb der
Test bei einer achten Redirect-Route samt totem Link auf sie grün, weil die Route
in der Liste fehlte." Ein zweiter Wächter mit hart geschriebener Route wäre die
schlechtere Hälfte gewesen — und eine zweite Wahrheit über dieselbe Zusage.
`/mitgliedschaft` ist durch den Redirect automatisch in seiner Liste
aufgetaucht, ohne dass jemand sie anfassen musste.

**Zwei Dinge sind an ihm geschärft worden,** weil dieser Change auf ihm ruht:

1. **Der Bedingungsausdruck.** Sein Muster verlangte
   `navigate\(["']route["']` — die Route unmittelbar hinter der Klammer. Genau
   deshalb hätte er `HeaderSearch.tsx:224` nicht gesehen:
   `navigate(reichtStufe ? … : "/mitgliedschaft")`. Aufgefallen ist das, weil der
   verworfene zweite Wächter dieselbe Lücke hatte und **sechs von sieben**
   Einstiegen fand. Jetzt: `navigate\([^\n]*["']route["']`, dazu `href=`.
2. **Positivkontrollen.** Er hatte keine. Fünf Zeilen, die das Muster finden
   MUSS (darunter der Bedingungsausdruck), und vier, die es verschonen muss — die
   Registrierung selbst, die Route als Schlüssel einer Zuordnung
   (`formatHero.ts`, `NavIcon.tsx` führen sie zu Recht), und das blosse Wort in
   Prosa. Ohne sie wären alle Verneinungen auch grün, wenn das Muster nichts mehr
   findet.

Dass er den Quelltext statt den gerenderten Baum liest, und einen Glob statt
`git status`, war schon vorher richtig: ein Wächter, der `git` befragt, wird rot
von fremden Dateien — daran ist `sync-dev-auszug.test.ts` flaky geworden.

## Was nicht geprüft werden kann und deshalb offen bleibt

**Ob Apple zufrieden ist, zeigt erst die Beta-Prüfung.** 3.1.1 ist eine
Bewertung, kein Testfall. Dieser Change nimmt die Fläche weg, die die
Standardursache ist; er kann keine Freigabe versprechen.

**Die Rechtsseiten nennen weiter das Einzelunternehmen** (AGE-610). Für die Beta
tragbar, laut AGE-907 ausdrücklich, und außerhalb dieses Changes.
