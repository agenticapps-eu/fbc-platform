## Context

Das Repository fährt drei Auslieferungsflächen: Frontend (Cloudflare Pages),
Migrationen (Supabase) und Edge Functions. Zwei Supabase-Projekte tragen dabei
feste Rollen — `foelowldexkcqzewvrcf` heißt DEV, `viwntbodrtqxgmqyxluh` heißt
PROD. Bis zum Mitglieder-Import zeigt die Infisical-Umgebung `prod` jedoch
**absichtlich** auf das DEV-Projekt (`deployment-environments`, „Bis zum Import
trägt allein DEV die Rolle beider Umgebungen"). Das ausgelieferte Frontend liest
also aus DEV.

Gemessen am 2026-08-13:

| | DEV (`foelowld…`) | PROD (`viwntbod…`) |
|---|---|---|
| `auth.users` / `profiles` | 41 / 41 | 2 / 2 |
| `events` / `posts` | 9 / 21 | 0 / 0 |
| `matches` / `compass_responses` | 164 / 48 | 0 / 0 |
| Referenzdaten (Badges, Stufen, Tags) | vorhanden | vorhanden |

Die gelebte Plattform steht vollständig in DEV; PROD trägt Referenzdaten und
zwei Konten.

`deploy.yml` startet auf `main` drei Jobs: `migrate-dev` wendet Migrationen
automatisch auf DEV an, `drift-gate` vergleicht die Historie fest verdrahtet
gegen `SUPABASE_DB_URL_PROD`, und `deploy` hängt an beiden. Beide Vorbedingungen
laufen derzeit **parallel**.

**Der Vorfall.** Der Merge von C9 (AGE-533) enthielt zwei Migrationen. Der
Backfill legte in DEV neun Beiträge mit `kind='event'` und `body = ''` an — der
Inhalt wird bewusst zur Laufzeit gejoint. Das Frontend vor C9 kennt diesen
Kartentyp nicht und rendert `body`: neun leere Karten, live, sofort.
`drift-gate` fand daraufhin Abweichung gegen PROD und übersprang den Deploy —
also genau die Auslieferung, die den Kartentyp mitgebracht hätte. Das Fenster
schloss sich erst rund drei Stunden später von Hand.

Das Gate hat den Schaden nicht verhindert, sondern verlängert. Es misst eine
Datenbank, die kein Nutzer anfasst.

## Goals / Non-Goals

**Goals:**

- Das Gate misst die Datenbank, die das ausgelieferte Frontend tatsächlich
  anspricht — heute DEV, nach dem Umzug PROD, ohne Textänderung.
- Das Fenster zwischen „Schema geändert" und „passendes Frontend live" schließt
  sich **ohne menschliches Zutun**.
- Der Widerspruch in `deployment-environments` wird aufgelöst, nicht überklebt.
- Der Rückstand des jeweils anderen Projekts bleibt sichtbar.

**Non-Goals:**

- Der Umzug auf das PROD-Projekt (Import, Umstellung der drei Frontend-Werte).
  Eigenes Vorhaben; diese Änderung nimmt ihn nicht vorweg und verbaut ihn nicht.
- Das Fenster auf null bringen. Migration und Frontend sind nicht atomar
  auslieferbar.
- Die zurückgestellte Reviewer-Regel für `migrate-prod`.
- Irgendeine Änderung an `migrate-prod.yml`, an Migrationen oder am Frontend.

## Decisions

### 1. Das Ziel kommt aus derselben Quelle wie der Build

`drift-gate` liest `VITE_SUPABASE_URL` aus der Infisical-Umgebung, mit der
`deploy` baut (`prod` auf `main`), leitet den Projekt-Ref ab und ordnet ihn den
beiden versionierten Dateien `scripts/{dev,prod}-project-ref.txt` zu. Daraus
folgt, welche der beiden bereits vorhandenen Verbindungen — `SUPABASE_DB_URL_DEV`
oder `SUPABASE_DB_URL_PROD` — an das Gate geht.

*Warum nicht eine neue versionierte Datei* (`live-project-ref.txt`): sie wäre im
Review sichtbar und käme ohne Infisical im Job aus, wäre aber eine **zweite
Wahrheit** neben dem Wert, mit dem tatsächlich gebaut wird. Läuft sie ihm davon,
misst das Gate wieder das falsche Projekt — derselbe Fehler, nur mit mehr
Zeremonie. Der Wert, der den Build bestimmt, ist der einzige, dem das Gate
folgen darf.

*Warum trotzdem gegen die Ref-Dateien abgeglichen wird:* der Ref allein sagt
nicht, welches Secret zu nehmen ist, und ein unbekannter Ref muss auffallen
statt stillschweigend auf PROD zurückzufallen.

Kosten: die Infisical-CLI wird in einem dritten Job installiert. Dieselbe
Fremd-Shell wie in `functions` und `deploy`, mit demselben offenen Punkt aus
AGE-495 (kein Checksum-Pin zu haben) — kein neuer, aber ein weiterer Aufruf.

### 2. `drift-gate` bekommt `needs: [migrate-dev]`

Sobald das Gate DEV misst, misst es dasselbe Projekt, das `migrate-dev` im selben
Lauf gerade beschreibt. Parallel gestartet gewönne es ein Rennen, das es nicht
gewinnen soll: es fände die eben gemergten Migrationen als fehlend und würde rot
— nicht wegen einer echten Abweichung, sondern wegen der Reihenfolge der eigenen
Pipeline.

Kosten am Gesamtlauf: keine. `deploy` und `functions` warten ohnehin auf beide;
nur die Frühwarnung kommt rund zwei Minuten später.

*Alternative verworfen:* das Gate selbst warten lassen (Polling auf den anderen
Job). Mehr Mechanik für etwas, das `needs` deklarativ ausdrückt.

### 3. Das andere Projekt wird gemessen und berichtet, nicht erzwungen

Zeigt der Build auf DEV, entfällt die bisherige Frühwarnung über PRODs
Rückstand. Genau dieser Rückstand ist zweimal unbemerkt gewachsen und fiel erst
auf, als ein Deploy scheiterte. Der Job misst deshalb beide Projekte, macht aber
nur das gemessene Ziel blockierend; der Rückstand des anderen geht als Notiz ins
Protokoll.

*Warum nicht als eigener Job:* er bräuchte dieselbe Auflösung, dieselben Secrets
und dieselbe Installation — zwei Jobs für eine Frage, deren Antwort in derselben
Zeile fällt.

### 4. `migration-drift-gate.ts` bleibt unverändert

Es nimmt die Ziel-URL bereits als `argv[2]`. Was neu ist, ist die **Wahl** des
Ziels, und die gehört in ein eigenes reines Modul mit eigenem Test — nach der
Hausform `*.logic.ts` neben `*.test.ts`, wie `migration-drift.logic.ts`,
`deploy-base.logic.ts` und `db-push-prod.logic.ts`. Keine zweite Regex im YAML;
diese Entscheidung ist im Repo bereits einmal getroffen worden
(`scripts/assert-target.ts`) und wird hier nicht neu verhandelt.

### 5. Jeder Lauf nennt das gemessene Projekt

Auch der unauffällige. Dieselbe Begründung wie beim namentlichen Protokoll der
übergangenen Functions: eine Angabe, die nur im Ausnahmefall erscheint, ist im
Normalfall unbelegt — und beim nächsten Vorfall will man nicht rekonstruieren
müssen, welche Datenbank das Gate damals eigentlich angesehen hat.

## Risks / Trade-offs

**Das Gate hat bis zum Umzug keine Zähne.** → Ausdrücklich in die Anforderung
geschrieben, statt es einen Reviewer entdecken zu lassen. Wird die Live-Datenbank
automatisch migriert, bleibt nichts zu torwarten; das Gate wird zur Nachkontrolle
von `migrate-dev`. Die Zusage, die in dieser Phase trägt, ist der Abbruch des
Deploys bei fehlgeschlagenem DEV-Lauf — die steht bereits.

**Das Fenster wird nicht null.** → Es bleiben die zwei bis vier Minuten zwischen
`migrate-dev` und dem fertigen Deploy. Beseitigt wird die *unbegrenzte* Variante,
die auf einen Menschen wartet. Wer es kleiner braucht, muss Migrationen
rückwärtskompatibel schneiden — eine andere Entscheidung, nicht diese.

**Das Zusammenspiel der Jobs ist auf einem PR nicht beobachtbar.** →
`drift-gate` läuft nur auf `main`, und ein `workflow_dispatch` in `deploy.yml`
löste auch einen Deploy aus (der Grund, warum `migrate-prod` ein eigener
Workflow ist). Dreistufiger Nachweis: Unit-Tests auf das reine Modul, ein
lokaler Lauf des Auflösers gegen die echten Infisical-Werte beider Umgebungen,
und der erste `main`-Lauf mit seiner Protokollzeile. Die Unit-Tests sind
ausdrücklich **nicht** der Beleg für das Zusammenspiel.

**Ein falsch gesetztes `VITE_SUPABASE_URL` lenkt jetzt auch das Gate.** → Vorher
war das Gate gegen diese Verwechslung immun, weil es fest auf PROD zeigte. Jetzt
folgt es dem Build. Das ist gewollt — es soll das Ziel des Builds prüfen —, aber
es heißt: ein Ref, der zu keiner der beiden versionierten Dateien passt, muss rot
werden und darf nicht auf einen Standardwert zurückfallen. Genau so ist die
Anforderung formuliert.

**Ein dritter Aufruf der Infisical-Installationsshell.** → Kein neues Risiko,
aber eine weitere Instanz des offenen Punkts aus AGE-495 (kein Checksum-Pin
verfügbar). Wird dort gelöst, nicht hier.

## Migration Plan

Kein Datenbank- und kein Frontend-Anteil; die Änderung wirkt beim nächsten
`main`-Lauf. Rücknahme ist ein `git revert` des Commits — es gibt keinen
Zustand, der zurückzudrehen wäre.

Reihenfolge beim Nachweis: erst der lokale Lauf des Auflösers gegen beide
Infisical-Umgebungen (beweist die Zuordnung an echten Werten), dann der Merge,
dann die Protokollzeile des ersten `main`-Laufs.

## Open Questions

Keine offenen Entscheidungen in diesem Change. Zwei benachbarte Punkte bleiben
bewusst außerhalb:

- Der **Umzug** auf das PROD-Projekt — eigenes Vorhaben, terminlich vor dem
  Go-Live am 17.08. vorgesehen.
- Die zurückgestellte **Reviewer-Regel** für `migrate-prod`, die erst greift,
  sobald ein zweiter Mensch Schreibrechte auf `main` hat.
