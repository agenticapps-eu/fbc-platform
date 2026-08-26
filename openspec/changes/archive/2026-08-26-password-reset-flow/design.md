## Context

AGE-505 / Befund P3 aus Review 8.7. Der Rückweg ins eigene Konto fehlt für
aktivierte Mitglieder.

Der entscheidende Befund beim Erkunden: **das Einlösen existiert bereits
vollständig.** `redeem-activation` macht Beanspruchen →
`auth.admin.updateUserById({ password })` → Sitzungen widerrufen →
`mark_activated`. Und `claim_activation_token`
(`20260806080200_activation_rpcs.sql:128-134`) fragt **gar nicht**, ob das Profil
aktiviert ist — es beansprucht jedes gültige, unbenutzte, unentwertete Token.

Damit ist der Rückweg keine Neubauaufgabe. Genau **ein Zweig** verschließt ihn:
`already_activated` in `issue_activation_token`
(`20260806090000_activation_self_request.sql:171-174`).

Randbedingungen, die Alternativen ausschließen:

- `[auth.email.smtp]` ist in `supabase/config.toml` auskommentiert — Supabases
  eingebauter Mailversand ist nicht verdrahtet.
- `[auth.rate_limit]` trägt die AGE-496-Warnung, dass sich das Stundenlimit
  derzeit nicht erhöhen lässt.
- `enable_confirmations = false` ist eine festgeschriebene Entscheidung, mit dem
  ausdrücklichen Vermerk „nicht korrigieren".

## Goals / Non-Goals

**Goals:**

- Ein aktiviertes Mitglied setzt sein Passwort ohne fremde Hilfe neu.
- Der Weg beginnt dort, wo das Mitglied scheitert: auf `/login`.
- Kein zweites Token-Verfahren. Einmaligkeit unter Nebenläufigkeit, Hash-only,
  Drossel und Aufzählungsschutz werden wiederverwendet, nicht nachgebaut.
- Die Grenzen des Aktivierungsversands gelten unverändert auch hier.

**Non-Goals:**

- **„Passwort ändern" für ein angemeldetes Mitglied.** Wer angemeldet ist, hat
  kein vergessenes Passwort. `request_own_activation_token` bleibt deshalb
  unangetastet und behält seinen `already_activated`-Zweig.
- Kein MFA, kein Recovery-Code (AGE-433, eigenes Thema).
- Keine Änderung an `redeem-activation`, `claim_activation_token`, der Drossel,
  dem Schutzfenster oder der 202-Bauart.

## Decisions

### 1. Der Zweck wird abgeleitet, nicht gespeichert

Verworfen: eine Spalte `purpose` auf `activation_tokens`. Der Zweck ist aus
`profiles.activated_at` **ableitbar** — ist das Konto aktiviert, kann es nur ein
Reset sein. Eine gespeicherte Spalte wäre ein zweiter Ort für dieselbe Wahrheit
und könnte von ihr abweichen.

`issue_activation_token` gibt deshalb `issued_reset` statt `issued` zurück, und
`send-activation` entscheidet daran über den Text.

### 2. Der Zweig wandert ans Ende — das ist der eigentliche Eingriff

Heute steht `already_activated` **vor** der 60-s-Sperre, dem Schutzfenster und
dem Tageskontingent. Bliebe er dort und gäbe nur ein Token aus, liefe der
Reset-Weg an allen drei Grenzen vorbei — und wäre damit genau der ungedrosselte
Mail-Auslöser, den der Aktivierungsweg vermeidet.

Neue Reihenfolge: `unknown` → 60 s → Schutzfenster → Tageskontingent →
entwerten + ausgeben → Status aus `v_activated` bestimmen. `already_activated`
verschwindet dabei als Status; einziger Aufrufer ist `send-activation`.

### 3. Die Route trägt den Zweck, weil das Token es nicht kann

Das Token ist bewusst undurchsichtig: 32 Byte aus dem CSPRNG, gespeichert nur
als SHA-256, im Klartext ausschließlich im Fragment. Es kann seinen Zweck nicht
mitteilen, und es soll es auch nicht.

Also trägt ihn die **Zieladresse**: Die Aktivierungsmail linkt weiter auf
`/aktivierung`, die Reset-Mail auf `/passwort-neu`. Beide Routen rendern
dasselbe Einlöse-Bauteil, unterschieden nur durch die Wortwahl. Das ist zugleich
der Grund, warum der Reset keinen eigenen Endpunkt braucht: `redeem-activation`
bleibt einer.

### 4. Verworfene Alternativen

**Supabases `resetPasswordForEmail`.** Am wenigsten eigener Code, aber der
Versand liefe über Supabases geteilten Mailer statt über Resend — anderer
Absender als `effbeezee.com`, projektweite Grenze laut AGE-496 nicht erhöhbar,
und ein zweites Token-Verfahren mit eigener Ablaufsemantik neben dem geprüften.

**Eigene Tabelle `password_reset_tokens` mit eigenen Functions.** Sauberste
Trennung — ein Reset-Token könnte per Bauart nie ein Konto aktivieren. Preis:
die sicherheitskritischen Teile werden dupliziert, und damit auch ihre künftigen
Fehler. Bei einem Mechanismus, der gerade erst zwei Runden Audit hinter sich
hat, ist das der teurere Weg.

**Das Schutzfenster für den Reset-Weg lockern.** Nicht getan: es ist genau die
Regel, die verhindert, dass ein Fremder mit Adresskenntnis den Link des
Mitglieds entwertet.

### 5. Der Widerspruch im offenen Delta wird aufgelöst, nicht vererbt

`member-activation-flow` ist nicht archiviert; sein Delta enthält den Satz „Ein
erneuter Versand an ein bereits aktiviertes Konto SHALL keine Mail auslösen"
samt Szenario. Gemeint war _keine Aktivierungsmail_ — es gibt an einem
aktivierten Konto nichts zu aktivieren.

Entscheidung Donald, 2026-08-07: Der Satz und sein Szenario werden dort auf
diesen Zweck **verengt**, statt den Widerspruch bis zum Archivieren
stehenzulassen. Das fasst ein bereits reviewtes Delta an und gehört deshalb in
dessen `REVIEWS.md` vermerkt.

## Risks / Trade-offs

**Ein Fremder mit Adresskenntnis kann Mails auslösen.** Das ist das übliche
Modell jedes Passwort-Reset und hier begrenzt durch 60 s + 5/Tag je Profil +
Schutzfenster. Empfänger ist immer die hinterlegte Adresse, die Antwort bleibt
einheitlich `202`. Was er **nicht** kann: jemanden aussperren oder ausloggen —
Passwort und Sitzungen fallen erst beim Einlösen, und dafür braucht es die Mail.

**Das Tageskontingent wird geteilt.** Fünf Anforderungen je Profil und Tag
gelten künftig für Aktivierung und Reset zusammen. Für ein Konto, das beides an
einem Tag braucht, ist das eng — aber der Fall setzt voraus, dass es erst
aktiviert und dann sein Passwort vergisst. Bewusst nicht erhöht: die Grenze
schützt das Resend-Kontingent.

**`already_activated` fällt als Status weg.** Ein Aufrufer, der ihn noch prüft,
prüft ins Leere. Heute gibt es genau einen (`send-activation`); der Test hält
das fest, damit ein künftiger zweiter nicht still danebenläuft.

**Der Reset-Weg erbt das Schutzfenster — samt seiner Kehrseite.** Wer die
Reset-Mail nicht bekommt, wartet bis zu 24 Stunden. Das ist derselbe Befund wie
P2/E1, und er ist auf dem Aktivierungsweg bereits behoben (der Fehlversand
entwertet sein Token, `20260807190000`). Der Reset-Weg profitiert davon
automatisch, weil er dieselbe Function benutzt.
