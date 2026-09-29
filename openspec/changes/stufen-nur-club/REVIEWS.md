---
reviewers: [gemini, opencode]
models: [gemini, "hf:moonshotai/Kimi-K3"]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: sha256:a59d5e80803613a92371191f…
---

# Plan-Review — stufen-nur-club (AGE-969)

Gegenstand: `proposal.md`, `design.md`, `tasks.md` und das Spec-Delta, 489
Zeilen, Stand vor der ersten Codezeile. Beide Reviewer sind fremde Anbieter;
der eigene Host hat nicht mitgestimmt.

Codex wurde nicht gefragt — er delegiert bei Artefaktsätzen dieser Grösse
zurück (Befund aus AGE-927).

## Das Urteil in einem Satz

Beide **REQUEST-CHANGES**, und opencode hat einen **inneren Widerspruch**
gefunden, der den Change an seiner wichtigsten Zusage unbaubar gemacht hätte.

## Was geändert wurde

### [HIGH, opencode] Der Wächter widersprach zwei eigenen Anforderungen

Die erste Fassung versprach einen Test über dem **gebauten Bündel**: die Wörter
Active, Boost und Connect kommen darin nicht vor. Das ist **ab dem ersten Bau
falsch**, und zwar aus drei Gründen, die alle in diesem Change selbst stehen:

1. `levels.ts` behält alle sechs Einträge samt Labels — ausdrücklich — und wird
   von Mitgliederkomponenten importiert.
2. Die Admin-Einzelbearbeitung **muss** den Namen einer gesetzten niedrigeren
   Stufe zeigen können; `levelLabel("active")` bleibt nötig.
3. `release-entries.generated.ts` behält sieben Vorkommen absichtlich und ist
   Teil desselben Builds.

Ein Wächter über dem Artefakt kann diese drei nicht von einer echten Fundstelle
trennen. Er wäre rot oder führte eine Ausnahmeliste — also wieder die Inventur,
die er ersetzen sollte.

**Aufgelöst:** der Wächter misst jetzt die **gerenderten Mitgliederansichten**,
zweimal — mit einem Konto unterhalb des Clubs und einem darin. Was er nicht
sieht, steht im Testkopf. Das ist weniger, als die erste Fassung versprach, und
es ist einlösbar.

*Das war mein Fehler, nicht ein Missverständnis des Reviewers:* ich hatte im
selben Entwurf geschrieben, dass die Labels bleiben, und zwei Abschnitte später
versprochen, dass sie verschwinden.

### [HIGH, beide] Der einzige sichtbare Inhalt war unspezifiziert

Die Spec sagte nur per SHALL NOT, was **nicht** dastehen darf. Der Satz, der
stattdessen dasteht, blieb abstrakt — und er trifft die einzige Gruppe, die
**wächst**: Selbstregistrierungen landen unterhalb des Clubs, der Kaufweg ruht,
von dort führt kein Weg nach oben.

gemini: „ein informationsloser, toter UI-Zustand". opencode schärfer: „‚Clubzugang
ab Discover' ohne Weg dorthin ist eine Sackgasse und verschweigt das eine, was
das Mitglied wissen muss."

**Aufgelöst:** der Wortlaut steht jetzt in der Spec, mit Kontaktweg:

> **Dein Konto ist bestätigt.** Der Clubzugang beginnt bei Discover. Eine Stufe
> lässt sich hier zurzeit nicht selbst buchen — schreib uns über
> **Support › Feedback**, dann melden wir uns.

### [MEDIUM, opencode] Meine Begründung zu `CLUB_RANK` war falsch

Ich hatte geschrieben, ein gesenktes `CLUB_RANK` „schaltete das Verzeichnis für
BOOST frei". **Stimmt nicht** — `has_level(4)` steht in den SQL-Policies und
bliebe hart. Was tatsächlich passierte, ist subtiler: Oberfläche und RLS liefen
auseinander, das Verzeichnis sähe erreichbar aus, die Datenbank verweigerte, und
das Mitglied bekäme einen Fehler statt einer Absage.

Da die Begründung wörtlich ins Spec-Delta wandert, ist sie berichtigt worden.

**Das Urteil zur Sache bleibt:** beide Reviewer bestätigen die Trennung,
opencode ausdrücklich als „echte Entkopplung, keine Phantom-Abstraktion" — der
zweite Aufrufer ist keine Hypothese, sondern eine getroffene Entscheidung („die
drei kommen später wieder").

### [MEDIUM, opencode] Die Inventur deckte nicht ab, was sie versprach

„Jede Fläche, die ein Mitglied erreichen kann" ist mehr als `src/`.
**Nachgemessen statt eingegrenzt**:

| Fläche | Befund |
|---|---|
| Mailtexte | **kein** Stufenname |
| Edge Functions | nur Tests, Kommentare, ruhender Kaufweg (nicht gerendert) |
| Native Hülle | `webDir: "dist"` — dasselbe Bündel, keine eigene Fläche |
| Blog-Slug | `2026-09-02-rechte-matrix-stufen` — trägt den Namen **nicht** |

Damit trägt die Anforderung „Anwendung, native Hülle und Blog", und die Sorge um
eine indexierte Adresse trifft hier nicht zu.

### [MEDIUM, opencode] Der Stolperdraht ohne Selbsterklärung

Ein Test, der beim ausdrücklich geplanten „BOOST kommt zurück" fallen **soll**,
wird in sechs Monaten fallen, niemand weiss warum, und er wird stillschweigend
gelöscht. **Aufgelöst:** er bekommt eine Fehlermeldung, die den nächsten
Bearbeiter anleitet.

### [LOW, beide] Die AGB-Notiz

Der Dateikopf behauptet, der Text sei von einer Kanzlei „vollständig
übernommen". **Aufgelöst:** er bekommt einen Vermerk — und zwar über *beides*,
denn die Änderung ist eine Kürzung **und** die Berichtigung zweier Namen, die es
seit AGE-903 nicht mehr gibt. Dass eine Kürzung ohne Rückfrage bei der Kanzlei
vertretbar ist, steht jetzt als **Annahme eines Nichtjuristen** im Entwurf.

### [LOW, opencode] Die Reihenfolge von Bau und Checkout

`pnpm build` beschreibt eine getrackte Datei; ein Test davor misst etwas anderes
als einer danach. **Aufgelöst:** die Reihenfolge steht jetzt in der Aufgabe.

## Bewusst NICHT geändert

**gemini wollte den Zugangssatz um „Ihr Zugang ist noch nicht aktiviert"
ergänzen.** Das wäre falsch: das Konto **ist** bestätigt — es steht nur
unterhalb des Clubs. Die beiden Zustände auseinanderzuhalten ist der Kern der
Aufnahmestrecke aus AGE-927; sie hier zu vermischen brächte genau die
Verwechslung zurück, die dort ausgeräumt wurde.

**gemini wollte den Wächter auf Kontexte prüfen lassen** (`>…<`, `className=`)
statt auf blosse Wortvorkommen. Der Vorschlag ist durch die Umstellung auf
gerenderte Ansichten gegenstandslos: dort gibt es keine Wortsuche mehr.

## Die Annahmen, die die Reviewer benannt haben

Zwei davon gehören in den Entwurf und stehen jetzt dort:

* **Diese Änderung ist Oberflächenkosmetik.** Das Repo ist öffentlich;
  `levels.ts`, die AGB-Historie und dieser Change nennen alle sechs Stufen
  weiterhin. „Nirgends" gilt für das, was ein Mitglied in der Anwendung sieht.
* **Die Prämisse „niemand steht unterhalb des Clubs" zerfällt am Tag nach dem
  Merge.** Sie hing an einer einmaligen Bereinigung. Genau deshalb ist der
  Zugangssatz ausgeschrieben — er ist der Dauerzustand, nicht die Ausnahme.

Nicht übernommen: „es existiere ein Ops-Prozess, der Neuzugänge hochzieht". Den
gibt es nicht, und dieser Change behauptet ihn auch nicht.

## Zum Verfahren

Der Trailer, den der Erzeuger sonst setzt, fehlt: dieses Review ist mit
`reviewer-cli.sh` je Anbieter gefahren und von Hand protokolliert, nicht über
`run-plan-review.sh`. Der Digest oben bindet die tatsächlich vorgelegten Bytes.
Eine zweite Runde ist **nicht** gelaufen; die Änderungen folgen der Richtung,
die beide Reviewer benannt haben, und der einzige strukturelle Umbau — der
Wächter — macht die Zusage schwächer und einlösbar statt stärker.
