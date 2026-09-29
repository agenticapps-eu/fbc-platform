# Die Fläche spricht nur noch von DISCOVER, FOCUS und IMPACT

Linear: **AGE-969**

## Why

Donald am 29.09.: an der Oberfläche soll nur noch über die drei Clubstufen
gesprochen werden. ACTIVE, BOOST und CONNECT sollen **nirgends** mehr
auftauchen — nicht in der Anwendung, nicht in der mobilen App, nicht im Blog.
**Gelöscht wird nichts**; die drei kommen später wieder.

**Heute stehen sie an drei Sorten von Stellen**, und nur zwei davon sind ein
Problem:

| Sorte | Beispiel | Betroffen? |
|---|---|---|
| Eine **Schwelle** benennen | „Das Verzeichnis ist ab Discover verfügbar" | nein — alle Schwellen nennen DISCOVER |
| Die **eigene Stufe** eines Mitglieds zeigen | Plakette im Profil, „Active-Mitglied" | ja |
| **Alle Stufen aufzählen** | Startseite (öffentlich), Admin-Einzelbearbeitung | ja |

Gemessen: alle drei `minTier`-Angaben im Baum lauten `discover`. Kein
Gate-Text kann also eine verborgene Stufe nennen.

**Der Bestand ist vorher bereinigt worden, und das ist die Voraussetzung.** Am
29.09. standen drei Konten auf ACTIVE — zwei Testkonten und eine echte, noch
nicht bestätigte Bewerbung. Alle drei sind über `admin_set_tier` mit
Begründung auf DISCOVER gehoben worden. Danach: **5 × discover, 73 × impact,
sonst nichts.** Ohne diesen Schritt wäre das Ausblenden eine Kaschierung
gewesen; mit ihm ist es die Wahrheit.

**Was bleibt, ist der Neuzugang.** Auf der Anmeldeseite steht „Noch kein Konto?
Registrieren", und `profiles.tier` hat den Vorgabewert `active`. Wer sich
morgen registriert, landet wieder unterhalb des Clubs — und da Stripe ruht,
führt von dort kein Weg nach oben. Für diesen Fall gilt die Entscheidung vom
29.09.: **keine Stufe nennen.** Keine Plakette, und wo heute ein Stufenname
steht, steht eine Aussage über den Zugang.

**Und ein Fund nebenbei, der nicht warten sollte:** die AGB §3.2 zählt die
Stufen namentlich auf — und zwar noch die **alten** Namen, Basic · Connect ·
Discover · Exchange · Focus · Impact. Sie ist seit AGE-903 nicht nachgezogen
worden. Der einleitende Satz lautet „derzeit insbesondere folgende", und der
Absatz danach behält ausdrücklich das Recht vor, Stufen einzuführen — die
Kürzung auf drei trägt dieser Text also.

## What Changes

- **Eine benannte Menge „die Stufen, über die wir sprechen".** `LEVEL_ORDER`
  bleibt vollständig und wird nicht angefasst; daneben entsteht die Liste der
  Clubstufen, abgeleitet aus `CLUB_RANK` statt abgeschrieben. Alle
  aufzählenden Flächen lesen sie.
- **Eine Stufe unterhalb des Clubs wird nicht benannt.** Die Plakette
  erscheint dort gar nicht, und wo heute „Active-Mitglied" steht, steht künftig
  eine Aussage über den Zugang statt über einen Namen.
- **Die öffentliche Startseite zeigt drei Stufen statt sechs**, und der Satz
  darüber sagt nicht mehr „Sechs Stufen, aufsteigend".
- **Die Admin-Einzelbearbeitung bietet dieselben drei zur Wahl** wie die
  Mitgliederliste seit AGE-903 — eine bestehende niedrigere Stufe bleibt
  sichtbar und wählbar, damit sie nicht stillschweigend hochgesetzt wird.
- **„Nächster Schritt" nennt keine verborgene Stufe**, sondern entfällt dort.
- **Die AGB §3.2 nennt Discover, Focus und Impact.**
- **Die Blog-Geschichte „Das Verzeichnis beginnt bei Connect" nennt künftig
  Discover** — sie beschreibt eine Schwelle, die seit AGE-903 bei DISCOVER
  liegt.
- **Die erzeugten Neuigkeiten verlieren die Namen nicht durch eine Umschrift
  des Archivs.** Das Archiv bleibt, wie es war; die Auslieferung bekommt einen
  Weg, einzelne Einträge zurückzuhalten.

## Ausdrücklich nicht in diesem Change

- **`/mitgliedschaft` gehört zu AGE-928.** Die Route ist seit AGE-907 auf `/`
  umgeleitet, die Seite also nicht erreichbar. AGE-928 baut sie als reine
  Anzeige neu und hat dafür eigene Entscheidungen, die über „drei statt sechs"
  hinausgehen (in den nativen Hüllen ohne Preise, Support-Hinweis nur im Web).
  Sie liest dann dieselbe Liste, die hier entsteht — das ist die Naht.
- **Preise werden nicht angefasst.** Ob auf der öffentlichen Startseite Preise
  stehen dürfen, ist die Apple-3.1.1-Frage aus AGE-928.
- **Keine Stufe wird gelöscht** — weder aus `levels.ts`, noch aus
  `membership_tiers`, noch aus dem Gating. `has_level(4)` bleibt unberührt.
- **Keine Migration.** Die Datenbank kennt weiterhin sechs Stufen; das ist
  richtig so, denn Konten können wieder dort landen.
- **Die Selbstregistrierung wird nicht geschlossen.**

## Capabilities

### Modified Capabilities

- `membership-tiers` — welche Stufen die Oberfläche benennt, und was an der
  Stelle einer nicht benannten Stufe steht.

## Impact

Rein anzeigend. Kein Schema, keine Rechte, keine Edge Function. Betroffen sind
acht Dateien in `src/`, zwei Inhaltsdateien und der Erzeuger der Neuigkeiten.
