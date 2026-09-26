## ADDED Requirements

### Requirement: Kontaktanfragen hängen allein an der Absenderstufe

Das System SHALL die Erlaubnis, eine Kontaktanfrage einzufügen, **allein** aus
der Stufe des Absenders ableiten: ein Absender ab **Rang 4** (`discover` nach
AGE-903) SHALL an jeden Empfänger senden dürfen, ein Absender darunter an
niemanden. Die Stufe des **Empfängers** SHALL keine Rolle mehr spielen.

Die Regel SHALL in einem benannten Prädikat stehen, nicht als Bedingungskette
in der Policy. Es SHALL `SECURITY DEFINER` mit leerem `search_path` bleiben und
`execute` nur für `authenticated` tragen — auch wenn es die Empfängerzeile
nicht mehr liest. Der Grund ist nicht mehr der Lesezugriff, sondern die
Einheitlichkeit mit `is_contactable(uuid)`: zwei benachbarte Prädikate
derselben Policy mit verschiedenen Rechten sind eine Einladung, beim nächsten
Mal das falsche zu kopieren.

**Warum die Staffelung ersatzlos entfällt.** Sie war die Antwort auf eine
Leiter, auf der Rang 2 und Rang 3 beide im Club lagen und unterschiedlich viel
durften. Nach AGE-903 liegt alles unterhalb Rang 4 ausserhalb des Clubs, und
„wer nicht im Club ist, schreibt keine Mitglieder an" braucht keine Staffelung,
sondern eine Zahl. Die am 25.08.2026 entschiedene Auslegung („`connect` nur an
genau `connect`") wird damit gegenstandslos, nicht überstimmt.

Der Admin-Schalter `platform_settings.open_contact` SHALL diese Schwelle — und
nur sie — aufheben können, solange er `true` ist. Nur `is_admin()`-Mitglieder
SHALL den Schalter schreiben dürfen.

**Der Schalter steht auf PROD auf `true` und bleibt es.** Damit darf faktisch
jedes aktivierte Konto senden, auch unterhalb Rang 4 — die Schwelle in dieser
Anforderung ist der **Rückfallwert**, nicht der Ist-Zustand. Wer über
Kontaktanfrage-Rechte eine Aussage trifft, SHALL zuerst
`platform_settings.open_contact` lesen und darf sie nicht aus dem Policy-Text
ableiten. Das Umlegen des Schalters ist AGE-930 vorbehalten.

Unabhängig vom Schalter und in **jedem** Modus SHALL weiterhin gelten: der
Absender SHALL sich selbst als `from_id` eintragen, der Status SHALL `pending`
sein, ein mitgegebenes `match_id` SHALL dem Paar gehören, und das Opt-out des
Empfängers (`is_contactable`) SHALL greifen.

#### Scenario: Unterhalb des Clubs darf niemand senden

- **WHEN** `open_contact` false ist und ein Mitglied auf Rang 1, 2 oder 3 eine
  Anfrage an einen kontaktierbaren Empfänger einfügt
- **THEN** wird das INSERT abgelehnt (SQLSTATE 42501), und die Oberfläche nennt
  die Stufe als Grund statt den rohen Postgres-Fehler zu zeigen

#### Scenario: Ab Rang 4 ist jeder Empfänger erreichbar

- **WHEN** `open_contact` false ist und ein Mitglied ab Rang 4 an einen
  Empfänger beliebiger Stufe sendet
- **THEN** lässt die Policy das INSERT zu

#### Scenario: Die Empfängerstufe ändert nichts mehr

- **WHEN** `open_contact` false ist und ein Mitglied ab Rang 4 nacheinander an
  einen Empfänger auf Rang 1 und an einen auf Rang 6 sendet
- **THEN** werden **beide** INSERTs zugelassen — vor AGE-903 hing das Ergebnis
  von der Empfängerstufe ab

#### Scenario: Der Schalter hebt die Schwelle auf

- **WHEN** `open_contact` true ist und ein Mitglied auf Rang 1 an einen
  kontaktierbaren Empfänger sendet
- **THEN** lässt die Stufenklausel das INSERT zu

#### Scenario: Der Schalter hebt die übrigen Prüfungen nicht auf

- **WHEN** `open_contact` true ist und ein Mitglied eine Anfrage mit fremdem
  `from_id`, mit Status `accepted` oder an ein Konto mit gesetztem Opt-out
  einfügt
- **THEN** wird das INSERT abgelehnt

#### Scenario: Nur Admins schreiben den Schalter

- **WHEN** ein Mitglied ohne `is_admin()` `platform_settings.open_contact`
  aktualisiert
- **THEN** verweigert die Policy `platform_settings_update_admin` den Schreibzugriff

## REMOVED Requirements

### Requirement: Kontaktanfragen sind nach Absender- und Empfängerstufe gestaffelt

**Reason**: Die Anforderung leitete die Erlaubnis aus **beiden** Stufen ab und
sagte das in ihrem Titel zu. AGE-903 streicht die Empfängerseite ersatzlos:
unterhalb Rang 4 gar keine Anfragen, ab Rang 4 an jeden. Damit ist die Zusage
nicht verschoben, sondern gegenstandslos — sie beschrieb ein Verhältnis
zwischen zwei Stufen, von denen nur noch eine zählt. Ein Titel, der
„Empfängerstufe" sagt, dürfte nach der Änderung nicht stehen bleiben, und eine
`MODIFIED`-Anforderung darf ihren Titel nicht wechseln.

**Migration**: Die Nachfolgerin ist „Kontaktanfragen hängen allein an der
Absenderstufe" in derselben Capability. Sie übernimmt unverändert: das benannte
`SECURITY DEFINER`-Prädikat, den Schalter `open_contact` samt seiner Grenze
(er hebt **nur** die Stufenklausel auf), und die vier Prüfungen, die in jedem
Modus gelten. Es entfallen ausschliesslich die Rang-2-Sonderregel und die
Abhängigkeit von der Empfängerstufe.
