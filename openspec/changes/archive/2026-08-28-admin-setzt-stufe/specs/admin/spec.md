# admin (Delta)

## ADDED Requirements

### Requirement: Ein Admin setzt die Stufe eines Mitglieds in beide Richtungen

Das System SHALL eine `SECURITY DEFINER`-Funktion
`admin_set_tier(p_profile_id uuid, p_tier text, p_grund text)` mit
`set search_path = ''` führen, die in ihrem Rumpf `is_admin()` prüft und
andernfalls mit `42501` abbricht.

Sie SHALL die Stufe **anheben und senken** können. Das unterscheidet sie von
`apply_upgrade()`, die ausschliesslich anhebt und jede Gleich- oder
Tieferstufung als No-op behandelt — ein irrtümlich zu hoch importiertes
Mitglied ist über jenen Weg nicht korrigierbar.

Sie SHALL eine **Begründung verlangen** und bei leerer Begründung mit `22023`
abbrechen. Eine Spur ohne Grund beantwortet „wer" und „wann", aber nicht
„warum".

Jede erfolgreiche Änderung SHALL eine Zeile in `public.admin_audit` schreiben,
die die **alte und die neue** Stufe sowie die Begründung trägt. Nur die neue zu
speichern machte die Spur unlesbar, sobald zwei Änderungen aufeinanderfolgen.

Eine unbekannte Stufe SHALL mit `22023` abbrechen, ein unbekanntes Profil mit
`P0002`.

Die Fläche SHALL benennen, was ein späterer Stripe-Kauf mit der gesetzten Stufe
tut: ein Kauf einer **höheren** Stufe überschreibt sie, ein Kauf einer
niedrigeren nicht.

#### Scenario: Ein Nicht-Admin kommt nicht durch

- **WHEN** ein Mitglied ohne Admin-Rolle `admin_set_tier` aufruft
- **THEN** bricht der Aufruf mit `42501` ab, und die Stufe des Zielprofils ist
  unverändert

#### Scenario: Ein Admin senkt eine Stufe

- **WHEN** ein Admin ein Mitglied von `impact` auf `connect` setzt
- **THEN** trägt das Profil danach `connect` — anders als über `apply_upgrade`,
  die diesen Aufruf als No-op behandelte

#### Scenario: Die Spur nennt beide Stufen und den Grund

- **WHEN** ein Admin eine Stufe ändert
- **THEN** steht in `admin_audit` eine Zeile mit dem Aufrufer, dem Zielprofil,
  der alten Stufe, der neuen Stufe und der Begründung

#### Scenario: Ohne Begründung geschieht nichts

- **WHEN** ein Admin die Stufe ohne Begründung ändern will
- **THEN** bricht der Aufruf mit `22023` ab, und weder Stufe noch Spur ändern
  sich

#### Scenario: Eine unbekannte Stufe wird abgewiesen

- **WHEN** ein Admin eine Stufe setzt, die `membership_tiers` nicht kennt
- **THEN** bricht der Aufruf mit `22023` ab
