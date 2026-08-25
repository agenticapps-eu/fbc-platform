# Stille Fehlschläge sichtbar machen, und der Weg zu eingehenden Anfragen (AGE-591/592/593)

Linear-Issues: AGE-592, AGE-591, AGE-593

## Why

Am 25.08. stand auf PROD eine echte Kontaktanfrage seit 09:19 unbeantwortet, weil
der Empfänger sie **nicht finden konnte**. Bei der Untersuchung fielen zwei
weitere Flächen auf, die im Fehlerfall schweigen statt zu reden. Alle drei sind
derselbe Fehlermodus: **die Oberfläche sagt nichts und sieht dabei aus wie „alles
in Ordnung".**

Der Konfigurationsteil der Störung ist behoben (`mailer_autoconfirm`, `APP_URL`).
Diese drei Löcher bleiben und sind Code.

## What Changes

- **Der Weg zu eingehenden Anfragen (AGE-592).** „Meine Anfragen" steht heute
  ausschließlich auf `/kontakte`, und dieser Routeneintrag trägt
  `section: "sub"` — `SIDEBAR_SECTIONS` rendert nur `entdecken` und
  `mein-bereich`, es gibt also **keinen Menüeintrag**. Der Eintrag kommt zurück,
  **mit Zähler**, sobald offene Anfragen vorliegen.
- **Registrierung ohne Sitzung (AGE-591).** GoTrue antwortet bei einer bereits
  bekannten Adresse mit **200, ohne Fehler und ohne Sitzung**
  (`user_repeated_signup`, Aufzählungsschutz). `LoginPage.onSubmit` prüft nur
  `error !== null` und meldet deshalb nichts. Der Fall bekommt eine sichtbare
  Rückmeldung.
- **Anfragen-Widget bei Fehler (AGE-593).** `isError` steht in derselben
  Bedingung wie „nichts da"; ein gescheiterter Abruf ist von einem leeren
  Posteingang nicht zu unterscheiden. `isError` wird getrennt.

## Capabilities

### New Capabilities

Keine.

### Modified Capabilities

- `contact-requests`: Zwei neue Anforderungen — eine offene eingehende Anfrage
  SHALL ohne Vorwissen erreichbar sein, und ein gescheiterter Abruf SHALL NOT wie
  ein leerer Posteingang aussehen.
- `access-control`: Die bestehende Anforderung „Eine Selbstregistrierung löst den
  Bestätigungslink selbst aus" setzt ausdrücklich voraus, dass „die Sitzung
  besteht, bevor der Versand beginnt". Genau diese Annahme bricht bei einer
  bekannten Adresse. Der Fall wird ergänzt.

## Impact

Kein Migrationsbedarf, keine RLS-, RPC- oder Datenmodelländerung. Der Zähler
liest dieselbe Abfrage, die das Widget schon benutzt (`fetchIncomingRequests`) —
**kein zweiter Weg zur selben Wahrheit**.

Betroffener Code: `src/config/nav.ts` (Sektion des `/kontakte`-Eintrags) ·
`src/components/AppShell.tsx` (Zähler am Eintrag) ·
`src/components/mein-bereich/kontakte-widgets.tsx` (Fehlerzustand) ·
`src/pages/LoginPage.tsx` und `src/providers/AuthProvider.tsx` (Sitzung aus
`signUp` durchreichen).

**Was AGE-494 richtig gesehen hat und was nicht.** Der Menüeintrag wurde damals
mit „Kontakte erreicht man über das Profil und den Chat" entfernt. Für einen
bestehenden **Kontakt** stimmt das. Für eine **offene eingehende Anfrage** nicht:
der Chat wird erst nach der Annahme freigeschaltet, und die Profilseite hilft nur,
wenn man die des Absenders gezielt aufruft. Der Eintrag kommt deshalb nicht als
Rücknahme jener Entscheidung zurück, sondern für den Fall, den sie nicht traf.
