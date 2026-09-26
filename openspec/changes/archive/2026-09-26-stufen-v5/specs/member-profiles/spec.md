## MODIFIED Requirements

### Requirement: Full profile and extended data are gated by membership rank

The system SHALL restrict SELECT of a full `profiles` base-table row (including
`interests`, `competencies`, free-text `goals`, `headline`, `dev_focus`, and
other extended columns) to the profile's owner OR a caller with `level_rank >= 4`
(`discover` in the ladder introduced by AGE-903), via the policy
`profiles_select_self_or_discover` using `has_level(4)`. The extended sub-tables
`profile_theme_scores`, `profile_interests`, and `profile_badges` SHALL follow
the same threshold for SELECT (own profile OR `has_level(4)`), while
`profile_theme_scores` and `profile_interests` remain client-writable only for
the owner and `profile_badges` has no client write policy (awarded server-side).

**Die Zahl wanderte von 3 auf 4, weil die Leiter darunter wegrutschte.** Vor
AGE-903 war Rang 3 der Schlüssel `discover` und die unterste zahlende
Clubstufe; danach ist Rang 3 CONNECT und liegt ausserhalb des Clubs. Die Zusage
lautet unverändert „ab der untersten Clubstufe", nur trägt die jetzt die Zahl 4.
Der Policy-Name bleibt, weil er nach wie vor `discover` meint — nur eben den
`discover` der neuen Leiter.

Der Rang SHALL **zusätzlich** zur Aktivierung wirken, nicht an ihrer Stelle. Ein
nicht aktiviertes Konto SHALL keine dieser Zeilen erhalten — **auch nicht die
eigene**. Die Zusage „nur die eigene Zeile" gilt erst ab der Bestätigung; davor
ist auch die eigene Zeile verschlossen, weil ein übernommenes Konto gegenüber
der Datenbank das Mitglied ist.

Ebenso SHALL das Zielprofil bestätigt sein: eine Zeile SHALL für Dritte erst
erscheinen, wenn **ihr Inhaber** aktiviert hat. Das gilt für `profiles` und für
die drei genannten Untertabellen.

#### Scenario: Below Discover a member sees only their own full row

<!-- Titel zeichengleich. Der Rumpf nennt jetzt Rang statt Schlüssel: `basic`
     gibt es nicht mehr, und `connect` bezeichnet nach AGE-903 einen ANDEREN
     Rang als davor. Rangzahlen altern hier besser als Namen. -->

- **WHEN** a **bestätigtes** member below rank 4 (`active`, `boost`, `connect`)
  selects another member's full `profiles` row or their extended sub-tables
- **THEN** RLS returns no row for the other member (only the caller's own row is visible)

#### Scenario: Discover-and-above sees full rows and extended data

- **WHEN** a **bestätigtes** member with `level_rank >= 4` selects other members'
  `profiles` rows, `profile_theme_scores`, `profile_interests`, or
  `profile_badges`
- **THEN** those rows are returned, sofern deren Inhaber ebenfalls bestätigt haben

#### Scenario: Ohne Bestätigung ist auch die eigene Zeile verschlossen

- **GIVEN** ein angemeldetes Konto mit `tier = 'impact'` und leerem
  Aktivierungszeitpunkt
- **WHEN** es seine **eigene** `profiles`-Zeile oder seine eigenen
  `profile_interests` / `profile_theme_scores` abfragt
- **THEN** liefert RLS null Zeilen — der Rang trägt hier nichts, weil das Gate
  davor sitzt

#### Scenario: A member cannot self-award a badge

- **WHEN** an authenticated member attempts to INSERT into `profile_badges`
- **THEN** the write is denied (no client write policy; badges are awarded by service_role/admin)

#### Scenario: Rang 3 verliert den Zugang, den er vor AGE-903 hatte

- **GIVEN** ein bestätigtes Konto auf Rang 3
- **WHEN** es ein fremdes bestätigtes Vollprofil oder dessen
  `profile_interests` liest
- **THEN** kommt keine Zeile zurück — vor AGE-903 wäre sie gekommen, und genau
  das ist die beabsichtigte Verschiebung
