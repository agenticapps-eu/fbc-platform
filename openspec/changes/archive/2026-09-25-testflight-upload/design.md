## Context

`ios-release.yml` ist die Abschrift einer Befehlsfolge, die am 07.09. lokal
durchgemessen wurde — vom Web-Bündel bis zu Apples Urteil. Der Lauf endet heute
beim signierten, vierfach geprüften `.ipa` als Artefakt. Der letzte Schritt,
`xcrun altool`, wurde damals **validiert statt hochgeladen**; das Archiv der
`capacitor-huelle` hält den Grund fest: „Dadurch ist Build-Nummer 1 noch frei."

Alles, was ein Upload braucht, liegt im Job bereits vor:

| Was | Wo | Seit |
|---|---|---|
| ASC-Schlüssel | `$RUNNER_TEMP/asc.p8` | Schritt „ASC-Schluessel bereitstellen" |
| `ASC_KEY_ID`, `ASC_ISSUER_ID`, `APPLE_TEAM_ID` | `$GITHUB_ENV` | ebenda |
| Das Bündel | `$RUNNER_TEMP/export/App.ipa` | Schritt „Exportieren" |

Es fehlt also keine Zutat, nur eine Zeile — und die Entscheidung, unter welcher
Bedingung sie läuft.

**Die Bedingung, die diesen Change überhaupt zu einem Change macht:** Apple
lässt sich nicht zurücknehmen. Eine hochgeladene Build-Nummer ist verbraucht.

## Goals / Non-Goals

**Goals:**

- Ein getaggter Lauf liefert das Bündel nach TestFlight, ohne Handgriff.
- Ein Handstart bleibt gefahrlos: bauen, prüfen, ablegen, nichts senden.
- Der Nachweis am `.ipa` bleibt das Tor, durch das etwas nach außen geht.
- Das geprüfte Artefakt liegt vor, **auch wenn die Übertragung scheitert**.
- Der ASC-Schlüssel bleibt außerhalb des Arbeitsbaums — bestehende Zusage
  „Native Geheimnisse erreichen das öffentliche Repository nicht".

**Non-Goals:**

- **Android/Play.** Das Service-Konto existiert nicht; das erste AAB geht von
  Hand. Der Spiegel bleibt hier bewusst unsymmetrisch.
- **Die Store-Einreichung.** Konto, Angaben, Prüfgruppen, Freigabe bleiben
  Handarbeit in AGE-907.
- **Warten auf Apples Verarbeitung.** Der Lauf endet mit der Übertragung, nicht
  mit „in TestFlight sichtbar".
- **Versionsführung.** `CFBundleShortVersionString` bleibt, wo es ist; nur die
  Build-Nummer steigt, wie bisher aus `github.run_number`.

## Decisions

### 1. `--p8-file-path` statt der Namenskonvention — gemessen, nicht vermutet

`altool` findet den Schlüssel normalerweise über eine **Namenskonvention**:
`AuthKey_<KEY_ID>.p8` in einem von fünf Suchverzeichnissen. Die Hilfe nennt sie:

```
• ./private_keys
• ~/private_keys
• ~/.private_keys
• ~/.appstoreconnect/private_keys
• $API_PRIVATE_KEYS_DIR
```

**`./private_keys` liegt im Arbeitsbaum.** In einem öffentlichen Repository wäre
das genau der Fehler, den `scripts/native-secrets-guard.ts` und die Zusage
„Native Geheimnisse erreichen das öffentliche Repository nicht" verhindern
sollen. Der Weg über die Konvention hätte also entweder ein Kopieren nach
`~/.appstoreconnect/private_keys/` gebraucht oder eine Umbenennung — beides
Bewegungen, die einen Schlüssel an einen zweiten Ort legen.

Dagegen steht `--p8-file-path <filepath>`, in der Hilfe unter **AUTHENTICATION**
und damit für alle Befehle, nicht nur `--generate-jwt`. **Am 25.09. lokal
nachgestellt** (altool 27.0.5), mit erfundenen Werten und ohne Netzwerkkontakt:

```
$ xcrun altool --upload-app -f /nonexistent/App.ipa -t ios \
    --apiKey ABC123 --apiIssuer 0000… --p8-file-path /nonexistent/asc.p8
ERROR: [altool.main] Failed to load AuthKey file. (-43)
       The file '/nonexistent/asc.p8' could not be found.
```

Die Meldung nennt **den übergebenen Pfad**, nicht ein Konventionsverzeichnis.
Damit ist belegt, dass der Schalter greift und der Schlüssel unter
`$RUNNER_TEMP` liegen bleiben darf, wo der Job ihn ohnehin schon ablegt.

*Verworfen:* Kopie nach `~/.appstoreconnect/private_keys/AuthKey_$ASC_KEY_ID.p8`
— funktioniert, legt den Schlüssel aber ein zweites Mal ab und macht den
Dateinamen von einem Secret abhängig. *Verworfen:* `API_PRIVATE_KEYS_DIR` — löst
dasselbe, braucht aber trotzdem die Umbenennung.

Beide Flag-Schreibweisen (`--apiKey`/`--api-key`) wurden akzeptiert; die Datei
nimmt die camelCase-Form, weil die Kurzfassung der Hilfe sie führt.

### 2. Tag **und Auslöser**, nicht Tag allein — Korrektur aus dem Plan-Review

Der Upload hängt an:

```yaml
if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/ios-v')
```

Der erste Entwurf prüfte **nur** `github.ref`. Der codex-Reviewer hat gezeigt,
dass das die Zusage bricht: GitHubs „Use workflow from"-Auswahl führt auch
**Tags**, ein Handstart auf `ios-v1.0.0` hätte also hochgeladen. Der Fehler wäre
unbemerkt geblieben, weil der Lauf dabei grün ist — die gefährlichste Sorte.

Der Auslöser ist die Absicht, die Referenz nur ihr Name.

*Verworfen: immer hochladen.* Am einfachsten zu lesen, nimmt aber den
gefahrlosen Probebau weg. Jeder Lauf verbrauchte eine Build-Nummer.

*Verworfen: ein `workflow_dispatch`-Eingabefeld.* Flexibler, aber es fügt eine
Bedienoberfläche für eine Entscheidung hinzu, die das Tag schon trifft. Die
Zusage „nur, wenn es angefordert wird" wird von einem Tag klarer getragen als
von einem Ankreuzfeld, dessen Vorgabe man vergisst.

### 3. Reihenfolge: Nachweis → Artefakt → Validierung → Upload

Der erste Entwurf setzte den Upload **vor** die Artefaktablage und behauptete in
den Risiken, ein Fehlschlag träfe „nur den Upload — Artefakt und Nachweis sind
dann bereits gelaufen und liegen vor". Für das Artefakt war das **falsch**:
GitHub überspringt Folgeschritte nach einem fehlgeschlagenen Schritt. Genau im
Fehlerfall hätte das `.ipa` gefehlt.

Gelöst durch **Umstellen statt Bedingung**. Die Ablage wandert vor den Upload;
das braucht kein `if: always()`, behält die heutige Bedeutung (Artefakt nur nach
bestandenem Nachweis) und ist der kleinere Diff.

*Verworfen:* `if: always()` an der Artefaktablage. Es hätte auch bei
fehlgeschlagenem **Nachweis** ein Bündel abgelegt — mehr Verhalten als der
Change braucht, und eine stillschweigende Lockerung des Tors.

### 4. `--validate-app` vor `--upload-app` — aus dem Plan-Review übernommen

Der gemini-Reviewer hat auf das Risiko gezeigt, das dieser Entwurf selbst als
größtes benennt: Der Schritt entsteht blind, und der erste getaggte Lauf ist
zugleich die erste Erprobung. `--validate-app` prüft das Paket gegen Apples
Regeln, **ohne** eine Build-Nummer zu verbrauchen.

Das ist zudem der Weg, den dieses Repo am 07.09. schon gegangen ist:
„Validiert, nicht hochgeladen. Dadurch ist Build-Nummer 1 noch frei."

Der Preis sind ein paar macOS-Runner-Minuten auf Tag-Läufen. Der Gegenwert ist
eine Fehlermeldung **vor** der unumkehrbaren Handlung statt danach.

*Nicht verschwiegen:* `--upload-app` validiert serverseitig ohnehin. Der Gewinn
ist deshalb nicht „findet mehr", sondern „findet es, bevor etwas übertragen
ist", und ein getrennter Schritt sagt im Log, welche der beiden Hälften brach.

### 5. Kein `--wait`

`altool` kann auf Apples Verarbeitung warten. Wir tun es nicht: Die Verarbeitung
dauert Minuten bis Stunden, das sind macOS-Runner-Minuten zum Zehnfachen, und
das Ergebnis ändert nichts am Lauf. Was schiefgeht, steht in App Store Connect
und in der Mail an das Team.

**Daraus folgt eine Zusage, die dieser Change NICHT gibt:** Ein grüner Lauf
bedeutet „übertragen", nicht „von Apple angenommen". Die Verarbeitung kann
danach fehlschlagen. Der Reviewer hat das als unausgesprochene Annahme benannt;
hier steht sie ausgesprochen.

## Risks / Trade-offs

**Der Schritt entsteht blind** → Die App existiert noch nicht in App Store
Connect; der erste getaggte Lauf ist zugleich die erste Erprobung. Das ist
genau der Preis, den die ursprüngliche Reihenfolge („erst Handupload, dann
verdrahten") vermeiden wollte und den Donald am 25.09. bewusst übernommen hat.
*Minderung:* Der Schritt ist die Abschrift eines gemessenen Befehls, die
Authentifizierung ist lokal nachgestellt, `--validate-app` läuft davor, und die
Artefaktablage steht vor beidem — ein Fehlschlag lässt das geprüfte Bündel
zurück.

**Die App fehlt in App Store Connect** → Der erste Lauf scheitert dann mit einer
Meldung, die nicht offensichtlich darauf zeigt. *Minderung:* Kommentar über dem
Schritt, der die Voraussetzung nennt.

**Ein Re-Run desselben Tags scheitert** → `github.run_number` bleibt beim
Wiederholen gleich, Apple lehnt eine doppelte Build-Nummer ab. *Minderung:* Der
Dateikopf sagt das bereits für den Bau („Bei einem Re-Run neu ausloesen statt
wiederholen"); mit dem Upload wird aus einem stillen Gleichstand ein lauter
Fehler, was besser ist.

**Ein Tag liefert sofort aus** → Wer `ios-v…` schiebt, sendet an Apple. Das ist
die Absicht, aber es ist neu. *Minderung:* Der geschützte Environment-Gate
`ios-release` liegt davor und verlangt eine Freigabe.

**Der Schlüssel reist an einen Prozess mehr** → `altool` bekommt jetzt denselben
`.p8`, den `xcodebuild` schon hat. Kein neuer Ablageort, kein neues Secret, kein
zweiter Pfad — deshalb als Risiko benannt und nicht gemindert.

## Migration Plan

Keine. Ein Workflow-Schritt, kein Zustand, keine Migration. Rückweg ist das
Entfernen der beiden Schritte; der Lauf verhält sich dann wieder wie heute.

## Open Questions

- **Ob Apple das erste Bündel annimmt**, zeigt erst der erste getaggte Lauf.
  `--validate-app` war am 07.09. grün, was ein starkes, aber kein vollständiges
  Vorzeichen ist: Validierung prüft das Paket, nicht die Kontoseite.
- **Ob der ASC-Schlüssel Upload-Rechte trägt**, ist nicht geprüft — er hat
  bisher nur signiert. Beide Reviewer haben es als unausgesprochene Annahme
  benannt. Fällt beim ersten Lauf auf, Behebung ist eine Rollenänderung in App
  Store Connect, kein Code.
- **Wie die App in App Store Connect heißt**, entscheidet Donald beim Anlegen.
  Der Upload braucht den Namen nicht — die Bundle-ID genügt —, die Prüfgruppen
  danach schon.
