## ADDED Requirements

### Requirement: Die Grenzen der Token-Ausgabe gelten auch gegen gleichzeitige Anforderungen

Die Grenzen, die eine Token-Ausgabe begrenzen — Sperrfrist, Tageskontingent und
das Schutzfenster für einen noch gültigen Link —, SHALL auch dann gelten, wenn
zwei Anforderungen für dasselbe Profil gleichzeitig laufen.

Sie SHALL NOT allein auf einer vorangehenden Abfrage beruhen. Zwischen dem Lesen
des Zustands und dem Schreiben liegt sonst ein Fenster, in dem eine zweite
Anforderung ihr Token committet; die gelesene Antwort ist dann veraltet, und der
nachfolgende Schreibvorgang entwertet genau den frischen Link, den das
Schutzfenster schützen soll.

Das ist dieselbe Pflicht, die für die Einmaligkeit je Profil bereits gilt, nur
auf die Grenzen gezogen. Für die Einmaligkeit trägt sie eine Bedingung der
Datenbank; für die Grenzen kann sie das nicht, weil „nichts tun" sich nicht als
Bedingung schreiben lässt. Sie SHALL deshalb durch eine **Sperre** erfüllt
werden, die alle ausgebenden Wege **vor** ihren Prüfungen auf dieselbe Zeile
nehmen.

Welche Grenze den unterliegenden Aufruf fängt, SHALL NOT Teil dieser Zusage
sein. Zwei Anforderungen, die dicht genug beieinander liegen, um sich zu
überholen, liegen auch innerhalb der Sperrfrist — diese greift dann zuerst, und
Schutzfenster wie Tageskontingent werden gar nicht erreicht. Zugesagt ist die
**Wirkung**: der Verlierer entwertet nichts und gibt nichts aus.

Die Sperre SHALL von **jedem** ausgebenden Weg genommen werden — dem
sitzungsfreien wie dem authentifizierten. Nimmt nur einer sie, serialisiert sie
die Wege nicht gegeneinander, und der Wettlauf zwischen ihnen bleibt offen.

Die beiden ausgebenden Wege SHALL die beteiligten Zeilen in derselben
Reihenfolge sperren — erst die Profilzeile, dann die Token-Zeilen. Jeder
künftige Schreiber, der beide Tabellen anfasst, SHALL dieselbe Reihenfolge
einhalten; die Freiheit von wechselseitiger Blockade folgt aus dieser
Reihenfolge und nicht aus der Sperre allein.

Die bestehende Bedingung der Datenbank gegen ein zweites ausstehendes Token
SHALL **bestehen bleiben**. Sie deckt einen anderen Fall ab als die Sperre —
Schreibvorgänge, die an den ausgebenden Wegen vorbeigehen und die Sperre deshalb
nie sehen — und ihr Wegfall tauschte einen belegten Schutz gegen einen neuen.

Der authentifizierte Weg SHALL **kein** Schutzfenster bekommen. Sein Subjekt ist
die Sitzung; wer angemeldet ist, darf sich einen neuen Link ausstellen lassen.
Für ihn wirkt die Sperre anders: sie verhindert, dass zwei gleichzeitige eigene
Anforderungen einen Datenbankfehler an den Aufrufer durchreichen.

#### Scenario: Die verlierende Anforderung entwertet den frischen Link nicht

- **GIVEN** ein Profil, dessen ausstehender Link älter ist als das Schutzfenster
- **WHEN** zwei Anforderungen für dieses Profil gleichzeitig laufen und die
  erste ihr Token committet, bevor die zweite ihren Schreibvorgang beginnt
- **THEN** antwortet **genau eine** der beiden mit einem ausgebenden Status
- **AND** das committete Token der Gewinnerin ist danach **weder entwertet noch
  ersetzt**
- **AND** die Verliererin antwortet mit einer der Grenzen — bei zwei
  Anforderungen innerhalb der Sperrfrist mit deren Status

#### Scenario: Der authentifizierte Weg reicht keinen Datenbankfehler durch

- **WHEN** ein angemeldetes Mitglied zweimal gleichzeitig einen eigenen Link
  anfordert
- **THEN** kehren beide Aufrufe **ohne Datenbankfehler** zurück
- **AND** nur einer von beiden hat ein Token ausgegeben

#### Scenario: Der Schutz gilt auch zwischen den beiden Wegen

- **WHEN** eine sitzungsfreie und eine authentifizierte Anforderung für dasselbe
  Profil gleichzeitig laufen — in beliebiger Reihenfolge, wer zuerst kommt
- **THEN** wartet die zweite nachweislich auf die erste, statt auf einem
  veralteten Stand zu entscheiden
- **AND** auch hier gibt genau eine der beiden ein Token aus

#### Scenario: Einfügen an den ausgebenden Wegen vorbei bleibt abgewiesen

- **WHEN** ein zweites ausstehendes Token für dasselbe Profil geschrieben wird,
  ohne einen der ausgebenden Wege zu benutzen
- **THEN** weist die Datenbank es weiterhin ab
- **AND** ein ausgebender Weg, der dabei unterliegt, meldet den Fehler **nicht**
  an seinen Aufrufer weiter
