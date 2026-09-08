# Aufgaben

Reihenfolge ist Absicht: die Zusage, die die Fläche gegen die Datenbank
absichert (1.1), steht vor der, die sie sichtbar macht. Ein Menüeintrag, der zu
einem Dialog führt, der `22023` auslöst, wäre schlechter als kein Menüeintrag.

## 1 · Der Dialog

- [x] **1.1 RED** — `AdminMitgliederPage.test.tsx`: bei leerer Begründung ist
      das Bestätigen gesperrt und `setzeStufe` wird **nicht** gerufen. Die
      Zusage gegen `22023`, und die einzige, die ein Datum kaputt machen könnte.
- [x] **1.2 RED** — Der Dialog nennt das Mitglied **namentlich**, stellt alle
      sechs Stufen aus `LEVEL_ORDER` zur Wahl und benennt, was ein späterer
      Stripe-Kauf tut.
- [x] **1.3 RED** — Bestätigen ruft `setzeStufe(id, stufe, grund)` mit **genau**
      diesen drei Werten. Ohne diese Zusage wäre 1.1 auch grün, wenn der Dialog
      gar nichts ruft.
- [x] **1.4 GREEN** — Der Dialog. Eigenes Bauteil, **nicht** in
      `BRAUCHT_RUECKFRAGE`: dessen drei Fälle sind Ja/Nein, dieser hat zwei
      Eingaben (D1 im Proposal).

## 2 · Der Menüeintrag

- [x] **2.1 RED** — `aktionenFuer` führt „Stufe setzen" an **jeder** Zeile:
      bestätigt, unbestätigt, deaktiviert, gelöscht. Vier Fälle, weil die
      bestehenden Einträge sich genau hier unterscheiden.
- [x] **2.2 GREEN** — `Zeilenaktion` um `stufe` erweitern, Eintrag in
      `aktionenFuer`, Verteilung in `aktion()`.
- [x] **2.3 RED → GREEN** — Nach erfolgreichem Setzen zeigt dieselbe Zeile die
      **neue** Stufe. Der Cache-Schlüssel der Liste wird ungültig gemacht; ohne
      das bliebe das Abzeichen auf dem alten Wert stehen und der Admin hielte
      den Aufruf für gescheitert.

## 3 · Gegenproben

- [x] **3.1** Jede Zusage aus 1 und 2 durch eine Mutation belegen. Besonders
      1.1: rötet sie wirklich, wenn die Sperre fällt?
- [x] **3.2** `git diff --stat supabase/` ist **leer**. Keine Migration, keine
      neue RPC — das ist die Kernzusage dieses Changes.
- [x] **3.3** Die Karte „Stufe" auf `/admin/mitglied/:id` ist unberührt:
      `git diff --stat src/pages/AdminMitgliedPage.tsx` ist leer.
- [x] **3.4** Die bestehenden Zusagen an `aktionenFuer` und am Zeilenmenü laufen
      unverändert grün. Läuft eine nicht mehr, ist das ein Befund.

## 4 · Abnahme

- [x] **4.1** `openspec validate --all` grün.
- [x] **4.2** `pnpm lint` (Exit-Code), `pnpm typecheck`, `pnpm test`,
      `pnpm build`, `entry-chunk-guard`.
- [x] **4.3** Sichtprobe gegen den lokalen Stack: Menü öffnen, Stufe setzen,
      Abzeichen prüfen. Grüne Tests belegen keine Fläche.
- [x] **4.4** Code-Review auf dem **Diff**, nicht auf dem Plan.
- [x] **4.5** Archivieren, danach `pnpm release:entries`.

## Nicht in diesem Change

- Kein Fremdreviewer (2b). Stehende Regel: nur bei Schema, Rechten,
  Sicherheit — hier ändert sich keins davon. Bewusst ausgelassen (D3).
- Ob Detlevs Konto eine `staff_roles`-Zeile hält, ist eine Datenfrage. Ohne sie
  bricht `admin_set_tier` mit `42501` ab, und kein Menüeintrag hilft.
