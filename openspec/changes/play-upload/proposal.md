## Why

AGE-907

`ios-release.yml` lädt seit `53a5577` nach TestFlight hoch. `android-release.yml`
endet weiter beim AAB und APK als Artefakt — der Spiegel ist halb.

Donald am 25.09.: den Weg jetzt verdrahten, obwohl das **erste AAB von Hand**
geht. Dasselbe Muster wie bei iOS: bauen, was später ohnehin gebraucht wird, und
die erste Auslieferung trotzdem mit der Hand machen.

**Der Preis ist diesmal höher und wird benannt.** Bei iOS lagen alle
Zugangsdaten bereits in Infisical; die Authentifizierung ließ sich lokal
nachstellen. Für Play existiert **kein Service-Konto und kein Schlüssel**. Der
Schritt entsteht vollständig gegen die Dokumentation, und nichts daran ist
gemessen.

## What Changes

- **`android-release.yml` lädt in den geschlossenen Testkanal hoch**, über die
  Play-Publishing-API, nur auf ein **geschobenes** Tag `android-v*`.
- **Der Upload steht hinter dem Signaturnachweis und hinter der
  Artefaktablage** — wie auf der iOS-Seite, aus denselben zwei Gründen.
- **Fehlt das Service-Konto, bricht der Lauf laut ab** statt still zu
  überspringen. Ein grüner Tag-Lauf, der nichts ausgeliefert hat, wäre die
  schlechteste aller Antworten.
- Der Wächter `scripts/android-release.workflow.test.ts` bekommt Zusagen für
  Bedingung, Reihenfolge und Kanal.
- **Ein neues Secret**: `PLAY_SERVICE_ACCOUNT_JSON` in Infisical `prod`.

## Capabilities

### New Capabilities

Keine.

### Modified Capabilities

- `native-shell`: Die Zusage „Ein nativer Bau läuft nur, wenn er angefordert
  wird" ist seit #424 schon store-neutral formuliert und deckt Android
  inhaltlich mit. Zwei Stellen stimmen aber nicht:
  1. Sie sagt „eine Übertragung ist bei **Apple**" — das war richtig, solange es
     nur einen Store gab.
  2. Das Szenario „Ein Tag überträgt" sagt „**dieselben** Zugangsdaten
     authentifizieren, die schon signiert haben". Für iOS stimmt das (der
     ASC-Schlüssel tut beides). Für Android ist es **falsch**: Der Keystore
     signiert, ein Service-Konto überträgt. Zwei Geheimnisse, zwei Zwecke.

  Dazu kommt eine neue Zusage, die dieser Change überhaupt erst nötig macht:
  **fehlende Übertragungs-Zugangsdaten brechen den Lauf**, sie überspringen ihn
  nicht.

## Impact

- `.github/workflows/android-release.yml` — ein Schritt plus Kopf.
- `scripts/android-release.workflow.test.ts` — der Wächter.
- **Ein neues Geheimnis** in Infisical `prod`, das es noch nicht gibt.
- **Keine Migration, kein Frontend.** `drift-gate` bleibt ohne Befund.
- Eine **fremde Action** kommt hinzu (SHA-gepinnt) — siehe `design.md`, die
  Alternative war 60 Zeilen ungetesteter API-Tanz.
