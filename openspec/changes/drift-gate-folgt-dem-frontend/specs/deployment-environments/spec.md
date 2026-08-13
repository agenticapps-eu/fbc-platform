## MODIFIED Requirements

### Requirement: Migrationen erreichen DEV automatisch und PROD nur bewusst

Das System SHALL `supabase/migrations/` als einzige Quelle des Schemas beider
Projekte führen. Nach einem Merge auf `main` SHALL die Deploy-Pipeline alle
ausstehenden Migrationen automatisch auf das DEV-Projekt anwenden. Auf das
PROD-Projekt SHALL sie ausschließlich durch einen ausdrücklich ausgelösten Lauf
angewendet werden.

Vor jedem Frontend-Deploy SHALL die Pipeline die Migrationshistorie **desjenigen
Projekts, das der auszuliefernde Build anspricht**, gegen `supabase/migrations/`
vergleichen und den Deploy bei **jeder** Abweichung abbrechen. Das zu messende
Projekt SHALL aus derselben Quelle stammen wie der Build selbst — nicht aus einer
zweiten, nachzuführenden Angabe. Lässt sich das angesprochene Projekt keinem der
beiden versionierten Projekt-Refs zuordnen, SHALL die Prüfung fehlschlagen.

Diese Wahl ist keine Lockerung, sondern die Auflösung eines Widerspruchs: solange
„Bis zum Import trägt allein DEV die Rolle beider Umgebungen" gilt, ist das
PROD-Projekt nicht die Datenbank des ausgelieferten Frontends, und eine Prüfung
gegen es beantwortet die Frage nicht, die das Gate stellt.

Als Abweichung SHALL gelten: lokal vorhandene, remote fehlende Migrationen;
remote vorhandene, lokal fehlende; sowie eine abweichende Reihenfolge. Diese
Prüfung SHALL fehlschlagen, wenn sie nicht durchgeführt werden kann — ein
fehlendes Secret oder eine nicht erreichbare Datenbank SHALL NOT als „keine
Abweichung" gewertet werden.

Die Prüfung SHALL gegen denselben Commit erfolgen, den der Frontend-Deploy
ausliefert. Sie SHALL erst laufen, nachdem der automatische Lauf gegen DEV
abgeschlossen ist — andernfalls misst sie das DEV-Projekt vor dessen eigener
Migration und scheitert an der Reihenfolge der Pipeline statt an einer echten
Abweichung.

Jeder Lauf SHALL das gemessene Projekt im Protokoll nennen, auch der
unauffällige. Der Migrationsstand des jeweils **nicht** gemessenen Projekts SHALL
zusätzlich ermittelt und berichtet werden, ohne den Deploy zu blockieren; er ist
die Frühwarnung für den nächsten Lauf gegen PROD, nicht eine zweite Zusage.

Der Frontend-Deploy SHALL auch dann unterbleiben, wenn der automatische Lauf
gegen DEV fehlgeschlagen ist. Ein Fehlschlag der Frühwarnung SHALL NOT folgenlos
bleiben.

Der Lauf gegen PROD SHALL ausschließlich von Hand ausgelöst werden können und
SHALL vor dem Anwenden den aufgelösten Zielhost sowie die Liste der
anzuwendenden Migrationen ausgeben. Er SHALL abbrechen, wenn für denselben
Commit kein erfolgreicher Lauf gegen DEV vorliegt. Der schreibende Schritt
SHALL sein eigenes Ziel prüfen, nicht nur ein vorgelagerter Schritt in einem
anderen Lauf.

**Stand 2026-08-05:** eine _zusätzliche_ Freigabe durch einen zweiten Menschen
(geschützte Umgebung mit Reviewer-Regel) ist bewusst **zurückgestellt**, weil
derzeit nur eine Person am Repository schreibt. Der Auslöser von Hand bleibt
damit die einzige Kontrolle vor dem Anwenden — der ausgegebene Dry-Run steht im
Log, aber niemand muss ihn gelesen haben. Sobald ein zweiter Mensch
Schreibrechte erhält, SHALL die Reviewer-Regel gesetzt werden.

**Stand 2026-08-13:** solange das ausgelieferte Frontend das DEV-Projekt
anspricht, misst das Gate eine Datenbank, die unmittelbar zuvor im selben Lauf
automatisch migriert wurde. Es SHALL in dieser Zeit als Nachkontrolle des
automatischen Laufs verstanden werden und nicht als Zusage, dass ein Mensch die
Migration freigegeben hätte; die Zusage, die in dieser Phase trägt, ist der
Abbruch des Deploys bei fehlgeschlagenem DEV-Lauf. Mit dem Umzug auf das
PROD-Projekt greift dieselbe Regel wieder als vollwertiges Gate, ohne Änderung
am Text.

Es SHALL keinen Weg geben, die Prüfung zu übergehen. Dass eine ausstehende
Migration auch einen von ihr unabhängigen Frontend-Deploy blockiert, ist die
beabsichtigte Folge.

#### Scenario: Frontend deployt nicht, während Migrationen fehlen

- **WHEN** ein Merge auf `main` Code enthält, der eine noch nicht auf dem
  angesprochenen Projekt angewendete Migration voraussetzt
- **THEN** bricht die Pipeline vor dem Frontend-Deploy ab, statt eine
  Oberfläche live zu stellen, deren Datenbank sie nicht trägt

#### Scenario: Das Gate misst das Projekt des ausgelieferten Builds

- **WHEN** die Infisical-Umgebung, mit der `main` baut, auf das DEV-Projekt zeigt
- **THEN** vergleicht das Gate gegen das DEV-Projekt und nicht gegen das
  PROD-Projekt, und nennt das gemessene Projekt im Protokoll

#### Scenario: Ein unbekanntes Projekt macht das Gate rot

- **WHEN** das vom Build angesprochene Projekt weder dem Ref in
  `scripts/dev-project-ref.txt` noch dem in `scripts/prod-project-ref.txt`
  entspricht
- **THEN** schlägt das Gate fehl, statt sich auf eines der beiden zu verlegen

#### Scenario: Das Gate misst erst nach dem automatischen Lauf gegen DEV

- **WHEN** derselbe Lauf Migrationen auf DEV anwendet und das DEV-Projekt zugleich
  das Ziel der Prüfung ist
- **THEN** läuft die Prüfung erst nach dem Anwenden, sodass sie den Stand nach der
  Migration misst

#### Scenario: Der Stand des anderen Projekts wird berichtet, nicht erzwungen

- **WHEN** das gemessene Projekt abweichungsfrei ist, das jeweils andere aber
  Migrationen vermissen lässt
- **THEN** steht dieser Rückstand im Protokoll und der Deploy läuft weiter

#### Scenario: Eine Migration scheitert an vorhandenen Zeilen, bevor sie PROD erreicht

- **WHEN** eine Migration gegen eine leere Datenbank sauber läuft, aber an
  vorhandenen Zeilen scheitert — etwa eine `not null`-Ergänzung ohne Default
  auf einer nicht leeren Tabelle
- **THEN** scheitert sie beim automatischen Lauf gegen DEV und erreicht PROD
  nicht

> Diese Zusage reicht nur so weit wie DEVs Datenbestand. DEV trägt Demo-Daten;
> was an der Beschaffenheit echter Mitgliederdaten hängt — Dubletten unter einem
> neuen Unique-Index, gewachsene Altwerte, Kardinalitäten — fängt es nicht. Der
> Lauf gegen PROD bleibt deshalb ein gelesener Dry-Run, kein Durchreichen.

#### Scenario: Remote-only-Drift fällt ebenfalls auf

- **WHEN** auf dem gemessenen Projekt eine Migration verzeichnet ist, die es lokal
  nicht gibt
- **THEN** bricht die Prüfung ab, statt nur in die andere Richtung zu vergleichen

#### Scenario: Das Gate schweigt nicht bei Nichtwissen

- **WHEN** dem Drift-Gate die Zugangsdaten zum gemessenen Projekt fehlen oder das
  angesprochene Projekt nicht bestimmt werden kann
- **THEN** schlägt es fehl, statt den Deploy durchzulassen

#### Scenario: Eine fehlgeschlagene Generalprobe hält den Deploy an

- **WHEN** der automatische Lauf gegen DEV fehlschlägt, während das gemessene
  Projekt abweichungsfrei ist
- **THEN** unterbleibt der Frontend-Deploy, statt an der stillen Frühwarnung
  vorbeizulaufen

#### Scenario: Ein Lauf gegen PROD ohne vorherige Generalprobe unterbleibt

- **WHEN** ein Lauf gegen PROD für einen Commit ausgelöst wird, für den kein
  erfolgreicher DEV-Lauf vorliegt
- **THEN** bricht er ab
