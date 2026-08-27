# Entwurf — woher der Text kommt und wie er genau einmal zugestellt wird

Drei Entscheidungen tragen diesen Change. Alle drei hätten auch anders
ausfallen können, und bei zweien wäre das teuer geworden.

## 1. Woher der Admin erfährt, was neu ist

Das Archiv liegt im **Repository**, die Nachricht entsteht in der **Datenbank**.
Der Admin-Client kann `openspec/changes/archive/` nicht lesen — er läuft im
Browser. Der Weg dazwischen ist die eigentliche Frage.

**Entscheidung: ein zur Bauzeit erzeugtes Modul.** Ein Skript liest das Archiv
und schreibt `src/content/release-entries.generated.ts`; das Modul geht mit ins
Bündel. Der Admin-Client importiert es wie jede andere Konstante.

*Verworfen — ein CI-Schritt, der bei jedem Push auf `main` Zeilen in eine
Tabelle `release_entries` schreibt.* Er wäre automatischer, kostete aber einen
`service_role`-Schlüssel in einem weiteren Workflow und damit einen zweiten
schreibenden Weg in die PROD-Datenbank. Dieses Projekt hat mit genau solchen
Wegen schon Lehrgeld bezahlt; einen neuen aufzumachen, um eine Liste zu füllen,
die ohnehin nur ein Mensch liest, ist der falsche Tausch.

*Verworfen — eine Migration je Release.* Sie bände Inhalt an das Schema. Ein
Tippfehler im Ankündigungstext wäre dann eine Schema-Änderung.

**Was das Erzeugte kostet und was es einbringt.** Es kann veralten — aber nur
in eine Richtung: das Modul beschreibt genau den Stand, der ausgeliefert wurde,
weil es Teil derselben Auslieferung ist. Ein Eintrag, der im Bündel steht, ist
per Konstruktion deployed. Genau das war der Wunsch („wenn sie archiviert
wurden, also deployed").

### Was der Erzeuger NICHT darf: das Archiv für sauber halten

Gemessen am 27.08.: **21 von 50** Proposals haben keine `# Titel`-Zeile, sie
beginnen mit `## Why`. **19** tragen keine `Linear:`-Zeile. Verlässlich ist
allein der Verzeichnisname `JJJJ-MM-TT-<slug>`.

Der Erzeuger fällt deshalb auf den Slug zurück, statt zu scheitern oder eine
leere Zeile zu erzeugen. Ein Eintrag ohne Titel heisst dann
`video-freigabe-merken` — hässlich, aber wahr, und der Admin schreibt es
ohnehin um. **Ein Erzeuger, der bei 21 von 50 Einträgen abbricht, wäre eine
Fläche, die man nie benutzt.**

## 2. Wie „genau einmal zugestellt" erzwungen wird

Ein Fan-out auf alle aktivierten Mitglieder ist die einzige Schreiblast dieser
Anwendung, die mit der Mitgliederzahl multipliziert. Ein zweiter Klick
verdoppelt sie, und niemand sieht es, weil `notifications` keinen eindeutigen
Schlüssel über `(profile_id, type, payload)` trägt.

**Entscheidung: der Zustandswechsel IST die Sperre.**

```sql
update public.release_notes
   set status = 'sent', sent_at = now(), ...
 where id = p_id and status = 'draft'
returning ...
```

Trifft das `update` keine Zeile, ist die Note bereits zugestellt und die
Funktion bricht mit `already_sent` ab, **bevor** eine einzige
`notifications`-Zeile entsteht. Zwei gleichzeitige Aufrufe können nicht beide
gewinnen: das `update` nimmt die Zeilensperre, der zweite Aufruf sieht danach
`status = 'sent'` und trifft nichts.

*Verworfen — ein `unique`-Index auf `(profile_id, release_note_id)` in
`notifications`.* Er verlangte eine neue Spalte auf einer Tabelle, die sieben
andere Typen teilen, nur um einen Fall abzudecken, den der Zustandswechsel
schon ausschliesst. Und er verhinderte den doppelten Versand nicht, sondern
machte ihn nur still.

*Verworfen — die Prüfung im Knopf.* Ein Knopf, der zweimal geklickt wird, ist
der Normalfall, nicht die Ausnahme.

## 3. Wer es bekommt, und warum es keinen Schalter dafür gibt

**Empfänger: alle Mitglieder mit `activated_at is not null`.** Ein nicht
bestätigtes Konto sieht die Anwendung nicht; ihm zu melden, dass sie sich
geändert hat, ginge ins Leere.

**Kein Opt-out.** Die vier Schalter aus AGE-620 regeln etwas anderes: sie
schützen vor dem Lärm, den *andere Mitglieder* machen — und der wächst mit der
Zahl der Mitglieder. Eine Release-Note ist keine Aktivität eines Mitglieds,
sondern eine Mitteilung über das Werkzeug selbst; sie kommt selten und betrifft
jeden, der es benutzt. Ein Schalter dafür hiesse: „du kannst dir abbestellen,
zu erfahren, wie diese Anwendung funktioniert."

Der Ausgleich ist nicht der Schalter, sondern die **Auffindbarkeit**: der
Hinweis ist wegklickbar wie jeder andere, und `/neues` hält ihn danach. Ohne
diese Seite wäre er weg — die Glocke liest nur ungelesene und deckelt bei 50
(`hinweise.ts:31`).

## 4. Warum das nicht der Massenversand ist, den AGE-304 verboten hat

`specs/admin/spec.md` hält fest: kein Massenversand, kein CRM, keine
Themen-Newsletter, und **die Mitgliederliste ist keine Empfängerauswahl**.

Diese Fläche berührt die zweite Zusage **gar nicht**: sie hat keine
Empfängerauswahl, keine Mehrfachauswahl von Mitgliedern, keine Übernahme einer
Treffermenge. Der Kreis ist nicht wählbar — er ist „alle aktivierten" und sonst
nichts.

Und sie berührt die erste nur in ihrem Wortlaut, nicht in ihrer Sache: verboten
war *Massen-MAIL*, CRM und Themen-Newsletter — Werkzeuge, mit denen man
Zielgruppen bildet und bespielt. Eine einzelne, redigierte In-App-Mitteilung
ohne Zielgruppe ist keines davon. Der Change nimmt die Zusage deshalb **nicht
zurück**, sondern schreibt die Ausnahme in sie hinein und benennt, warum sie
eine ist.
