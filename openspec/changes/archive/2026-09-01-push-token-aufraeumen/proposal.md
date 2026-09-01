## Why

Linear: AGE-682

Beim iOS-Gerätetest am 28.08. meldete die Zustellung `{"zugestellt": 2}`, obwohl
nur **ein** Gerät in der Hand war. Die zweite Zustellung ging an das Token einer
**deinstallierten** App. APNs hat es angenommen, nicht abgelehnt.

Der bestehende Löschpfad greift genau dann nicht. `push_zustellung_quittieren`
entfernt ein Token bei `p_ergebnis = 'dauerhaft'`
(`20260827240000_push_zustellung.sql:292-294`), und `dauerhaft` entsteht
ausschliesslich aus einer **Ablehnung** des Anbieters — 410, `Unregistered`,
`BadDeviceToken` nach der Host-Gegenprobe aus AGE-641, FCM `NOT_FOUND`. Bleibt
die Ablehnung aus, bleibt die Zeile.

Apple liefert die Ablehnung **absichtlich unzuverlässig**: `410 Unregistered`
erscheint auf einem undokumentierten, bewusst unscharfen Zeitplan, damit
Anbieter aus Push-Antworten keine Deinstallationen ablesen können. Auf
FCM/Android verfällt ein Token nach 270 Tagen Inaktivität von selbst; auf APNs
gibt es diese Grenze nicht.

### Der Befund, der diesen Vorschlag zweiteilig macht

Die erste Fassung dieses Vorschlags wollte auf `push_tokens.letzter_kontakt`
löschen und berief sich darauf, dass die Spalte „bei jedem App-Start" gesetzt
werde. **Das ist falsch, und die Plan-Review hat es widerlegt, bevor eine Zeile
Code existierte** (`REVIEWS.md`).

Gemessen an der Aufrufkette: `claim_push_token` wird nur aus `src/lib/push.ts:69`
gerufen, das aus `pushEinrichten()` kommt, das in `AppShell.tsx:619-632` an
`nachrichtenOffen` hängt — Chat-Schublade oder `/chat` — und dort hinter einem
Riegel steht, der **einmal je Konto** fällt. `letzter_kontakt` misst also „wann
dieses Mitglied zuletzt die Nachrichten geöffnet hat". Für jemanden, der die App
täglich nutzt und nie in den Chat geht, steht der Wert für immer auf dem Tag der
Registrierung.

Die Behauptung stammt aus dem **Spaltenkommentar der Migration selbst**
(`20260827210000:55-57`). Der Kommentar ist falsch und wird mitkorrigiert.

Ohne echtes Lebenszeichen ist eine Frist bei **jedem** Wert unsicher: sie
löscht früher oder später ein lebendes Gerät. Firebase verlangt für genau
dieses Verfahren denn auch ein **monatliches** Erneuern des Zeitstempels
(`EXPIRATION_TIME` im Beispiel: 30 Tage). Der Befund und die Primärquelle zeigen
in dieselbe Richtung.

**Deshalb zwei Hälften, und die erste kommt zuerst.**

## What Changes

### 1 · Das Lebenszeichen wird echt

- Beim Start der App auf einer nativen Fläche wird das Gerätetoken **erneut
  abgelegt**, wenn die Erlaubnis **bereits erteilt** ist — ohne Dialog, ohne
  Frage, ohne Sichtbares.
- Das widerspricht der bestehenden Anforderung nicht: sie verbietet, die
  **Erlaubnis** beim Start *anzufordern*
  (`push-fundament/specs/notifications/spec.md:330-332`). Wo nichts angefordert
  wird, wird auch nichts verbraucht — der iOS-Systemdialog bleibt für den
  Nachrichten-Weg reserviert.
- Auf der Web-Fläche geschieht weiterhin nichts.
- Der falsche Spaltenkommentar wird korrigiert.

### 2 · Darauf der Aufräumer

- **Neu:** `public.push_tokens_aufraeumen()` — entfernt Zeilen aus
  `push_tokens`, deren `letzter_kontakt` älter als **180 Tage** ist, und gibt
  die Zahl der entfernten Zeilen zurück. `security definer`,
  `search_path = ''`, Ausführungsrecht ausgesprochen entzogen für `public`,
  `anon`, `authenticated` **und `service_role`**.
- **Kein Parameter.** Die Frist steht in der Funktion. Der Test altert die
  Fixtures (`now() - interval '181 days'`), nicht die Frist — damit gibt es auch
  keinen Aufruf, der versehentlich alles löscht.
- **Geändert:** `public.push_auftraege_faellig()` ruft den Aufräumer als
  **erste** Anweisung. Damit läuft er auf dem bestehenden Minutenpfad.
- **Eine Frist für beide Plattformen**, ausdrücklich: Android-Token
  verschwinden damit 90 Tage vor FCMs eigenem Verfall. Das ist gewollt — mit
  dem Lebenszeichen aus Hälfte 1 heisst 180 Tage auf beiden Plattformen
  dasselbe, nämlich „die App lief ein halbes Jahr nicht".
- **Keine neue Zeitplanung, kein neues handangelegtes Objekt.** Die
  Erwartungslisten des Objekt-Drift-Scans aus AGE-679 bleiben unverändert:
  `inMigrationen` gilt, sobald der Name wörtlich in einer Migration steht
  (`scripts/db-drift-scan.ts:161-172`).

## Capabilities

### New Capabilities

Keine.

### Modified Capabilities

- `notifications`: zwei neue Anforderungen. Erstens, dass ein Gerät beim Start
  ein Lebenszeichen setzt, ohne eine Erlaubnis anzufordern. Zweitens, dass ein
  Token ohne Lebenszeichen entfernt wird — samt der Gegenanforderung, dass ein
  Token **mit** frischem Lebenszeichen bestehen bleibt. Die zweite Hälfte ist
  die, ohne die ein Aufräumer, der nichts findet, und einer, der alles löscht,
  identisch aussehen.

## Impact

**Code**

- `src/lib/push.ts` — das stille Erneuern.
- `src/components/AppShell.tsx` — der Aufruf beim Start, getrennt vom
  bestehenden Nachrichten-Effekt.
- Neue Migration: Funktion, `create or replace` auf `push_auftraege_faellig`,
  Korrektur des Spaltenkommentars.
- Neuer pgTAP-Lauf; `docs/secrets.md` (der Minutenlauf tut jetzt zwei Dinge).

**Verhaltensänderung, nicht bloss Aufräumen**

Ein Token nach einem Zeitfenster zu löschen, ist eine **zustellungsbrechende
Änderung** — kein reines Aufräumen. Der Wiederherstellungsweg ist genau benannt:
mit Hälfte 1 legt der nächste Start der App das Token wieder ab, ohne Dialog und
ohne Zutun des Mitglieds. Ohne Hälfte 1 gäbe es diesen Weg nicht; das ist der
Grund, warum sie zuerst kommt.

**Nicht betroffen**

- `scripts/db-drift-scan.logic.ts` — es entsteht kein Objekt ausserhalb einer
  Migration.
- `push_wiederholung()` — bleibt unangetastet. Sie ist handangelegt und trägt
  den `PUSH_WEBHOOK_SECRET` im Rumpf; Logik gehört dort nicht hinein.
- `push_auftraege_holen()` — der Erstvergabeweg bleibt, wie er ist. Die
  Aufräum-Zusage gilt ausdrücklich nur für den Fälligkeitslauf.

**Betrieb**

Rund 1440 zusätzliche Löschprüfungen je Tag und Projekt auf einer Tabelle mit
heute 1 (PROD) bzw. 2 (DEV) Zeilen. Wirkt in der Breite erst mit echten Geräten,
also ab AGE-642 — was die Abnahme ausdrücklich berücksichtigt.
