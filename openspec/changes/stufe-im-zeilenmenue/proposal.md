# Stufe setzen im Zeilenmenü der Admin-Mitgliederliste

Linear: AGE-707

## Warum

Detlev nimmt ein neues Mitglied auf und schickt ihm über `/admin/mitglieder`
einen Zugangslink. Das Konto steht danach auf `basic`. Um es auf `impact` zu
setzen, muss er die Liste verlassen: auf den Namen klicken, auf
`/admin/mitglied/:id` nach unten scrollen, dort die Karte „Stufe“.

**Die Fähigkeit fehlt nicht — ihr Weg fehlt.** `admin_set_tier` ist seit AGE-634
gebaut und liegt seit dem `Migrate PROD` vom 28.08. auf PROD. Das Zeilenmenü der
Liste führt heute sechs Aktionen und kennt sie nicht:

```
Zugangslink schicken · Direkt aktivieren · Deaktivieren
Reaktivieren · Löschen · Wiederherstellen
```

Der Reiter **Mitgliedschaft** derselben Fläche **zeigt** die Stufe je Zeile als
Abzeichen (`TierBadge`, `AdminMitgliederPage.tsx:724`) — in der Sichtprobe
nachgesehen, die Tabelle unter „Alle" trägt die Spalte nicht. Eine Fläche, die
einen Wert anzeigt und für seine Änderung auf einen nicht erkennbaren Umweg
verweist, ist genau die Sorte Sackgasse, gegen die AGE-592 schon einmal gebaut
wurde.

## Was sich ändert

Ein siebter Eintrag **„Stufe setzen“** im Zeilenmenü, mit einem Dialog: Stufe
wählen, Begründung eingeben, bestätigen. Danach steht die neue Stufe am
Abzeichen derselben Zeile.

Dieselbe RPC. **Keine Migration, keine neue Funktion, kein neuer Schreibweg.**

## Was sich NICHT ändert

- Die Karte „Stufe“ auf `/admin/mitglied/:id` bleibt unverändert. Zwei Wege zu
  einem Vorgang sind hier richtig: der eine in der Liste, wo die Stufe sichtbar
  ist, der andere in der Einzelbearbeitung, wo sie neben den Altdaten steht.
- `admin_set_tier`, `admin_audit`, `apply_upgrade`, `profiles` — unberührt.
- Das fehlende Downgrade an `paid_until` (`profile_legacy`) bleibt offen und ist
  ausdrücklich nicht Gegenstand.

## Entscheidungen

**D1 — Ein eigener Dialog, nicht `BRAUCHT_RUECKFRAGE`.** Die drei bestehenden
Rückfragen sind Ja/Nein über etwas, das jemandem etwas nimmt. Diese Aktion
braucht **zwei Eingaben**. Sie in denselben Verteiler zu pressen hiesse, den
Rückfragedialog um Formularfelder zu erweitern, die drei Vierteln seiner
Benutzer nichts sagen.

**D2 — Die Begründung ist Pflichtfeld, und der Knopf bleibt gesperrt.** Die
Datenbank weist einen leeren Grund mit `22023` ab. Eine Fläche, die den Aufruf
trotzdem absetzt, zeigt dem Admin einen rohen Datenbankfehler, nachdem er
bestätigt hat. **Die Fläche darf nicht mehr durchlassen als die Datenbank** —
dieselbe Regel, nach der `aktionenFuer` schon heute gebaut ist.

**D3 — Kein Fremdreviewer (2b entfällt).** Stehende Regel: Fremdreviewer bei
Schema, Rechten und Sicherheit. Hier ändert sich nichts davon — der Rechteweg
ist `is_admin()` im Rumpf der bestehenden RPC und bleibt zeichengleich. Bewusst
ausgelassen, nicht vergessen.

**D4 — Auch an einer gesperrten Zeile.** Anders als „Zugangslink schicken“ und
„Direkt aktivieren“ hängt das Setzen einer Stufe nicht daran, ob das Konto sich
anmelden kann. `admin_set_tier` kennt keinen solchen Vorbehalt, und eine Fläche,
die hier enger wäre als die Funktion, machte ein deaktiviertes Mitglied
unkorrigierbar — genau der Importfehler-Fall, für den AGE-634 gebaut wurde.

**D5 — Der scheinbare Widerspruch zum Reiter „Mitgliedschaft", aufgelöst.** Die
geltende Anforderung sagt dort: „die Stufe SHALL hier nur lesbar sein", weil ein
Stufenwechsel „nebenbei in einer Tabellenzeile" die folgenreichste und zugleich
unauffälligste Änderung der Fläche wäre. Das Zeilenmenü steht auf **derselben**
Fläche — in der Sichtprobe gesehen, nicht aus dem Code geschlossen.

Aufgelöst wird das nicht durch Aufweichen, sondern durch die Unterscheidung, die
in der Anforderung schon steckt: **das Verbot gilt der beiläufigen Änderung, nicht
der Erreichbarkeit.** In der Zeile bleibt die Stufe eine Anzeige. Über das Menü
ist sie erreichbar, und zwar auf dem Gegenteil eines beiläufigen Weges — eigener
Dialog, namentliche Nennung, Pflichtbegründung, Protokollzeile. Das Delta schreibt
diese Unterscheidung aus, statt sie stillschweigend zu unterlaufen.

## Verworfene Alternative

**Die Stufe direkt am Abzeichen in der Zeile ändern** (Klick auf das Abzeichen
öffnet ein Auswahlfeld). Verworfen: es gäbe keinen Ort für die Pflichtbegründung
ohne ein zweites Overlay, und ein Abzeichen, das wie eine Anzeige aussieht und
sich wie ein Bedienelement verhält, ist an einer Liste mit sechs echten Aktionen
eine Falle.

## Risiko

Der Dialog setzt einen Aufruf ab, den die Datenbank ablehnt. Dagegen steht die
Zusage aus D2 und der rote Test, der sie zuerst festhält.
