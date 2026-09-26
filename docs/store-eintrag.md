# Store-Eintrag — die Texte und Angaben

Entstanden am **2026-09-26** beim Ausfüllen der Play Console (AGE-907).
Die Bilder liegen daneben in `docs/store-assets/`, der Prüfhinweis-Text für
beide Stores in `docs/pruefer-zugang.md`.

> Diese Datei ist die **Quelle**, die Konsole ist die Kopie. Wer einen Text
> dort ändert, ändert ihn hier mit — sonst weiß beim nächsten Mal niemand,
> welche Fassung gilt.

## Warum es diese Datei gibt

Store-Texte werden einmal getippt und dann jahrelang zitiert: in der Konsole,
in der Prüfung, in Mails an Mitglieder. Ohne eine versionierte Fassung ist die
einzige Quelle ein Eingabefeld hinter einem Login, das nur einer sieht.

## App-Name

```
eff.bee.zee
```

Der **Launcher-Name auf dem Gerät** kommt nicht von hier, sondern aus
`android/app/src/main/res/values/strings.xml` bzw. `capacitor.config.ts`
(`appName`). Beide sagen ebenfalls `eff.bee.zee` — wer einen ändert, muss den
anderen mitziehen.

Solange der Store-Eintrag leer ist, zeigt Play stattdessen einen **temporären
Namen** aus der Paketkennung: `com.effbeezee.app (unreviewed)`. Das ist kein
Fehler, sondern Googles Platzhalter, und er verschwindet mit dem gespeicherten
Eintrag.

## Kurzbeschreibung (max. 80 Zeichen)

```
Das Netzwerk des Fair Business Club — für Mitglieder, auf dem Telefon.
```

70 Zeichen.

## Vollständige Beschreibung (max. 4000 Zeichen)

```
eff.bee.zee ist die App des Fair Business Club.

Sie richtet sich an Mitglieder des Clubs. Eine Mitgliedschaft entsteht
persönlich, nicht über ein Anmeldeformular — ohne Zugang zeigt die App
deshalb keine Inhalte.

Was Mitglieder darin tun:

• Aktivität — lesen, was im Club passiert, und selbst etwas beitragen.
• Mitglieder — das Verzeichnis durchsuchen, nach Region, Branche und
  Kompetenz.
• Kontakte — Kontaktanfragen stellen und annehmen. Kontaktdaten werden
  nie automatisch weitergegeben, sondern erst nach Zustimmung.
• Nachrichten — direkt mit angenommenen Kontakten schreiben.
• Events — Veranstaltungen des Clubs sehen und sich anmelden.
• Profil — das eigene Profil pflegen: Kurzbio, Kompetenzen, was du
  suchst und was du bietest.

Die App benachrichtigt über neue Beiträge, Kontaktanfragen und
Nachrichten. Mitteilungen lassen sich in den Einstellungen abschalten.

Dein Konto kannst du jederzeit in den Einstellungen löschen — direkt in
der App, ohne Umweg über eine Anfrage.

Fair Business Club — gemeinsam erfolgreich.
```

**Kein englischer Claim.** „YOUR NEXT OPPORTUNITY" aus den Markenvorlagen wird
nirgends übernommen (Donald, 28.08.) — es widerspricht dem deutschen
„Gemeinsam erfolgreich". Ein späterer Vergleich „Markenvorlage vs. Repo" sieht
deshalb nach einem Fehler aus und ist keiner.

Der Satz über die fehlende öffentliche Registrierung steht bewusst **im zweiten
Absatz**, nicht versteckt: Er beantwortet die Frage, die sonst jeder Prüfer und
jeder neugierige Besucher stellt.

## Die elf Aufgaben der Konsole

Stand 26.09., „1 von 11 erledigt". Was belegt ist und was nicht:

| Aufgabe | Antwort | Beleg |
|---|---|---|
| Datenschutzerklärung | `https://app.effbeezee.com/datenschutz` | 26.09. geprüft → HTTP 200 |
| Anmeldedaten | **offen** — braucht das Prüferkonto | siehe unten |
| Anzeigen | keine | ✓ bereits erledigt |
| Einstufung des Inhalts | **offen** — Fragebogen | siehe unten |
| Zielgruppe | 18 und älter | Geschäftsnetzwerk, keine Zielgruppe darunter |
| Datensicherheit | `docs/store-datenschutzangaben.md` | dort Zeile für Zeile belegt |
| Behörden-Apps | nein | |
| Finanzfunktionen | **nein — mit Verfallsdatum** | siehe Warnung unten |
| Gesundheit | nein | |
| App-Kategorie | Unternehmen | |
| Store-Eintrag | Texte oben, Bilder in `store-assets/` | |

## Die Bilder

| Datei | Format | Wofür |
|---|---|---|
| `store-assets/play-icon-512.png` | 512 × 512 | Store-Symbol |
| `store-assets/play-feature-graphic.png` | 1024 × 500 | Feature-Grafik, **Pflichtfeld** |
| `store-assets/play-telefon/*.png` | 1080 × 1920 | fünf Telefon-Screenshots |

Das Symbol ist aus `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`
(1024 × 1024) auf 512 verkleinert — dieselbe Marke wie auf dem Gerät, kein
zweites Motiv, das auseinanderlaufen könnte.

## ⚠️ „Finanzfunktionen: nein" hat ein Verfallsdatum

Heute richtig: Der Stripe-Kaufweg **ruht**. `/mitgliedschaft` leitet auf `/` um,
sieben Einstiege sind entfernt (PR #419, `935b987`). In der App findet niemand
einen Kaufweg.

Der Code liegt aber weiter da. **Wenn AGE-908 Stripe reaktiviert, wird aus dem
„nein" ein „ja"**, und diese Angabe muss mitgezogen werden — zusammen mit der
Datensicherheit, wo dann Zahlungsdaten dazukommen. Eine falsche Angabe an
dieser Stelle ist ein Richtlinienverstoß, kein Schönheitsfehler.

## Zwei Aufgaben, die auf das Prüferkonto warten

**Anmeldedaten** (Play) und **App Review Information** (Apple) verlangen beide
Kennung und Kennwort eines funktionierenden Kontos. Das Prüferkonto existiert
am 26.09. **nicht**: In Infisical `prod` liegt nichts dergleichen, und auf PROD
steht kein Konto auf der dafür vorgesehenen Stufe.

Es entsteht nach der Stufen-Migration (AGE-903), direkt auf der neuen Stufe
`discover` (Rang 4) — Anlegen statt Migrieren, damit es keinen Zwischenzustand
gibt. Operatives in `docs/pruefer-zugang.md`.

Die **interne** Testgruppe braucht davon nichts: kein Prüferkonto, keine
Prüfung. Nur die externe Gruppe hängt daran.

**Einstufung des Inhalts** ist bewusst offen gelassen. Die Antworten hängen an
der tatsächlichen Nutzung — nutzergenerierte Inhalte, Direktnachrichten,
Kontaktdaten —, und geraten wird hier nicht.
