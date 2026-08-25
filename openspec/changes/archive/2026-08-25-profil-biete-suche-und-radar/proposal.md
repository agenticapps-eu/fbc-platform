# Profilseite: Kompass-Einträge entdoppeln, Erfolgsradar entfernen

Linear: AGE-597

## Why

### „Ich biete / Ich suche" doppelt zweimal, aus zwei verschiedenen Gründen

**Doppelung A ist Darstellung.** `MatchingList` rendert `item.title` und
`item.category` nebeneinander — links das Klartext-Label „Know-how", rechts den
rohen Enum-Schlüssel `know_how`. Der Badge zeigt den Datenbankwert.

**Doppelung B ist Datenlage.** Bei importierten Freitext-Zeilen steht die erste
Zeile der Beschreibung auch im Titel.

Erhebung über alle 112 Zeilen auf PROD:

| Befund | Zahl |
|---|---|
| ohne Kategorie (Freitext) | 93 (83 %) |
| mit Kategorie | 19 |
| kategorisierte Zeilen **mit** Beschreibung | **0** |
| Freitext-Zeilen **ohne** Beschreibung | **0** |
| Titel ist Präfix der Beschreibung | 58 |
| Titel mit `'-`-Artefakt | 13 |
| Titel mit Auslassungszeichen gekürzt | 35 |
| davon exakt 80 Zeichen | 3 |
| Editor-Titel, die die Beschreibung NICHT wiederholen | 0 |
| meiste Marken auf einem Profil | 11 |
| meiste Marken in EINER Reihe | 6 |
| Abschnitte, die nach beiden Regeln leer blieben | 0 |
| längste Beschreibung | 1048 Zeichen |

Die Sorten sind sauber getrennt, und jede Kategorie trägt über alle Profile
genau **einen** Titel-Wert — nämlich ihren eigenen Namen. Für kategorisierte
Zeilen ist der Kasten also reine Verschwendung: die Kategorie *ist* der Inhalt.

### Der Erfolgsradar zeigt eine Zeilenzahl

`recompute_potential_score` speist ihn primär aus den Kompass-Antworten.
**`compass_responses` ist leer — 0 Zeilen, 0 Profile.** Es greift immer der
Ersatzzweig `least(getaggte_zeilen * 2, 10)`. Nachgerechnet am gemeldeten
Profil: 2.0↔1, 8.0↔4, 8.0↔4, 4.0↔2. Über die ganze DB sind 10 von 12 Werten
über null glatte Vielfache von 2, und es gibt überhaupt nur 12 Radar-Zeilen —
**3 Profile von 74**.

**Und das ist kein neues Urteil.** AGE-539 hat den Erfolgsradar bereits
entfernt, mit eigener Anforderung („Vertagte Fähigkeiten erscheinen nicht auf
dem eigenen Profil"), die ihn namentlich nennt — aber nur für die **eigene**
Seite. Die fremde Ansicht zeigt ihn weiter. Dazu listet „Die Profilansicht folgt
dem Mockup" die Abschnitte abschließend auf und endet bei den Eckdaten; ein
Radar steht dort gar nicht. Die öffentliche Seite verletzt heute also **zwei**
bestehende Anforderungen.

## What Changes

- Kategorisierte Einträge werden zu einer Marken-Reihe, ohne rohen Schlüssel
  und ohne redundanten Titel.
- Freitext-Einträge werden Text; der Titel entfällt, wo er nur der Anfang der
  Beschreibung ist.
- Führende `'-`-Artefakte werden **beim Darstellen** entfernt, nicht in der
  Datenbank.
- Nachgemessen am 25.08. (`scripts/probe-age597-kompass-bestand.ts`): der
  Import kürzt lange Titel an der Wortgrenze mit einem Auslassungszeichen,
  nicht mitten im Wort, und **kein** Editor-Titel im Bestand ist eigenständig.
- Der Erfolgsradar verschwindet aus der öffentlichen Profilansicht.

## Impact

- `openspec/specs/member-profiles/` — eine geänderte, eine neue Anforderung
- `src/pages/PublicProfilePage.tsx` — `MatchingList` und der Radar-Block

Keine Migration. `profile_theme_scores` und `recompute_potential_score` bleiben
unberührt, damit die Rückkehr eine Zeile ist.

## Entscheidungen und ihre Kosten

**Pills oben, Texte darunter** (Donald, 25.08.). Verworfen: alles als Marke mit
aufklappbarem Text — 93 von 112 Zeilen sind Freitext, die Substanz läge dann
hinter einem Klick.

**Artefakte nur in der Anzeige putzen** (Donald, 25.08.). Ein UPDATE wäre
sauberer an der Quelle, ist aber ein Schreibzugriff auf Mitgliederinhalte ohne
deren Zutun — und die drei mitten im Wort gekappten Titel ließen sich damit
ohnehin nicht rekonstruieren.

**Die Berechnung bleibt liegen** (Donald, 25.08.). Nur der Block geht. Preis:
`recompute_potential_score` erzeugt weiter Werte, die niemand sieht.

## Non-goals

- Den Kompass zu bauen. Bis dahin ist der Radar unbeantwortbar.
- Die Altdaten zu bereinigen.
- Die eigene Profilansicht anzufassen — dort ist der Radar seit AGE-539 fort.
