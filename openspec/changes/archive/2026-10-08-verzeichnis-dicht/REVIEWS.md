---
reviewers: [gemini, codex]
models: [gemini-3-pro, gpt-6-sol]
verdicts: [APPROVE, REQUEST-CHANGES]
---

# Change review — verzeichnis-dicht

Zwei Anbieter, beide fremd. Donalds Regel vom 26.08. verlangt Fremdreviewer bei
Schema, Rechten und Sicherheit — dieser Change ist alle drei zugleich.

## Reviewer: gemini (gemini-3-pro)

VERDICT: **APPROVE**

- [HIGH] Fremdschlüssel — der Entzug könnte `REFERENCES` mitnehmen und
  `insert` in referenzierende Tabellen brechen.
- [MEDIUM] Realtime — eine Abonnierung auf `profiles` oder `profiles_public`
  bräche mit dem Entzug.
- [LOW] Atomarität — dass Entzug und Ersatz in **einer** Migration stehen,
  sollte ausdrücklich dastehen statt impliziert zu sein.

## Reviewer: codex (gpt-6-sol)

VERDICT: **REQUEST-CHANGES**

- [HIGH] `update … where id = $1` braucht `select` auf die Spalten der
  WHERE-Klausel. Der Entzug bricht also den **Schreibvorgang selbst**, nicht
  nur die Rückgabe. Ein `select(id)` als Ausweg stellte die Aufzählbarkeit
  wieder her.
- [HIGH] `feed_top_authors` als DEFINER umgeht auch die RLS auf `posts` und
  zählte dann verborgene und terminierte Beiträge mit.
- [HIGH] Die Bestandsaufnahme übersieht `supabase/functions/create-checkout-session/index.ts`,
  das `profiles` mit dem Token des Aufrufers liest.
- [HIGH] Die vorgeschlagenen DEFINER-Prädikate lassen die Lebenszyklus-Prüfungen
  fallen (aktiviert, nicht gesperrt, nicht gelöscht) — für Aufrufer **und** Ziel.
- [MEDIUM] Das Spec-Delta verspricht in Szenarien weiterhin „subject to RLS";
  innerhalb der DEFINER-Funktion ist das falsch.
- [MEDIUM] `supabase/tests/grants_test.sql` nagelt genau die beiden Grants fest,
  die entzogen werden. Die Suite kann so gar nicht grün werden.
- [MEDIUM] Die Zusage „keine Mitgliederliste" ist zu weit: `profil_karten` kann
  die Herkunft von Kennungen nicht erzwingen.

## Resolution — nachgemessen, nicht übernommen

Jeder HIGH-Befund wurde gegen das laufende System geprüft, bevor er in den
Entwurf einfloss. Zwei Befunde haben sich bestätigt und den Entwurf geändert,
einer ist ein Missverständnis, einer ist nicht anwendbar.

### codex HIGH 1 — BESTÄTIGT, und er kippt Entscheidung 4

Gegen den lokalen Stack gemessen, mit eigener Rolle und eigenem Schema in einer
Transaktion mit `rollback`:

| Lage                                                               | Ergebnis                                    |
| ------------------------------------------------------------------ | ------------------------------------------- |
| nur `grant update (wert)`, kein `select`: `update … where id = $1` | **verweigert**                              |
| dasselbe `update` **ohne** WHERE                                   | gelingt — die WHERE-Klausel ist die Ursache |
| zusätzlich `grant select (id)`: das `update`                       | gelingt                                     |
| … und dann `select count(*)`                                       | **liefert alle Zeilen**                     |

Beide Hälften des Befunds stimmen: der Entzug bricht den Schreibvorgang, und der
naheliegende Ausweg stellt die Aufzählbarkeit wieder her — unter der heutigen
Rang-4-Policy bekäme ein Clubmitglied damit wieder jede Kennung, und Kennungen
sind genau das, was `profil_karten` einlöst.

**Folge:** Entscheidung 4 ist zurückgezogen. Die vier Schreibwege wandern in
RPCs. Es gibt keinen Mittelweg.

### codex HIGH 2 — BESTÄTIGT, und die vorgeschlagene Abhilfe wird nicht übernommen

`feed_top_authors` zählt `public.posts` unter den Rechten des Aufrufers. Als
DEFINER zählte sie auch, was der Aufrufer nicht sehen darf — terminierte
Beiträge (`veroeffentlicht_ab`) und was die Beitrags-Policies sonst verbergen.

Codex schlägt vor, das Sichtbarkeits-Prädikat in der Funktion nachzubauen. Das
wäre eine **Kopie** einer Policy, und Kopien laufen auseinander. Stattdessen:
die Funktion bleibt `SECURITY INVOKER` und zählt weiter unter den Rechten des
Aufrufers; nur die **Namensauflösung** geht über die neue DEFINER-Funktion. Der
Entzug trifft dann nur die Stelle, die ihn wirklich betrifft.

### codex HIGH 3 — BESTÄTIGT, und mein Wurzelverzeichnis war zu eng

`supabase/functions/create-checkout-session/index.ts:58` liest `profiles` mit
dem Token des Aufrufers — **mit derselben Einbettung** `membership_tiers(level_rank)`
wie `AuthProvider`. Nach dem Entzug antwortete es `profile_lookup_failed` (500).

Meine Zählung sagte „19 Stellen" und war über `src/` gelaufen. Die Lehre steht
in der Anweisungsdatei dieses Rechners und ist hier noch einmal eingetreten:
**die Ebenen zu nennen genügt nicht, man muss die Wurzeln nennen.** Es sind
**20** Stellen — 12 auf `profiles` und 7 auf der Sicht in `src/`, plus eine in
`supabase/functions/`. Dass die Zahl zufällig wieder bei 20 landet, macht meine
erste Zählung nicht richtig: sie hat eine andere Stelle übersehen als der
Vorgang.

Stripe ist ruhend, die Funktion also derzeit ohne Verkehr. Das ist ein Grund,
sie ruhig nachzuziehen, und keiner, sie auszulassen.

### codex HIGH 4 — BESTÄTIGT

`profiles_select_self_or_discover` lautet vollständig
`is_activated() and activated_at is not null and disabled_at is null and
deleted_at is null and (id = auth.uid() or has_level(4))`. Mein `mein_profil()`
war mit `id = auth.uid()` angegeben und hätte einem gesperrten oder gelöschten
Konto seine Zeile zurückgegeben — eine **Ausweitung** gegenüber heute, in einem
Change, der schliessen soll.

Jede neue Funktion führt die Lebenszyklus-Prüfungen vollständig, für Aufrufer
und Ziel, und jede bekommt dafür eine eigene Zusage.

### codex MEDIUM — alle drei übernommen

Das Spec-Delta nennt in den betroffenen Szenarien jetzt die Tore der Funktion
statt der RLS. `supabase/tests/grants_test.sql` nagelt in Zeile 90/91 genau die
zwei Grants fest, die fallen — nachgezählt, stimmt — und steht als eigene
Aufgabe. Die Zusage ist auf „nicht als **Menge** abholbar" verengt; sie stand in
`design.md` schon so und war in der Spec weiter gefasst.

### gemini HIGH — NICHT übernommen, mit Begründung

`REFERENCES` wird gebraucht, um einen Fremdschlüssel **anzulegen**, nicht um in
eine referenzierende Tabelle zu schreiben. Die Prüfung eines bestehenden
Fremdschlüssels läuft als Systemprüfung und hängt nicht an den Rechten des
Schreibenden — dieselbe Eigenschaft, die in diesem Repo schon als „ein
Fremdschlüssel ist ein Existenz-Orakel" festgehalten ist (die FK-Prüfung umgeht
sogar die RLS). Der Befund steht trotzdem als **Probe** in den Aufgaben: die
Behauptung ist billig zu messen, und eine Annahme, die man messen kann, soll man
messen.

### gemini MEDIUM — NICHT anwendbar, gemessen

Kein `postgres_changes`-Abonnement auf `profiles` oder `profiles_public` im
Quellbaum. Der Befund ist richtig gedacht und trifft hier nichts.

### gemini LOW — übernommen

Die Aufgaben sagen jetzt ausdrücklich, dass Entzug und Ersatz in **derselben**
Migration stehen, und warum: ein Zwischenzustand wäre ein Ausfall des
Verzeichnisses.

## Was die Plan-Review hier wert war

Vier der sieben Befunde haben den Entwurf verändert, einer davon so, dass eine
ganze Entscheidung zurückgenommen wurde — **bevor** eine Zeile Code existierte.
Hätte dieser Change ohne sie begonnen, wäre der erste Befund erst beim
Integrationsbeleg aufgefallen, mit der Migration und zwanzig umgebauten
Aufrufstellen im Rücken.
