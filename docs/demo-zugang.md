# Demo-Zugang für Detlev — FBC Plattform (Phase-1-Prototyp)

> Fertiger Nachrichtentext zum Kopieren (Mail/Slack). Begleitend zum `docs/demo-script.md`.
> Die Logins sind **Demo-Test-Accounts** auf der Demo-Welt — keine echten Personen.
>
> **Das Passwort steht nicht mehr hier.** Es liegt als `DEMO_LOGIN_PASSWORD_DEV` in Infisical (`--env=prod`)
> und ist vor dem Versenden einzusetzen. Grund: seit dem Spiegel DEV ← PROD
> (AGE-576) tragen dieselben Konten echte Mitgliederdaten, und dieses
> Repository ist öffentlich — ein Passwort darin gäbe jedem Leser Zugriff auf
> das Verzeichnis. Am 2026-08-20 wurde `Test1234!` deshalb ersetzt und ist
> abgewiesen.

---

**Betreff: FBC Plattform – dein Zugang zum Prototyp**

Hallo Detlev,

der Phase-1-Prototyp ist live und vorführbereit. Damit du die Plattform aus allen drei
Mitgliedsstufen erleben kannst, hast du drei Test-Logins. **Login:** auf
**https://fbc-platform.pages.dev** auf „Login" klicken, E-Mail + Passwort eintippen (keine
Registrierung, kein Bestätigungslink nötig).

**Passwort für alle drei: _hier vor dem Versenden einsetzen_** — `DEMO_LOGIN_PASSWORD_DEV` in Infisical (`--env=prod`).

| Stufe | E-Mail | Persona |
|---|---|---|
| 1 · Discover | `discover@fbcdemo.com` | Jonas Keller |
| 2 · Prime | `prime@fbcdemo.com` | Carla Reinhardt |
| 3 · Legacy | `legacy@fbcdemo.com` | Eleonora Voss |

**In 3 Minuten durch die App – am besten in dieser Reihenfolge:**

1. **Discover (Jonas):** Community-Feed ansehen → dann auf „Verzeichnis" klicken: gesperrt
   („ab Stufe Prime"). Das zeigt, was *zu* ist. → ausloggen.
2. **Prime (Carla):** „Verzeichnis" (mit Filtern) → „Matching" (Treffer mit %-Score und
   Begründung) → ein Mitglied öffnen: bei **Hans-Peter Stadler** stehen *keine* Kontaktdaten
   („erst nach Annahme"), bei **Eleonora Voss** sind Mail + Telefon **freigegeben** (sie hat die
   Anfrage angenommen). Das ist das Kernversprechen: Kontaktdaten erst nach beidseitiger
   Bestätigung. Dann „Mein Bereich" (Dashboard). → ausloggen.
3. **Legacy (Eleonora):** im Feed taucht zusätzlich der „Legacy"-Beitrag auf, den die anderen
   Stufen nicht sehen.

Alles sind klar markierte Demo-Daten. Du kannst gefahrlos liken, posten, dich für Events
anmelden – wir setzen die Demo-Welt bei Bedarf zurück.

Viele Grüße

---

## Interne Hinweise (nicht Teil der Nachricht)

- Alle Tester nutzen dieselben drei Accounts → bei **parallelem** Begutachten teilen sie sich den
  Zustand. Für mehrere gleichzeitige Reviewer besser eigene Accounts pro Person anlegen.
- **Kein E-Mail-Passwort-Reset** (Demo-Adressen sind nicht zustellbar): bei vertipptem Passwort
  über Supabase Studio zurücksetzen, nicht per „Passwort vergessen".
- Stufe ist **nicht selbst-upgradebar** (bewusst) — daher separate Accounts je Level.
- Demo-Welt zurücksetzen: `DEMO_SEED_CONFIRM=fbc-demo DEMO_SEED_TLS_INSECURE=1 pnpm demo:reset`.
