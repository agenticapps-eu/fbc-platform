# Tasks — Entzüge nennen alle Rollen (AGE-622)

## 1. Belegen, dass es die Umgebung ist und nicht der Diff

- [x] CI auf PR #236 (reiner Frontend-Change, keine SQL-Zeile): `migrations`
      rot, vier Zusagen in der Form `have: true, want: false`.
- [x] **Gegenprobe:** `migrations` auf `main` neu gestartet, Commit `5d911b9`,
      **unveränderter Baum** — fällt ebenfalls. Damit ist es nicht der Diff.
- [x] Ursache benannt: `ci.yml:102` zog `version: latest`.

## 2. Die vier Zusagen den drei Objekten zuordnen

- [x] `grants_test.sql` 7 (`anon` darf genau sechs Funktionen) und 8
      (Gegenprobe A) → `resolve_display_name`.
- [x] `rls_test.sql` 261 → `staff_roles` / `service_role`.
- [x] `admin_member_list_test.sql` 73 → `member_state_matches` / `authenticated`.

## 3. Prüfen, ob etwas preisgegeben wird — messen, nicht hoffen

- [x] `resolve_display_name` ist `security invoker`, liest keine Tabelle,
      bekommt den Namen als Argument. `anon` erhält die Maske oder den selbst
      hineingereichten Namen. **Kein Abfluss.**
- [x] `member_state_matches` rechnet nur über seine Argumente. **Kein Abfluss.**
- [x] `staff_roles`: keine Fläche liest sie als `service_role` —
      `admin-change-email/index.ts:94` und `admin-set-member-ban/index.ts:36`
      halten beide fest, dass ein direktes `.from()` in „permission denied"
      liefe.

## 4. Prüfen, wen der Entzug sonst trifft

- [x] Alle drei Aufrufer von `member_state_matches` (`admin_list_members`
      zweimal, `admin_member_counts`) sind `security definer` und laufen als
      Eigentümer — nachgezählt. Kein Client-Recht nötig.
- [x] Golden-Snapshot unberührt: `grants_test.sql:37` filtert
      `grantee in ('anon','authenticated')`, die Spalten-Assertion nur
      `authenticated`. `service_role` kommt nirgends vor. Von beiden Reviewern
      unabhängig nachgemessen.

## 5. Plan-Review, zwei Fremdanbieter

- [x] `gemini` und `opencode`, beide REQUEST-CHANGES → `REVIEWS.md`.
- [x] **Der flächendeckende `service_role`-Entzug ist raus.** Beide fanden
      unabhängig `notify-contact-request/index.ts:91-111`: Client mit
      Service-Schlüssel, drei Tabellen direkt gelesen, als Sicherheitsprüfung
      vor dem Mailversand. → **AGE-623**.
- [x] `alter default privileges … from service_role` verschoben, gleiche
      Begründung, in AGE-623 notiert.
- [x] Befundtabelle korrigiert: bei beiden Funktionen rutscht auch
      `service_role` durch, nicht nur die Rolle, die eine Zusage gerade fängt.

## 6. Die falsche Grundannahme aufräumen

- [x] `explicit_grants.sql:35-36` sagt wörtlich „service_role bleibt
      unangetastet"; der Entzug in Abschnitt 1 lautet `from anon,
      authenticated`. Der „AGE-312-Lockdown" für `service_role` wurde **nie
      ausgesprochen**.
- [x] `rls_test.sql:1862` entschärft: der Kommentar behauptete einen Grundsatz,
      den er an einer einzigen Tabelle misst, und dessen zweite Hälfte falsch
      ist.

## 7. Umsetzen

- [x] Migration `20260827070000_entzuege_nennen_alle_rollen.sql`: drei Entzüge
      über `public, anon, authenticated, service_role`, danach die zwei
      gebrauchten Rechte zurück.
- [x] `ci.yml` auf **feste Nummer** `2.116.0` gepinnt, auf die **neue** Sorte —
      die, die PROD gleicht. Mit Warnung im Kommentar, dass ein Anheben die
      Rechte-Grundlage anhebt und gegen eine FRISCHE Abbildung zu prüfen ist.

## 8. RED vor GREEN — lokal nicht durch Zuschauen zu bekommen

Lokal sind alle Zusagen grün, weil dieser Stack Rechte nur über `public`
vergibt. Der Fehlerzustand wurde deshalb **hergestellt**, in einer Transaktion,
die zurückgerollt wurde:

- [x] ROT: rollen-eigene Grants gesetzt →
      `resolve_display_name anon=true service_role=true`,
      `member_state_matches authenticated=true`,
      `staff_roles service_role=true`.
- [x] GRÜN: genau die Anweisungen der Migration →
      alle vier `false`, **und** `authenticated` behält
      `resolve_display_name=true` sowie `staff_roles=true`.
- [x] Migration lokal angewandt, volle CI-Liste gefahren:
      **11 Dateien, 763 Tests, PASS.**

## 9. Was diese Prüfung NICHT belegt

- [x] Ausgesprochen: ein grüner lokaler Lauf sagt über PROD nichts. Der Beleg
      für die Instanz-Sorte von PROD stammt aus AGE-602, gemessen am
      PROD-Katalog: `proacl` mit eigenem Grant für `anon`, `authenticated`
      **und** `service_role`. Der echte Beleg für diesen Change ist der grüne
      CI-Lauf auf der gepinnten, frischen Abbildung.

## 10. Nachtrag — die Gegenprobe war selbst der Fehler

Der erste CI-Lauf auf diesem Branch brachte die vier Fehler auf **einen**
herunter. Uebrig blieb `grants_test.sql` Test 8, „Gegenprobe A".

- [x] Ursache: die Gegenprobe entzog `from public` — und behauptete damit, genau
      die Form wirke, die AGE-602 im Kopf seiner eigenen Migration als
      unzureichend beschreibt. Lokal ging das durch, weil `anon` dort kein
      eigenes Recht haelt.
- [x] Repariert: `revoke ... from public, anon`.
- [x] **Gegenprobe C** ergaenzt: stellt den rollen-eigenen Grant selbst her und
      zeigt, dass `from public` ihn NICHT mitnimmt. Instanz-unabhaengig, faellt
      also auch lokal, wenn jemand die Form wieder aufweicht. `plan(14)` -> `plan(15)`.
- [x] Lokal gruen: `grants_test.sql` PASS mit 15 Zusagen.
