# Ein Admin setzt die Stufe eines einzelnen Mitglieds

Linear: **AGE-634**

## Why

Es gibt heute keinen Weg, ein Mitglied von Hand auf eine Stufe zu setzen.
`tier` steht ausdrücklich auf der **Ausschluss**liste von
`admin_update_profile` (`20260811090300_admin_profile_functions.sql:151`) — ein
Patch mit `tier` bricht mit `22023` ab. Editierbar sind nur `legacy_tier` und
`paid_until`, also die WordPress-Altdaten, nicht die wirksame Stufe.

Die wirksame Stufe schreibt ausschliesslich `apply_upgrade()`, aufgerufen vom
Stripe-Webhook. Wer ausserhalb von Stripe bezahlt — Überweisung, Tausch,
Kulanz, oder schlicht die Korrektur eines Importfehlers — ist damit nicht zu
bedienen. Donald am 27.08.:

> „gib mir die Möglichkeit im Admin-Bereich, einzelne Mitglieder auf einen Plan
> zu setzen"

**Und `apply_upgrade` hebt nur an.** Ein Downgrade gibt es in dieser Anwendung
überhaupt nicht: `if v_target_rank > v_current_rank` — alles andere ist ein
No-op mit Rückgabe des Ist-Zustands. Ein Mitglied, das im Import irrtümlich auf
`impact` landete, bleibt dort, bis jemand die Zeile von Hand in der Datenbank
ändert.

## What Changes

- Eine neue `SECURITY DEFINER`-RPC `admin_set_tier(p_profile_id, p_tier,
  p_grund)`, die `is_admin()` im Rumpf prüft und **in beide Richtungen** setzt.
- Jede Änderung schreibt eine Zeile nach `public.admin_audit` — mit alter
  Stufe, neuer Stufe und Begründung. Ohne sie ist eine Stufe, die nicht aus
  Stripe stammt, später nicht erklärbar.
- Eine Begründung ist **Pflicht**. Eine Spur ohne Grund beantwortet „wer und
  wann", aber nicht „warum" — und genau das ist die Frage, die man drei Monate
  später stellt.
- Die Fläche sitzt in der Einzelbearbeitung eines Mitglieds und benennt, was
  Stripe später damit tut.
- Der Kommentar an `apply_upgrade` wird nachgezogen: „der einzige Schreibweg
  für den Tier" stimmt danach nicht mehr.

## Verworfen

**Die Weissliste von `admin_update_profile` um `tier` erweitern.** Das Setzen
einer Stufe ist kein Pflegen von Stammdaten: es verschiebt Rechte, es hat eine
Gegenpartei (Stripe), und es braucht eine Begründung, die kein anderes Feld
dieser Funktion kennt. Eine gemeinsame Funktion machte den Ausnahmefall zur
Regel und die Spur zu einem Patch-Feld unter anderen.

## Impact

- `openspec/specs/admin/spec.md` — eine neue Anforderung.
- Neue Migration; **keine neue Tabelle** — `admin_audit` besteht seit AGE-498,
  der Golden-Snapshot der Grants bleibt damit unberührt.
- `src/pages/AdminMitgliedPage.tsx`, `src/lib/admin-profile.ts`.
