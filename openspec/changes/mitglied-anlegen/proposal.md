# Detlev legt ein Mitglied an — und sieht, wer noch auf seine Einladung wartet

Linear: **AGE-927**

## Why

Der Aufnahmeweg für neue Mitglieder läuft heute über Odoo: Bewerbung, Bezahlung,
Anlage dort. Danach soll Detlev das Mitglied **in effbeezee von Hand anlegen** —
mit Vorname, Nachname, E-Mail und dem bezahlten Plan — und ihm optional die
Bestätigungsmail schicken. Keine Stripe-Anbindung, keine Odoo-API.

**Diesen Weg gibt es nicht.** Ein einzelnes Konto lässt sich heute gar nicht
anlegen; es gibt nur den WordPress-Import als Skript mit `service_role`. Es gibt
`admin_activate_member`, „Zugangslink schicken" (AGE-566) und „Stufe setzen"
(AGE-707) — aber kein `admin_create_member`.

**Und das Anlegen allein genügt nicht.** Danach muss Detlev nachhalten können,
wen er noch einladen muss und wen er nur erinnern muss. Heute kann er das nicht:
der Reiter „Nicht aktiviert" wirft beide Gruppen in einen Topf. Gemessen auf PROD
am 28.09.:

| | |
|---|---|
| Profile gesamt | 78 |
| bestätigt | 28 |
| **nicht bestätigt** | **50** |
| … davon Link schon verschickt | 15 |
| … davon **nie eingeladen** | **35** |

Fünfzig Zeilen in einem Reiter, aus denen niemand ablesen kann, welche
fünfunddreissig noch nie eine Mail bekommen haben.

**Die Daten liegen vor und sind trotzdem unerreichbar.** `activation_tokens`
trägt `created_at`, `used_at` und `invalidated_at` — aber die Tabelle ist
**absichtlich** für `anon` und `authenticated` unerreichbar: keine Policy, kein
Grant, und ihr Tabellenkommentar warnt wörtlich davor, eine „fehlende" Policy
nachzureichen. Sie ist der Kern von AGE-495. Der Weg führt deshalb über die
bestehenden SECURITY-DEFINER-Funktionen, nicht über eine neue Policy.

## What Changes

- **Ein Admin legt ein einzelnes Mitglied an.** Ein „+"-Knopf in der
  Mitgliederliste öffnet eine Maske: Vorname, Nachname, E-Mail und Plan
  (DISCOVER, FOCUS oder IMPACT), dazu ein Haken „Bestätigungsmail senden". Das
  Konto entsteht **ohne Passwort**, in genau derselben Form wie ein importiertes
  — das Mitglied setzt sein Passwort selbst über den Link.
- **Die Mitgliederliste zeigt den Aufnahmeprozess statt einer flachen
  Zustandsliste.** Aus dem einen Reiter „Nicht aktiviert" werden zwei: **①
  Angelegt** (noch nie eingeladen) und **② Eingeladen** (wartet auf Bestätigung).
  Dahinter steht **③ Bestätigt**. Jeder Schritt trägt seine Anzahl und die
  nächste Handlung.
- **Ein Admin lädt mehrere ausgewählte Mitglieder auf einmal ein.** Ein
  Kontrollkästchen je Zeile, ein Knopf „Ausgewählte einladen". Das ist die
  einzige Handlung, die die Auswahl auslöst.
- **Der Bericht sagt die Wahrheit, auch wenn nichts verschickt wurde.** Liegt
  ein noch gültiger Link im Postfach, schickt die Kette absichtlich nichts. Die
  Rückmeldung nennt das beim Namen, statt einen Versand zu behaupten.
- **Eine doppelte Adresse legt kein zweites Konto an**, sondern führt zum
  bestehenden Mitglied.

**BREAKING (intern, kein Datenverlust)** — drei Funktionen ändern ihre
Signatur oder ihren Rückgabetyp: `member_state_matches` bekommt ein fünftes
Argument, `admin_list_members` eine Spalte, `admin_member_counts` zwei neue
Zustände. Alle drei sind Admin-Funktionen ohne Aufrufer ausserhalb dieses Repos.

## Ausdrücklich nicht in diesem Change

- **Kein Stripe, kein Self-Service-Upgrade, keine Odoo-API.** AGE-263 bleibt
  später.
- **Kein Massenversand, kein CRM, keine Newsletter.** Der Zaun aus AGE-304
  bleibt wortgleich stehen. Die Mehrfachauswahl wird eng geöffnet und
  ausschliesslich für den bestehenden Aktivierungslink — begründet in
  **ADR-0007**.
- **Keine Policy auf `activation_tokens`.** Die Tabelle bleibt für `anon` und
  `authenticated` unerreichbar; das hält ein Test fest.
- **Keine Zustellbestätigung.** `created_at` belegt, dass ein Link **erzeugt**
  wurde — nicht, dass die Mail angekommen ist. Ein 202 vom Versand belegt
  nichts. Die Beschriftung sagt „eingeladen", nicht „zugestellt".
- **Keine neuen Spalten in `profiles`.** Firma und Telefon nur, soweit die
  Felder schon bestehen.

## Capabilities

### New Capabilities

Keine. Der Change erweitert die bestehende `admin`-Capability.

### Modified Capabilities

- `admin`: die Zusage „keine Mehrfachauswahl" wird eng geöffnet (ADR-0007); die
  Mitgliederliste bekommt das Anlegen, den Einladungsstand, zwei zusätzliche
  Zustände und die Auswahl-Einladung. Betroffen sind ausserdem die Anforderungen
  zu den Reitern und ihren Anzahlen.

## Impact

**Datenbank.** Eine neue Migration, forward-only:

- `member_state_matches` bekommt ein fünftes Argument (der Einladungszeitpunkt)
  und zwei neue Zustände `angelegt` und `eingeladen`. Die Signatur ändert sich,
  also `drop` + `create` — und der `revoke` danach **wieder aussprechen**, er
  wird nicht geerbt.
- `admin_list_members` bekommt die Spalte `eingeladen_am`. Der Rückgabetyp
  ändert sich, also ebenfalls `drop` + `create`, mit Grants und Kommentar.
- `admin_member_counts` zählt die beiden neuen Zustände mit.
- Der Einladungsstand wird aus `activation_tokens` **abgeleitet**, innerhalb der
  SECURITY-DEFINER-Funktion. Keine Policy, kein Grant auf die Tabelle.

**Edge Function.** Neu: `admin-create-member`, nach dem Muster von
`admin-change-email` (`verify_jwt = true`, Admin-Prüfung über `staff_roles`,
Admin-API mit `service_role`, weil das Konto in `auth.users` entstehen muss).

**Frontend.** `src/pages/AdminMitgliederPage.tsx` (Reiter, Auswahl, „+"), eine
neue Maske, `src/lib/admin-members.ts`, und `src/types/database.types.ts` —
diese Datei ist **handgepflegt**, `gen types` darf nicht darüberlaufen.

**Tests.** pgTAP für die drei Funktionen und für die Unerreichbarkeit von
`activation_tokens`; Deno für die Edge Function; Vitest für Maske, Reiter und
Auswahl. `admin_member_list_test.sql` benennt Funktionsidentitäten über
`::regprocedure` — diese Casts zeigen nach der Migration auf neue Signaturen und
müssen mitgezogen werden, sonst ist eine Zusage ungeprüft statt rot.

**Doku.** ADR-0007 (liegt bereits vor), `docs/lastenheft.md`.
