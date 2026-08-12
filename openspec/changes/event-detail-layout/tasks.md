# Tasks — Detailseite nach Mockup (Nachzug zu AGE-531)

Reine Oberfläche. **Keine Migration, keine Policy, keine RPC** — alles, was
gezeigt wird, liegt schon in der Datenbank. Deshalb auch kein pgTAP-Block:
es gibt nichts Neues zu sichern.

**Der Plan-Review (Schritt 2b) entfällt hier bewusst.** Er ist dafür da, eine
falsch gedachte Anforderung zu finden, bevor Code entsteht — bei einer
Umgruppierung bestehender Blöcke ohne Sicherheitsfläche ist der Ertrag gering,
und Donald wartet darauf, das Ergebnis zu sehen. Das Diff-Review nach dem Bau
bleibt. Das ist eine Abwägung, keine Auslassung: sie steht hier, damit sie
sichtbar ist.

Die Sichtprobe ist bei diesem Change **die eigentliche Prüfung**, nicht die
Nachbereitung — der Rückstand, den er behebt, war für jeden Test unsichtbar.

## 1 · Datenschicht

- [ ] 1.1 **RED**: Test, dass die Veranstalter-Karte Rolle, Firma und Kurzbio
      zeigt, und dass ohne diese Felder keine leeren Zeilen entstehen.
- [ ] 1.2 `EventHost` um `company`, `roles`, `shortBio` erweitern (alle
      nullable). `hostsFor` wählt die drei Spalten zusätzlich aus
      `profiles_public` — dieselbe Abfrage, drei Felder mehr, kein neuer Weg.
- [ ] 1.3 Der Partner-Zweig bleibt: `partners.description` füllt `shortBio`,
      `company` und `roles` bleiben null. `host_partner_id` wird **nicht**
      ausgebaut (Entscheidung aus C8).

## 2 · Layout

Datei: `src/pages/EventDetailPage.tsx`

- [ ] 2.1 **Hero-Karte**: Titelbild, Typ-Marke, Titel, „Veranstaltet von" mit
      Namenszeile — und rechts das Anmelde-Feld. Auf schmalen Fenstern stapelt
      es unter den Titel.
- [ ] 2.2 **Dreierreihe**: „Details" · „Themen" · „Veranstalter". Fehlt ein
      Block (keine Themen, kein Host ohne Session), rücken die übrigen auf,
      statt eine Lücke zu lassen.
- [ ] 2.3 **Details**: Datum, Uhrzeit, Ort, **Sichtbarkeit als Satz**
      („Offen für alle Mitglieder" / „Nur für Mitglieder").
- [ ] 2.4 **Themen** mit „Änderungen vorbehalten." darunter.
- [ ] 2.5 **Veranstalter-Karte**: Bild, Name, Rolle · Firma, Kurzbio,
      „Profil ansehen". Leere Felder entfallen ganz.
- [ ] 2.6 **Beschreibung neben Teilnehmer** (zwei Drittel / ein Drittel).
- [ ] 2.7 **Brotkrume** „Events › Titel" statt „← Zu allen Events".
- [ ] 2.8 „Alle Events anzeigen →" neben „Ähnliche Events".
- [ ] 2.9 `HostTools` unverändert lassen — nur die Position ändert sich.

## 3 · Belegen

- [ ] 3.1 **GREEN**: die Tests aus 1.1 plus je einer für die
      Sichtbarkeits-Zeile und den Link zur Liste.
- [ ] 3.2 **Mutationsprobe** an den neuen Tests: einen von ihnen durch eine
      gezielte Änderung rot machen und wieder herstellen. Ein Test, der beim
      ersten Lauf grün ist, hat nichts belegt.
- [ ] 3.3 Alle bestehenden Szenarien der Anforderung laufen weiter — besonders
      „ohne Session kein Host und keine Teilnehmer" und „die Zahl kann größer
      sein als die Gesichter".
- [ ] 3.4 `pnpm lint && pnpm typecheck && pnpm test && pnpm build` grün.
      **`pnpm format` NICHT** — nur `prettier --write` auf die eigenen Pfade.
- [ ] 3.5 **Sichtprobe**, breit und auf dem Telefon, neben dem Mockup:
      `docs/mockups/event-detail-2026-07-29.png`. Screenshots an Donald.
- [ ] 3.6 Diff-Review (Schritt 4) durch einen anderen Anbieter.

## 4 · Abschluss

- [ ] 4.1 Commit mit `(AGE-531)`, PR gegen `main`, Checks auf der HEAD-SHA.
- [ ] 4.2 `openspec archive` — **Szenario-Titel im MODIFIED-Block exakt wie im
      Bestand**, sonst löscht das Archivieren die alten Szenarien.
