# Gruppe 6, Aufgabe 6.3 — die Befunde des Diff-Reviews, behoben und gemessen

**Datum:** 2026-08-20, nachts · **Ziel aller Läufe: der lokale Stack.** DEV und
PROD sind nicht angefasst worden.

Der Diff-Review (`REVIEWS.md`, zweiter Abschnitt) endete mit gemini APPROVE und
codex REQUEST-CHANGES bei 10 Befunden. Vier davon wurden am Code bestätigt;
Donalds Entscheidung war, **alle vier** zu beheben.

## Was geändert wurde

| Befund | Änderung |
|---|---|
| HIGH — echte PROD-Hashes liegen bis 4.13 auf DEV | 4.13 steht jetzt **unmittelbar hinter dem auth-Rücklauf** statt am Ende |
| HIGH — die SQL-Dateien werden nur auf Anwesenheit geprüft | `dateien` im Manifest (Grösse + sha256), `pruefeSqlDateien` vor dem Löschen |
| HIGH — `soll.buckets` wird nirgends gelesen | `vergleicheBuckets`, in **beide** Richtungen, vor dem Löschen |
| MEDIUM — „alle nachgezählt auf 0" zählt nur `public.profiles` | jede public- **und** auth-Tabelle einzeln, 56 statt 1 |

Sieben neue Tests, alle erst rot. Gesamtstand danach: **1333** statt 1326.

## Der Rückfall, den nur der echte Lauf gefunden hat

Der erste vollständige Lauf nach der Umstellung brach ab:

```
── 4.13: Produktions-Passwort-Hashes neutralisieren
error: function gen_salt(unknown) does not exist
```

**Gemessen, nicht geraten.** Zwei Abfragen:

- `auth.sql`, Zeile 16: `SELECT pg_catalog.set_config('search_path', '', false);`
  — **jeder `pg_dump` leert den `search_path` der Sitzung.**
- `pgcrypto` liegt lokal im Schema `extensions`, nicht in `public`.

Auf dem alten Platz fiel das nie auf, weil 4.13 dort auf `db2` lief — einer
frischen Verbindung, die den Dump nie gesehen hatte. Auf dem neuen Platz läuft
es in derselben Sitzung, die gerade `auth.sql` eingespielt hat.

Das ist bemerkenswert, weil das Skript **genau diese Klasse schon kennt**: es
weist einen Auszug ab, der selbst an `session_replication_role` dreht. Dass
derselbe Auszug den `search_path` anfasst, stand nirgends.

**Behoben** durch eine Katalogabfrage statt einer Annahme — Supabase legt
pgcrypto nach `extensions`, ein nacktes Postgres nach `public`:

```
   ✔ pgcrypto liegt in "extensions"
```

Fehlt die Erweiterung ganz, bricht der Lauf mit einer Begründung ab, statt an
einer Namensauflösung zu scheitern.

## Die Belege

### Der alte Auszug wird abgewiesen — und zwar vor jeder Verbindung

Der Auszug vom 20.08. trägt kein `dateien`. Gemessen (Zeile 189 der Prüfung
liegt vor Zeile 224 der ersten Verbindung und Zeile 243 der ersten Löschung):

```
   ✔ 125 Objekte byteweise gegen das Manifest bestätigt
::error::Das Manifest führt keine Prüfsummen für auth.sql und public.sql —
         der Auszug ist älter als 6.3.
```

**Kein Toleranzpfad.** Ein fehlendes Feld durchzuwinken liesse die Lücke für
genau die Auszüge offen, die sie haben.

### Rot und grün für beide neuen Prüfungen

Gegen eine Kopie des Auszugs, deren Manifest die Prüfsummen nachträglich
bekommen hat:

| Fall | Ergebnis |
|---|---|
| Manifest mit korrekten Prüfsummen | `✔ auth.sql und public.sql byteweise gegen das Manifest bestätigt` |
| `public.sql` **um ein Byte** gekürzt | `::error:: 266357 B / 1ecf64c3… statt 266358 B / 847b65fb…` |
| Buckets stimmen überein | `✔ 4 Buckets stimmen mit dem Auszug überein` |
| `post-media` aus dem Manifest entfernt | `::error:: zusätzlich auf dem Ziel: post-media` |

Die zweite Zeile ist die eigentliche Zusage: **ein Byte** reicht. Eine reine
Längenprüfung hätte den dritten Fall (gleiche Länge, anderer Inhalt) nicht
gesehen, und dafür ist der Hash da.

### Der vollständige Lauf, Exit 0

```
   ✔ 34 public-Tabellen und 22 auth-Tabellen geleert, alle 56 einzeln nachgezählt auf 0
   ✔ auth.users=72, auth.identities=72
   ✔ 4.5: public.profiles ist leer — on_auth_user_created hat nicht gefeuert
   ✔ pgcrypto liegt in "extensions"
   ✔ 72 Hashes durch Zufallswerte ersetzt, 0 aus dem Auszug übrig
   ✔ 17 Trigger stehen unverändert auf 'O'
   ✔ 4.1b: 61 Fremdschlüssel eigens geprüft, keine verwaiste Zeile
   ✔ 125 Objekte geschrieben
   ✔ 36 Tabellen und 125 Objekte stimmen; 3 gewollte Abweichungen benannt
```

„alle 56 einzeln nachgezählt" ist die Zeile, die vorher gelogen hat: sie stand
schon da, gezählt wurde `public.profiles`.

Und „**0 aus dem Auszug übrig**" ist eine echte Messung, keine Behauptung: die
alten Hashes werden vor dem UPDATE in eine temporäre Tabelle gelegt, damit es
danach überhaupt etwas zum Vergleichen gibt. Ein erster Entwurf prüfte
`encrypted_password = crypt('', encrypted_password)` — das misst ein leeres
Passwort, nicht „alter Hash", und wäre eine grüne Zeile ohne Inhalt gewesen.

### `--sicherung` trägt unverändert

Auch dieser Zweig lief vorher auf `db2`. Nach der Umstellung:

```
   ✔ 72 Konten behalten ihren Produktions-Hash und sind anmeldefähig
   ✔ 36 Tabellen und 125 Objekte stimmen; 0 gewollte Abweichungen benannt
```

**Unabhängig nachgerechnet**, nicht aus dem Eigenprotokoll: die 72 bcrypt-Hashes
aus `auth.sql` gegen `select encrypted_password from auth.users` — **72/72
byteweise gleich**.

### Hinterher aufgeräumt

Ein normaler Lauf danach, und dieselbe unabhängige Rechnung: **0/72** Hashes aus
dem Auszug stehen noch in der lokalen Datenbank. Die Probe-Kopie des Auszugs ist
gelöscht.

## Was daraus folgt — und wen es betrifft

**Der gespeicherte Auszug vom 20.08. ist mit dem neuen Code nicht mehr
einspielbar.** Er trägt kein `dateien`, und das wird nicht toleriert. Wer den
Rückweg braucht, zieht einen neuen Auszug aus PROD. Die Prüfsummen nachträglich
zu ergänzen wäre möglich, aber unehrlich: sie beschrieben die Datei von heute,
nicht die vom Erzeugungszeitpunkt — und genau diese Bindung ist der Zweck.

**DEV ist nicht neu bespielt worden.** Der Spiegel dort stammt vom Lauf des
20.08. und ist unverändert gültig; die Änderungen betreffen den **nächsten**
Lauf. Ein `pnpm sync:dev` mit dem neuen Code braucht also zuerst einen neuen
Auszug — und beides fällt beim Klassifikator, gehört also an Donalds Terminal.

## Was bewusst offen bleibt

Zwei der zehn Befunde sind Bauform und stehen weiter so da: dass eine deklarierte
Abweichung die **ganze** Tabelle entschuldigt, und die Identifier-Quotierung für
Katalognamen wie `a"b`. Begründung je in `REVIEWS.md`.

Vier weitere sind richtig beschrieben, aber heute folgenlos — darunter der
`ENABLE ALWAYS`-Trigger, den es auf keinem der drei Ziele gibt, und dass die
Abnahme bei Objekten nur die Anzahl vergleicht.
