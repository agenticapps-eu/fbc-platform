# Design — Passwort nach der Bestätigung (AGE-527)

## Context

`supabase.auth.signUp` **verlangt** ein Passwort; ein Konto ohne eines gibt es
im Anmeldedienst nicht. Die Frage ist deshalb nicht, ob eines entsteht, sondern
**wer es kennt und wann er es wählt**.

Der Aktivierungsweg aus AGE-495 setzt das Passwort ohnehin schon beim Einlösen
(`redeem-activation`, gegen ein gültiges Token). Für importierte Mitglieder ist
das der einzige Weg. Die Selbstregistrierung hat bisher zusätzlich davor
gefragt — daher die Dopplung.

`ActivationRedeemPage` trägt bereits einen `Zweck` (`aktivierung` | `reset`) mit
eigenem Wortlaut je Zweck. Der neue Bildschirm hängt sich dort ein, statt eine
zweite Mechanik einzuführen.

## Goals / Non-Goals

**Goals:**

- Genau **eine** Passwortabfrage im ganzen Weg, und zwar nach der Bestätigung.
- Nach dem Setzen weiß der Mensch, dass es geklappt hat, bevor er den Login
  sieht.

**Non-Goals:**

- Den Anmeldedienst ohne Passwort betreiben (Magic-Link-Registrierung). Das
  wäre ein anderes Auth-Modell und kollidierte mit dem Aktivierungsweg.
- Die Passwortregeln ändern (Mindestlänge, Prüfung) — die bleiben, wo sie sind.
- Den Abmeldeschritt nach dem Einlösen entfernen. Er ist richtig: Das Passwort
  ist neu und alle Sitzungen sind widerrufen, auch die eigene.
- Den Erfolgsschirm über einen Neuladen oder den Zurück-Knopf hinweg erhalten.
  Er lebt im Zustand der Seite; wer neu lädt, landet wieder beim „Link
  anfordern"-Formular. Bewusst hingenommen: Der Zustand ist Sekunden alt, die
  Weiterleitung nutzt weiterhin `replace`, und alles andere hieße, den Erfolg in
  die Adresszeile oder den Speicher zu schreiben — für einen Bildschirm, der
  zehn Sekunden steht.

## Decisions

### D1 — Ein Zufallspasswort, das niemand je sieht

`signUp` erzeugt es aus dem CSPRNG (32 Byte, base64url) und übergibt es an den
Anmeldedienst. Es wird nirgends angezeigt, protokolliert oder gespeichert.

*Verworfen: ein festes Platzhalterpasswort.* Es wäre für alle Konten gleich und
damit ein Generalschlüssel für jedes Konto zwischen Registrierung und
Bestätigung — genau das Fenster, in dem das Gate noch zu ist, der
Anmeldedienst aber schon Sitzungen ausgibt.

*Verworfen: das Passwortfeld nur ausblenden und clientseitig etwas Ausgedachtes
senden.* Dasselbe wie oben, nur unauffälliger.

### D2 — `signUp` verliert das Passwortargument, statt es optional zu machen

Die Signatur wird `signUp(email, fullName)`. Ein optionales Argument hätte zwei
Wege offen gelassen, von denen einer nie benutzt wird — und der Aufrufer könnte
weiterhin eines mitgeben, das dann niemand ersetzt.

### D3 — Der Erfolgsschirm ist ein Zustand der Einlöseseite, keine neue Route

Nach `activated` bleibt die Seite stehen und zeigt den Erfolg. **Die Abmeldung
läuft dabei sofort**, nur die **Weiterleitung** wartet auf Knopf oder Frist —
sonst hielte der Browser zehn Sekunden lang ein Token, das der Server längst
widerrufen hat. (Der erste Entwurf schrieb „Abmeldung und Weiterleitung
passieren danach" und widersprach sich damit selbst; Befund aus dem
Plan-Review.)

Die Verzweigung im Rumpf ist heute **zweiwertig**: `token && status !==
"activated"` wählt zwischen Passwortformular und „Link anfordern"-Zweig. Der
Erfolg ist ein **dritter** Fall und muss als solcher gebaut werden — sonst
bekommt das gerade aktivierte Mitglied ausgerechnet das Anfordern-Formular zu
sehen. Eine eigene Route bräuchte einen Weg, ihr
den Zweck und den Erfolg mitzuteilen, ohne dass sie direkt aufrufbar wird —
Fläche für einen Bildschirm, der eine Sekunde lang steht.

Die Weiterleitung läuft über einen sichtbaren Zähler (zehn Sekunden) **und**
einen Knopf. Der Knopf ist der eigentliche Weg; der Zähler fängt den ab, der
nichts drückt.

### D4 — Der Wortlaut kommt aus `TEXTE[zweck]`

Wer sein Passwort **zurückgesetzt** hat, wurde nicht „aktiviert". Der Zweck
steht der Seite schon zur Verfügung und trägt die anderen Texte bereits — der
neue reiht sich ein, statt einen Sonderfall zu bauen.

### D5 — Nachgelesen statt angenommen

Drei Dinge, auf denen dieser Entwurf steht, sind geprüft und nicht vermutet:

- **`LoginPage` ist der einzige Aufrufer von `signUp`** (Z. 63). Die
  Probe-Skripte rufen `supabase.auth.signUp` direkt und sind unbetroffen.
- **Es gibt keine Kompositionsregeln:** `password_requirements = ""` und
  `minimum_password_length = 10` (`config.toml:230,233`). Ein base64url-Wert aus
  32 Byte ist 43 Zeichen lang und erfüllt das ohne Groß-/Kleinschreibungs- oder
  Ziffernzwang.
- **Der Rückweg für ein unbestätigtes Konto** über `/passwort-vergessen` liefert
  `issued`, nicht `issued_reset` (`20260807200000:133-140`) — also einen
  Aktivierungslink. Er trägt, nur unter anderem Namen.

## Risks / Trade-offs

- **Ein Konto, dessen Passwort niemand kennt**, wenn die Mail nie geöffnet wird.
  → Zwei Wege zurück gibt es schon: der Knopf auf dem Aktivierungsbildschirm
  (Sitzung) und „Passwort vergessen" (AGE-505). Kein neuer Sackgassen-Zustand,
  sondern derselbe wie heute — nur ohne ein Passwort, das falsche Sicherheit
  vermittelt.
- **Der Zähler leitet weiter, während jemand liest.** → Zehn Sekunden sind lang
  genug für einen Satz, und der Knopf ist der schnellere Weg. Der Zielort ist
  der Login, kein zerstörerischer Schritt.
- **Die Registrierung wird „zu leicht".** Ohne Passwortfeld kostet ein Konto nur
  noch eine Adresse. → Das war schon so: Das Passwortfeld hat nie jemanden
  aufgehalten, es hat nur einen Wert erzeugt, den niemand braucht. Die Grenze
  ist die Stufe und das Gate, nicht das Formular (AGE-517 bleibt davon
  unberührt).

## Migration Plan

Keine Migration. Reiner Frontend-Change; Datenmodell, RPCs und Edge Functions
bleiben unverändert. Ausrollen über den normalen Deploy.

**Rückweg:** Frontend zurückrollen. Konten, die in der Zwischenzeit ohne
selbstgewähltes Passwort entstanden sind, bleiben gültig — sie gehen denselben
Weg über den Bestätigungslink wie importierte Mitglieder.

## Open Questions

Keine offen. Beide Entscheidungen kommen aus der Abnahme vom 2026-08-11.
