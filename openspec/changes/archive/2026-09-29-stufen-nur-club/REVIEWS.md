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

---

## Diff-Review (Stufe 2, 29.09.) — auf dem fertigen Code

Gegenstand: `git diff origin/main...HEAD -- src`, 1863 Zeilen.

| Reviewer | Verdikt |
|---|---|
| gemini | REQUEST-CHANGES |
| **opencode** | **nicht gezählt** — „Too Many Requests: You've exceeded your subscription rate limits" |
| codex (`gpt-6-sol`) | REQUEST-CHANGES |

opencode ist ins Rate-Limit gelaufen und **zählt nicht**. Ersetzt durch codex —
der bei AGE-927 noch zurückdelegiert hatte, bei diesem kleineren Artefaktsatz
aber durchlief.

## Der Befund, der die Wächter widerlegt hat

**[HIGH, codex] `PublicProfilePage.tsx:316` rendert `profile.tier` roh.** Ein
Mitglied unterhalb des Clubs sah auf seinem eigenen öffentlichen Profil den
**Schlüssel** — also `active`, klein geschrieben. Schlimmer als ein Label.

**Beide Wächter blieben grün**, und das ist der eigentliche Wert dieses
Befundes: es war weder eine Zeichenkette noch `LEVEL_ORDER`, sondern ein
Ausdruck. Genau die Blindstelle, die der Plan-Review beim Bündel-Wächter
vorhergesagt hatte, nur an anderer Stelle.

**Aufgelöst:** die Zeile entfällt unterhalb des Clubs und trägt darin den
Anzeigenamen. **Und der Wächter hat eine dritte Regel bekommen** — „ein `tier`
gehört nicht ungefiltert in JSX". Sie hat sofort eine **zweite** Fundstelle
geliefert, die niemand gesucht hatte: `MemberLookup.tsx:84`, dieselbe Sorte.

Das ist der Beleg, dass die Regel trägt: sie hat etwas gefunden, das weder ich
noch drei Reviewer beim Lesen gesehen haben.

## Was sonst geändert wurde

**[HIGH, gemini] Die Ausnahme für `MitgliedschaftPage` war eine Zeitbombe.** Die
Seite ist seit AGE-907 umgeleitet, also unerreichbar — ich hatte sie im Wächter
ausgenommen. Holt AGE-928 die Route zurück, zeigte sie wieder alle sechs
Stufen. **Aufgelöst:** die Seite liest jetzt selbst `GENANNTE_STUFEN`, die
Ausnahme ist weg. Drei Bestandszusagen dort sind benannt gekippt; eine davon
ist dabei **stärker** geworden — sie prüfte, dass die Karten ausserhalb des
Clubs keinen Kaufweg anbieten, und jetzt gibt es die Karten gar nicht mehr.

**[MEDIUM, codex] `waehlbareStufen()` verlor einen unbekannten Schlüssel.** Das
Auswahlfeld zeigte dann „Discover", während der Wert des Formulars der
unbekannte Schlüssel blieb — „Stufe setzen" hätte etwas anderes abgeschickt, als
dasteht. **Aufgelöst:** auch ein unbekannter Wert bleibt als Option stehen.

**[MEDIUM, beide] Der Kommentarfilter des Wächters war unzuverlässig.** Er warf
ganze Zeilen weg, die mit einem Kommentarzeichen *beginnen* — `code(); //
Active` erzeugte einen Fehlalarm. **Aufgelöst:** Blockkommentare und
Zeilenreste werden herausgeschnitten statt Zeilen verworfen. Der Rest steht im
Testkopf: ein `//` innerhalb einer Zeichenkette schneidet den Zeilenrest mit
weg — das macht den Wächter dort **blind, nicht laut**.

**[MEDIUM, codex] Die Ausnahme `src/content/` war zu grob.** Dort liegen auch
Texte, die ein Mitglied liest. **Aufgelöst:** ausgenommen sind jetzt genau zwei
Dateien, jede mit ihrem Grund.

**[LOW, codex] Abstände, die ohne Plakette stehen blieben.** `ProfileHero` hielt
`mt-3` über dem Namen, und im Profilmenü der `AppShell` blieb eine leere Hülle
mit `mt-1.5`. Beide hängen jetzt an der tatsächlich gerenderten Plakette.

## Bewusst NICHT geändert

**[HIGH, gemini] „Die AGB-Änderung muss von einer Kanzlei geprüft werden."** Der
Einwand ist berechtigt und steht deshalb hier — aber die Entscheidung ist
Donalds, und er hat sie am 29.09. ausdrücklich getroffen, im Wissen, dass es die
AGB sind. Meine Aufgabe ist, sie sichtbar zu machen, nicht sie zu überstimmen.
**Sie steht im PR-Text an erster Stelle**, samt dem Angebot, genau diese eine
Datei zurückzunehmen, falls eine Kanzlei zuerst schauen soll. Der Dateikopf
benennt die Änderung, ihren Umfang und dass die Einschätzung von einem
Nichtjuristen stammt.

**[MEDIUM, codex] „Zugestellte Neuigkeiten könnten den Namen zurückbringen."**
Stimmt — aber nur, wenn ein Admin einen Archiveintrag *unredigiert* in eine
Mitteilung übernimmt. Das ist ein Mensch, der Text schreibt, und dagegen hilft
kein Test. Der Entwurf benennt es als Grenze; die Markierung
`release_entry_skips` (AGE-636) besteht für genau diesen Fall.

## Die Annahmen, die die Reviewer benannt haben

codex: *„Er setzt voraus, dass sichtbare Stufennamen nur aus den sechs
umgestellten Aufrufstellen stammen; die öffentliche Profilseite widerlegt
das."* — Richtig, und die Lehre steckt jetzt in der dritten Wächterregel statt
in einer Zusicherung.

gemini: *„Die neue Darstellung ist für Mitglieder verständlich und kein
Rückschritt."* — Nicht gemessen, sondern in der Sichtprobe angesehen: die Karte
sagt, wo der Club beginnt, dass sich nichts selbst buchen lässt, und wohin man
schreibt. Ob das genügt, weiss erst das erste Mitglied, das sie liest.
