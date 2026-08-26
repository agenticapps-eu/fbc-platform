## Why

Linear: **AGE-505** (Befund P3 aus Review 8.7 zu AGE-495, dort Aufgabe 11.7).

Ein Mitglied, das sein Passwort vergisst, hat in der App **keinen Weg zurück**.
`rg 'resetPasswordForEmail|forgot|reset-password' src` findet nichts. Für nicht
aktivierte Konten ist das gedeckt — `/aktivierung` fordert einen Link an, und
`redeem-activation` setzt dabei ein neues Passwort. Für **aktivierte** Konten
greift das nicht: `issue_activation_token` antwortet `already_activated`,
verschickt nichts, und die Oberfläche meldet trotzdem Erfolg.

Nach C10 (Import) ist „aktiviert" der Normalfall, nicht die Ausnahme. Ohne
diesen Weg landet jeder vergessliche Fall von Hand auf
`info@fairbusinessclub.de` — und zwar genau dann, wenn siebzig Konten
gleichzeitig neu sind.

## What Changes

- **Der vorhandene Token-Weg wird geöffnet, nicht dupliziert.** Das Einlösen —
  Beanspruchen in einer Anweisung, Passwort setzen, Sitzungen widerrufen — ist
  gebaut, geprüft und wird unverändert wiederverwendet.
- `issue_activation_token` gibt für ein aktiviertes Konto ein Token aus, Status
  **`issued_reset`**, statt mit `already_activated` abzulehnen. Der Zweig wandert
  dabei **hinter** 60-s-Sperre, Schutzfenster und Tageskontingent — stünde er wie
  heute davor, ginge der Reset-Weg an allen drei Grenzen vorbei.
- **BREAKING (intern):** `already_activated` verschwindet als Status von
  `issue_activation_token`. Einziger Aufrufer ist `send-activation`.
  `request_own_activation_token` behält den Status und bleibt unangetastet.
- `send-activation` wählt an `issued_reset` einen **zweiten Mailtext**: 72
  Stunden, „alle Geräte werden abgemeldet", und „falls du das nicht warst,
  ignoriere diese Mail". Sein Link zeigt auf `/passwort-neu`.
- Zwei Routen: `/passwort-vergessen` (anfordern) und `/passwort-neu` (einlösen),
  erreichbar über „Passwort vergessen?" auf `/login`. Das Einlöse-Bauteil ist
  dasselbe wie für die Aktivierung, unterschieden nur durch die Wortwahl.

**Ausdrücklich nicht Teil dieses Changes:** „Passwort ändern" für ein
angemeldetes Mitglied. Wer angemeldet ist, hat kein vergessenes Passwort.

## Capabilities

### New Capabilities

- `password-reset`: Der sitzungsfreie Weg zurück in ein Konto, dessen Passwort
  unbekannt ist — Anfordern, Zustellen, Einlösen, und die Grenzen, die dabei
  gelten. Trennt sich von `access-control` dadurch, dass es nicht regelt, wer was
  sehen darf, sondern wie jemand seinen Zugang zurückbekommt.

### Modified Capabilities

Keine. Der Aktivierungsweg steht heute noch **nicht** in
`openspec/specs/access-control/spec.md` — er hängt vollständig im offenen Delta
von `member-activation-flow`. Ein `MODIFIED`-Delta hätte also nichts, worauf es
zeigen könnte.

Stattdessen wird dort **ein Satz präzisiert** (Entscheidung Donald,
2026-08-07): „Ein erneuter Versand an ein bereits aktiviertes Konto SHALL keine
Mail auslösen" sagt gemeint war, aber nicht wörtlich, _keine Aktivierungsmail_.
Der Satz und sein Szenario werden auf diesen Zweck verengt. Ohne das stünden
zwei offene Deltas da, die einander widersprechen.

## Impact

**Datenbank** — `issue_activation_token` (Neudeklaration; keine neue Tabelle,
keine neue Spalte, keine neue Function).

**Edge Functions** — `send-activation` (Statusprüfung + Textwahl),
`send-activation/emails.ts` (zweiter Text, zweite URL-Form).
`redeem-activation` und `claim_activation_token` bleiben unberührt.

**Frontend** — `LoginPage.tsx` (ein Link), zwei neue Routen in `App.tsx`, das
Einlöse-Bauteil bekommt einen Zweck-Schalter.

**Nicht betroffen** — Drossel, Schutzfenster, Grants, die 202-Bauart gegen
Adressaufzählung, `request_own_activation_token`, `ActivationScreen.tsx`.

**Benannte Sicherheitsfolge** — wer eine Login-Adresse kennt, kann künftig auch
für aktivierte Konten Mails auslösen. Begrenzt durch 60 s + 5/Tag je Profil +
Schutzfenster; Empfänger ist immer die hinterlegte Adresse; die Antwort bleibt
einheitlich `202`. Sitzungen werden **nur beim Einlösen** widerrufen, nie beim
Anfordern — ein Fremder kann damit niemanden ausloggen.
