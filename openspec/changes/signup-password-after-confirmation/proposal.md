# Das Passwort entsteht nach der Bestätigung, nicht davor (AGE-527)

## Why

Bei der Abnahme von AGE-526 am 2026-08-11 ist Donald den Weg zum ersten Mal
vollständig gegangen — Registrierung, Mail, Link, Passwort. Dabei fielen zwei
Dinge auf, die kein Test zeigt, weil beide funktionieren:

1. **Das Passwort wird zweimal abgefragt.** Die Registrierung verlangt eines,
   die Einlöseseite verlangt danach ein zweites — und das zweite ersetzt das
   erste. Das erste ist damit wertlos: gesetzt, nie gebraucht, stillschweigend
   überschrieben.
2. **Das Setzen endet wortlos.** Nach erfolgreichem Einlösen meldet die Seite
   ab und springt auf den Login, ohne ein Wort. Der Abmeldeschritt ist richtig
   — das Passwort ist neu, alle Sitzungen sind widerrufen —, aber wer dort
   landet, weiß nicht, ob es geklappt hat oder etwas schiefging.

Beides trifft ausgerechnet den ersten Eindruck: die einzige Minute, die ein
neues Mitglied mit der Plattform hat, bevor es drin ist.

## What Changes

- **Die Registrierung erhebt kein Passwort mehr.** Name und Adresse genügen.
  Das Passwort entsteht dort, wo es hingehört: beim Einlösen des
  Bestätigungslinks. Die Selbstregistrierung geht damit genau den Weg, den
  importierte Mitglieder schon gehen — ein Weg statt zwei.
- **Das erfolgreiche Setzen bekommt einen eigenen Bildschirm.** Er sagt, dass
  das Passwort gesetzt ist, und führt zum Login: sofort per Knopf oder von
  selbst nach zehn Sekunden. Für **beide** Zwecke der Seite — Aktivierung und
  Passwort-Zurücksetzen.

Kein **BREAKING**: Bestehende Konten und der Weg importierter Mitglieder ändern
sich nicht.

## Capabilities

### New Capabilities

Keine.

### Modified Capabilities

- `access-control`: zwei neue Anforderungen — die Selbstregistrierung erhebt
  kein Passwort, und ein gesetztes Passwort wird bestätigt, bevor der Weg
  weitergeht.

`member-profiles` bleibt **unberührt**. Der erste Entwurf hängte die
Registrierungs-Zusage an „Sign-up auto-provisions a profile" — eine Anforderung
über den `handle_new_user`-Trigger und INSERT-Grants. Ein Formular-Verbot gehört
nicht unter einen DB-Trigger (Befund aus dem Plan-Review).

## Impact

**Code**

- `src/pages/LoginPage.tsx` — kein Passwortfeld im Registrierungsmodus, und das
  **Zod-Schema muss modusbewusst werden**: es verlangt heute `password` in
  beiden Modi (Z. 10–20). Ein entferntes Feld ohne Schema-Änderung heißt, dass
  der Knopf wortlos nichts tut — genau das Anti-Muster, gegen das diese Seite
  schon dreimal einen Kommentar trägt
- `src/providers/AuthProvider.tsx` — `signUp` ohne Passwortargument; erzeugt ein
  starkes Zufallspasswort für den Anmeldedienst
- `src/providers/auth-context.ts` — die Signatur von `signUp` steht dort ein
  zweites Mal
- `src/pages/ActivationRedeemPage.tsx` — Erfolgsschirm vor der Weiterleitung.
  Die Render-Verzweigung ist heute **zweiwertig** (`token && status !==
  "activated"`, Z. 181); der Erfolg ist ein dritter Fall. Wer ihn nur anhängt,
  zeigt dem gerade aktivierten Mitglied das „Link anfordern"-Formular
- Tests: `LoginPage.test.tsx` (assertiert heute hart den Aufruf **mit**
  Passwort), `ActivationRedeemPage.test.tsx`, `src/test/auth-fixtures.tsx`

**Nicht im Umfang**

- Der Anmeldedienst verlangt beim Registrieren zwingend ein Passwort. Es
  verschwindet deshalb nicht, es wird nur **niemandem mehr abverlangt** und ist
  keine Information, die jemand kennt oder kennen muss.
- Migrationen: keine. Das Datenmodell ändert sich nicht.

**Folge, die benannt gehört**

Wer sich registriert und die Mail nie öffnet, hat ein Konto, dessen Passwort
niemand kennt. Zwei Wege zurück gibt es, und beide sind nachgelesen statt
behauptet:

- der Knopf auf dem Aktivierungsbildschirm, solange die Sitzung steht;
- `/passwort-vergessen`. Für ein **unbestätigtes** Konto liefert
  `issue_activation_token` dort `issued`, nicht `issued_reset`
  (`20260807200000:133-140`) — der Mensch bekommt also einen **Aktivierungs**link
  und setzt darüber sein Passwort. Der Weg trägt, nur unter anderem Namen.

Nebeneffekt zugunsten der Sicherheit: Wer eine **fremde** Adresse registriert,
hält danach kein brauchbares Passwort in der Hand — heute hält er das, das er
selbst gesetzt hat.

**Linear:** AGE-527. Verwandt: AGE-526 (Herkunft), AGE-495, AGE-505.
