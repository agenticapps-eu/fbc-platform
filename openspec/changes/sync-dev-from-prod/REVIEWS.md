---
reviewers: [gemini, codex]
models: [gemini-3-pro, gpt-5.2-codex]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: 088c3bdc810e3f0a80f71d7ff9c051b75c254dd3810774d9bce88f204526edd7
---

# Change review — sync-dev-from-prod

Beide Prüfer fordern Änderungen. Der Entwurf hat **echte Löcher**, nicht nur
Formulierungsschwächen — vier davon sind unten an den laufenden Datenbanken
nachgemessen, nicht übernommen.

## Nachgemessen, bevor übernommen

Vier überprüfbare Tatsachenbehauptungen aus dem Codex-Review, am 2026-08-20
gegen PROD gelesen:

| Behauptung | Befund |
|---|---|
| `public` trägt zwölf weitere Trigger | **Bestätigt, und schlimmer:** 13 nicht-interne Trigger, darunter `contact_requests_email_webhook` — den nennt der Review nicht |
| Signup-Trigger setzt `basic`, nicht `discover` | **Bestätigt.** Die Live-Definition sagt `basic`; der Entwurf zitierte `20260611171003` statt der aktuellen Wahrheit |
| Nur `auth.users` ist kein gültiger Auth-Restore | **Bestätigt.** `auth.identities` trägt 72 Zeilen, `auth.sessions` 3 |
| `git status --porcelain --ignored` ist schon vorher nicht leer | **Bestätigt.** 17 Pfade heute |

## Reviewer: gemini (gemini-3-pro)

VERDICT: REQUEST-CHANGES

- **[HIGH] Datenschutz** — Der Vorschlag kopiert echte Personendaten in eine
  Umgebung mit öffentlich dokumentierten Zugangsdaten und verschiebt die
  Anonymisierung auf später. Anonymisierung müsse Teil des ersten Baus sein;
  das Werkzeug dürfe rohe Produktionsdaten zu keinem Zeitpunkt kopieren.
- **[MEDIUM] Vollständigkeit des geschützten Bestands** — Was den Ersatz
  überlebt, ist unentschieden (die 21 Feedback-Zeilen), steht aber schon als
  Anforderung. Vor dem Bau festlegen.
- **[LOW] Trigger-Annahme** — Die Richtung des Fremdschlüssels
  `profiles → auth.users` wird als Tatsache dargestellt, nicht geprüft.
- **[LOW] `pg_dump` über den Pooler** — Der Entwurf ist durchgehend so
  geschrieben, als gelänge es. Gruppe 1 muss blockierend sein.

## Reviewer: codex (gpt-5.2-codex)

VERDICT: REQUEST-CHANGES — 8 HIGH, 9 MEDIUM, 2 LOW. Die tragenden:

- **[HIGH] Rohsicherung und DEV-Spiegel sind verschiedene Dinge** — eines darf
  roh und verschlüsselt sein, das andere nicht. „Anonymisierung später" ist als
  Non-Goal nicht tragbar, solange DEV öffentlich erreichbar ist.
- **[HIGH] Der Wächter prüft nur das Ziel** — eine vertauschte oder fremde
  **Quelle** besteht alle vorgesehenen Tests.
- **[HIGH] Der Wächter deckt nur die Datenbank** — Storage-URL und
  GoTrue-Service-Key sind eigene projektgebundene Werte. Eine DEV-DB-URL neben
  einem PROD-Service-Key leert PROD-Buckets bei grüner DB-Prüfung. Die
  Credential-Spaltung ist im Repo bereits dokumentiert.
- **[HIGH] `auth.users` allein ist kein Auth-Restore** — GoTrue pflegt
  Identitäten ausserhalb dieser Tabelle; zugleich wanderten
  Produktions-Passwort-Hashes nach DEV.
- **[HIGH] Zwölf weitere Trigger** — `trg_event_feed_post` erzeugt beim Restore
  zusätzliche Beiträge, `contact_requests_lifecycle` zusätzliche
  Benachrichtigungen und Threads.
- **[HIGH] Die Abnahme ist logisch unmöglich** — „dieselben Zeilenzahlen wie
  PROD" und „drei zusätzliche DEV-Konten herstellen" widersprechen einander.
- **[HIGH] Der Auszug ist als Rückweg bezeichnet, ohne Rückweg** — der
  Neuaufbauplan verlangt Rückimport über den Importweg, nicht rohes
  Wiedereinspielen. Kein Restore-Beweis, keine Auth-Identitäten.
- **[HIGH] Weg A/B des Neuaufbaus ist in den Dokumenten offen** — bei Weg B
  leerte `sync:dev` die Live-Datenbank.
- **[MEDIUM]** Kein gemeinsamer Zeitpunkt zwischen DB-Auszug und Ablage · „70
  Migrationen" beweist keine Schemagleichheit · Signup-Trigger setzt `basic` ·
  drei Logins stellen die Demo-Welt nicht her (leere `basic`-Profile) ·
  `admin_roles.sql` kann „dieselben Einträge" nicht garantieren · gleiche
  Zeilenzahlen beweisen weder Inhalt noch Idempotenz · `0600` deckt die 125
  Objektdateien nicht · ein halber Lauf lässt die ausgelieferte Fläche
  teilrestauriert · fehlende Pagination/Rekursion beim Auflisten der Buckets.
- **[LOW]** `--ignored` ist schon vorher nicht leer · die Feedback-Frage ist
  offen, während die Spec den geschützten Bestand bereits festlegt.

## Nicht gezählt

Keiner. Beide Prüfer liefen durch (`gemini` exit 0, `codex` exit 0, letzterer
mit `REVIEWER_TIMEOUT=900`; die Standardgrenze von 300 s hätte ihn abgeschnitten).
Der eigene Hersteller (`claude`) wurde nicht befragt.

## Resolution

**Der Entwurf wird überarbeitet, nicht durchgewunken.** Sieben Punkte ändere
ich, zwei lege ich Donald vor, drei weise ich begründet zurück.

### Wird geändert

1. **Trigger (HIGH).** Decision 2 behandelt einen Trigger und übersieht zwölf.
   Der Restore muss nachweislich triggerfrei sein oder der Ansatz fällt. Neue
   Aufgabe in Gruppe 1: alle mutierenden Trigger inventarisieren und je
   entscheiden. `contact_requests_email_webhook` ist dabei der Ernstfall —
   ein Restore, der Post verschickt, ist kein Restore.
2. **Auth-Umfang (HIGH).** `auth.identities` (72 Zeilen) gehört dazu, sonst
   entstehen 72 Konten, bei denen sich niemand anmelden kann. Der benötigte
   Umfang wird gemessen und aufgeschrieben, statt „`auth.users`" zu sagen.
3. **Der Wächter prüft Quelle UND Ziel (HIGH)** und nicht nur die Datenbank:
   Storage-URL und Service-Key sind eigene Werte mit eigener Zuordnung.
4. **Die Abnahme wird ein Manifestvergleich mit benannten DEV-Deltas (HIGH)**
   statt „Zeilenzahl gleich PROD". Zahlen beweisen ohnehin keinen Inhalt —
   verglichen werden Zeilenhashes und Objekt-Prüfsummen, beide Wiederholungen
   aus **demselben** gespeicherten Auszug.
5. **Der Rückweg wird ausbuchstabiert (HIGH)** — Recovery-Ziel, enthaltene
   Daten, Weg ins Importformat, und ein Restore-Probelauf auf leerem Schema als
   Anforderung. Ohne das ist „Sicherung" eine Behauptung.
6. **Der Demo-Bestand (MEDIUM).** Drei Logins sind nicht die Demo-Welt: ihre
   Profilzeilen entstehen leer und `basic`. Entweder der benannte Bestand wird
   vollständig hergestellt, oder es steht ausdrücklich dort, dass DEV danach
   nicht mehr vorführbar ist.
7. **Zwei Tatsachenfehler.** `discover` → `basic`; und die
   `--ignored`-Zusage wird auf eine Vorher/Nachher-Differenz umgestellt, weil
   die Ausgabe schon heute 17 Pfade führt.

### Von Donald entschieden, 2026-08-20

8. **Anonymisierung (beide, HIGH).** Beide Prüfer verlangen sie im ersten Bau.
   Ich halte das Risiko für real und die Abhilfe für falsch: anonymisierte
   Namen und Texte nähmen dem Spiegel genau den Zweck — Fehler zu finden, die
   nur an echten Daten auftreten. Die acht Befunde vom 17.08. wurden so
   gefunden. Das Risiko ist nicht „echte Daten auf DEV", sondern die
   **Kombination** aus echten Daten, den im öffentlichen Repo dokumentierten
   Zugängen (`Test1234!`) und der bis zur Umschaltung auf DEV zeigenden
   Fläche. Vorschlag: Zugänge entschärfen statt Daten verfälschen.
   **Entschieden: keine Anonymisierung.** Die Daten bleiben echt; stattdessen
   werden die Demo-Passwörter geändert und aus dem öffentlichen Repository
   genommen (neue Aufgabengruppe 2a, Voraussetzung für den ersten Lauf). Beide
   Prüfer bleiben damit unbefriedigt, und das steht hier, damit es nicht als
   Versehen gelesen wird: es ist eine abgewogene Entscheidung gegen zwei
   HIGH-Befunde, mit benannter Gegenmaßnahme. Siehe design.md Decision 6.
9. **Produktions-Passwort-Hashes (HIGH, Teilaspekt von 8).** Auch wenn Namen
   bleiben: die Hashes müssen nicht mit. Sie zu neutralisieren kostet den
   Spiegel nichts, weil sich auf DEV ohnehin niemand mit einem echten
   Mitgliedskonto anmelden soll.
   **Entschieden: neutralisieren** (Aufgabe 4.13), mit einer negativ
   formulierten Zusage — ein übertragenes Konto darf sich auf DEV NICHT mit
   seinem PROD-Passwort anmelden. Ein positiver Test könnte hier nichts belegen.

### Wird begründet zurückgewiesen

10. **Weg A/B (HIGH)** — nicht mehr offen. Donald hat am 2026-08-20 entschieden:
    PROD geht live, DEV behält die Kopie. Der Befund trifft die **Dokumente**,
    nicht die Sache: `docs/prod-neuaufbau-plan.md` §Schritt 0 führt die Frage
    weiter als offen. Wird dort nachgezogen, nicht im Entwurf.
11. **„Ziel während des Laufs aus dem Verkehr nehmen" (MEDIUM)** — für DEV
    überzogen. Die Fläche zeigt heute Demo-Daten; ein halber Lauf zeigt
    halbe Daten. Der Preis einer Wartungsschaltung übersteigt den Schaden.
    Wird bei der Umschaltung auf PROD neu bewertet, dort gilt es.
12. **Verschlüsselung des Auszugs (MEDIUM)** — `0700`-Verzeichnis, `0600` je
    Datei, `realpath`-Prüfung und ein Manifest werden übernommen. Eine
    Verschlüsselungsschicht dazu ist ohne Schlüsselverwaltung Theater: der
    Schlüssel läge auf derselben Platte wie der Auszug.
