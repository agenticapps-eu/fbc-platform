# Der Anmeldeknopf hält sich an die Teilnahmeschwelle (AGE-594)

Linear-Issues: AGE-594

## Why

`register_for_event` lässt zu einem `members`-Event nur ab `discover` (rank 3)
oder den Host — die Schwelle ist spezifiziert und gehalten. Die **Fläche davor**
kennt sie nicht: Ein `basic`- oder `connect`-Mitglied sieht einen normalen
„Anmelden"-Knopf, drückt ihn, und bekommt erst danach eine Fehlermeldung mit dem
**rohen Text der Datenbank** — „membership level too low to register". Englisch,
technisch, und zu spät.

Das ist der vierte Befund aus der PROD-Untersuchung vom 25.08. und derselbe
Fehlermodus wie AGE-591/592/593, nur andersherum: Statt zu schweigen verspricht
die Fläche etwas, das sie nicht halten kann.

## What Changes

- Der Knopf ist gesperrt, wenn die Stufe des Betrachters die Schwelle des Events
  nicht erreicht. **Daneben** steht der Grund samt der nötigen Stufe und ein Weg
  zur Mitgliedschaft — ein grauer Knopf ohne Erklärung wäre seinerseits eine
  Fläche, die nichts sagt.
- Gespiegelt wird die Funktion **vollständig**, einschließlich ihrer Ausnahmen:
  `public` steht jedem offen, und der **Host** darf zu seinem eigenen
  `members`-Event unabhängig von seiner Stufe.

## Capabilities

### New Capabilities

Keine.

### Modified Capabilities

- `events`: Eine neue Anforderung an die Oberfläche. Die bestehende Anforderung an
  `register_for_event` bleibt **unverändert** — die Hürde bleibt die Funktion.

## Impact

Kein Migrationsbedarf, keine RLS-, RPC- oder Datenmodelländerung. Reine Anzeige.

Betroffener Code: `src/pages/EventDetailPage.tsx` (`RegistrationPanel`,
neue reine Funktion `darfSichAnmelden`).

**Was das ausdrücklich NICHT ist: eine zweite Sicherheitsgrenze.** Das Frontend
ist Komfort, nicht Sicherheit (`access-control`). Ein gesperrter Knopf hält
niemanden auf, der die Funktion direkt ruft — und muss es auch nicht, weil sie
selbst hält. Deshalb sperrt die Fläche auch NICHT, solange die Stufe noch lädt:
Ein Ladezustand darf niemanden aussperren.
