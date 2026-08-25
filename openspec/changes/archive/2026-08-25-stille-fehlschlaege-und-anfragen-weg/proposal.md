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
  `mein-bereich`, es gibt also **keinen Menüeintrag**. Ein Eintrag **„Meine
  Anfragen"** erscheint unter „Mein Bereich", **solange** offene Anfragen
  vorliegen, mit ihrer Anzahl.
- **Registrierung auf eine bekannte Adresse (AGE-591).** Beim Bauen gemessen und
  dabei korrigiert: GoTrue antwortet **je nach Einstellung verschieden**. Mit
  eingeschalteter E-Mail-Bestätigung mit 200 ohne Fehler und ohne Sitzung
  (Aufzählungsschutz) — so stand PROD vom 16. bis 25.08., daher die stumme Seite.
  Seit `mailer_autoconfirm` wieder `true` ist, mit **HTTP 422
  `user_already_exists`**, und das Formular zeigte dessen rohen englischen Text
  „User already registered" — der nirgendwohin führt und die Existenz des Kontos
  ausspricht. **Beide** Ausgänge bekommen jetzt denselben neutralen Hinweis, der
  zum **Zugangslink** führt. Jeder andere Fehler bleibt im Klartext.
- **Die Nebenwirkungen der Registrierung hängen am falschen Zweig.** In
  `AuthProvider.signUp` laufen `logEvent("signup")` und das sitzungsgebundene
  `resendActivationLink()` unter `if (!error)` — also **auch** bei einer
  Wiederholung ohne Sitzung. Das ist die `42501`-Anfrage aus den PROD-Logs und
  eine Registrierungszählung, die Wiederholungen mitzählt. Beides zieht hinter
  `data.session`. **Dieser Punkt kam erst aus dem Plan-Review** und ist ein
  echter Fehler, kein Textproblem.
- **Anfragen-Widget bei Fehler (AGE-593).** `isError` steht in derselben
  Bedingung wie „nichts da"; ein gescheiterter Abruf ist von einem leeren
  Posteingang nicht zu unterscheiden. `isError` wird getrennt — aber nur dort,
  wo **keine** Daten vorliegen; ein gescheitertes Nachladen über vorhandenen
  Anfragen darf sie nicht verstecken.

## Capabilities

### New Capabilities

Keine.

### Modified Capabilities

- `contact-requests`: Drei neue Anforderungen — eine offene eingehende Anfrage
  SHALL ohne Vorwissen erreichbar sein, ein **unbekannter** Stand SHALL NOT wie
  „keine" aussehen, und ein gescheiterter Abruf SHALL NOT wie ein leerer
  Posteingang aussehen.
- `access-control`: Die bestehende Anforderung „Eine Selbstregistrierung löst den
  Bestätigungslink selbst aus" wird **modifiziert**, nicht nur ergänzt. Sie sagt
  „nach einer erfolgreichen Selbstregistrierung", und genau diese Zweideutigkeit
  — HTTP-Erfolg gegen tatsächlich entstandene Sitzung — trägt den Fehler. Der
  neue Wortlaut bindet „erfolgreich" an die Sitzung. Dazu eine neue Anforderung
  für den stummen Fall.

## Impact

Kein Migrationsbedarf, keine RLS-, RPC- oder Datenmodelländerung.

Betroffener Code: `src/config/nav.ts` · `src/components/AppShell.tsx` ·
`src/components/ui/SidebarNav.tsx` (Abzeichen) ·
`src/components/mein-bereich/kontakte-widgets.tsx` (Fehlerzustand) ·
`src/lib/contact-requests.ts` (gemeinsame Frischezeit) ·
`src/pages/LoginPage.tsx` · `src/providers/AuthProvider.tsx` ·
`src/providers/auth-context.ts` (Signatur von `signUp`) ·
`src/test/auth-fixtures.tsx` und die bestehenden `signUp`-Attrappen in
`LoginPage.test.tsx` und `AuthProvider.test.tsx` — sobald `hatSession` Teil der
Rückgabe ist, müssen sie es mitführen.

**Der Zähler bekommt keine eigene Wahrheit.** Er ruft `fetchIncomingRequests`
unter demselben `queryKey` wie das Widget; React Query teilt den Eintrag. Was er
NICHT ist: „genau eine Netzwerkanfrage". `fetchIncomingRequests` setzt bei
vorhandenen Zeilen **zwei** Supabase-Anfragen ab (Anfragen, dann Profile), und
mit den Vorgaben von React Query v5 (`staleTime: 0`) holt jedes Mounten, jeder
Fokuswechsel und jedes Reconnect neu. Deshalb bekommt die Abfrage eine
ausgesprochene Frischezeit, die sich beide Flächen teilen.

**Was AGE-494 richtig gesehen hat, und warum der Eintrag bedingt ist.** Der
Menüeintrag wurde damals mit „Kontakte erreicht man über das Profil und den Chat"
entfernt. Für einen bestehenden **Kontakt** stimmt das. Für eine **offene
eingehende Anfrage** nicht: der Chat wird erst nach der Annahme freigeschaltet,
und die Profilseite hilft nur, wenn man die des Absenders gezielt aufruft.

Der erste Entwurf zog `/kontakte` deshalb dauerhaft nach `mein-bereich` und
behauptete dabei, das sei keine Rücknahme von AGE-494. Der Plan-Review hat das
zerlegt, und zu Recht: ein statischer Eintrag steht **jedem** eingeloggten
Mitglied im Menü, auch ohne jede Anfrage — das ist genau der ständige
Kontakte-Punkt, den AGE-494 entfernt hat. Der Eintrag ist deshalb **bedingt**
(Entscheidung Donald, 25.08.) und heißt **„Meine Anfragen"**, nicht „Meine
Kontakte": Er erscheint für einen offenen Vorgang und verschwindet mit ihm.
AGE-494 bleibt unangetastet.
