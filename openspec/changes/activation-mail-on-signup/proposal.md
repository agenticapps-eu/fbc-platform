# Aktivierungsmail bei der Selbstregistrierung (AGE-526)

## Why

Bei der Demo mit Detlev am 2026-08-10 kam für keine der neuen Registrierungen
eine E-Mail an. Es ist keine Mail fehlgeschlagen — **es wurde nie eine
angefordert**: `activation_tokens` trägt für den Tag null Zeilen, und von 952
Gateway-Anfragen im Demo-Fenster ging keine einzige auf `/functions/`.

Der Grund ist eine Lücke zwischen zwei richtigen Entscheidungen. Die eingebaute
E-Mail-Bestätigung ist ausgeschaltet (AGE-445), und der Aktivierungsweg aus
AGE-495 wurde für **importierte** Mitglieder gebaut, denen ein Admin den Link
schickt. Wer sich selbst registriert, fällt hinter dasselbe Gate, aber niemand
löst für ihn einen Versand aus. Der Bildschirm sagt ihm dabei „Wir schicken dir
einen Link an …" — im Präsens, als wäre sie unterwegs. Detlev hat gelesen,
gewartet und sich 84 Sekunden nach der Registrierung wieder abgemeldet.

Für ein Konto aus der Selbstregistrierung ist dieser Link die einzige Tür. Ohne
ihn ist die Registrierung eine Sackgasse, die wie ein Erfolg aussieht.

## What Changes

- Eine erfolgreiche Selbstregistrierung löst den Versand des Bestätigungslinks
  **ohne weiteres Zutun** aus. Der Knopf auf dem Aktivierungsbildschirm bleibt
  als zweiter Weg bestehen.
- Der Aktivierungsbildschirm zeigt den Zustand, der wirklich eingetreten ist.
  Heute gibt der Client-Aufruf `void` zurück und verschluckt den Status der
  Function; ein `rate_limited` sieht damit aus wie ein Versand. Der Status wird
  durchgereicht.
- **Neu: eine profilübergreifende Grenze von 100 Token-Ausgaben pro Stunde** auf
  dem sitzungsgebundenen Weg. Sie greift nur für Profile, die **jünger als 10
  Minuten** sind, also für den Registrierungsschwall. Ein Mitglied, dessen Konto
  älter ist, kommt über den Knopf immer durch — die Sperre eines frischen Kontos
  löst sich nach zehn Minuten von selbst.

Kein **BREAKING**: Alle bestehenden Grenzen (60-Sekunden-Sperrfrist,
Tageskontingent von fünf) bleiben unverändert; die neue Grenze tritt neben sie.

## Capabilities

### New Capabilities

Keine.

### Modified Capabilities

- `access-control`: Der gesamte Aktivierungsweg ist dort spezifiziert. Zwei
  Requirements ändern sich — „Der Aktivierungsversand ist gegen
  Selbstüberflutung begrenzt" bekommt die plattformweite Grenze, und der
  Auslöser des Versands sowie die Wahrhaftigkeit der Rückmeldung kommen als
  neue Requirements hinzu.

## Impact

**Code**

- `src/providers/AuthProvider.tsx` — `signUp` löst den Versand aus.
- `src/lib/activation.ts` — `resendActivationLink()` gibt den Status zurück.
- `src/pages/ActivationScreen.tsx` — startet im Zustand „unterwegs", wenn der
  automatische Versand griff, und meldet nie Erfolg ohne Ausgabe.
- `supabase/migrations/` — neue Migration an
  `request_own_activation_token`: plattformweite Grenze, neuer Status
  `rate_limited_global`.

**Nicht im Umfang**

- `send-activation` (der adressbasierte Weg ohne Sitzung) bleibt unberührt.
- AGE-517 wird **entschärft, nicht geschlossen**: Wer 100 Ausgaben pro Stunde
  abwartet oder Profile altern lässt, steht wieder beim heutigen
  Zwei-Anfragen-Weg. Eine Grenze je Absender-IP bleibt offen.

**Betrieb**

Die Migration muss auf DEV **und** PROD angewandt werden; ein Frontend-Deploy
allein aktiviert sie nicht.

**Linear:** AGE-526. Verwandt: AGE-495 (Herkunft), AGE-517 (entschärft),
AGE-445 (warum die eingebaute Bestätigung aus ist).
