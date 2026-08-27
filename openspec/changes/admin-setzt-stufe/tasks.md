# Tasks

## 1. Die Funktion

- [x] 1.1 Migration mit `admin_set_tier(uuid, text, text)`, `security definer`,
      `set search_path = ''`, `is_admin()` im Rumpf (sonst `42501`).
- [x] 1.2 Unbekannte Stufe → `22023`; unbekanntes Profil → `P0002`;
      leere Begründung → `22023`.
- [x] 1.3 Schreibt `admin_audit` mit `action = 'set_tier'` und
      `payload = {von, nach, grund}`.
- [x] 1.4 Grants ausgesprochen, nicht geerbt (AGE-312): `revoke` von public/anon,
      `grant execute` an `authenticated`.
- [x] 1.5 Kommentar an `apply_upgrade` nachziehen.

## 2. pgTAP

- [x] 2.1 Ein Nicht-Admin bekommt `42501` — und die Stufe steht danach unverändert.
- [x] 2.2 Ein Admin hebt an; ein Admin **senkt** (das kann `apply_upgrade` nicht).
- [x] 2.3 Die Spur entsteht, mit alter und neuer Stufe.
- [x] 2.4 Leere Begründung bricht ab.

## 3. Die Fläche

- [x] 3.1 Auswahl der Stufe plus Begründungsfeld in der Einzelbearbeitung.
- [x] 3.2 Sie benennt, was Stripe später tut: ein Kauf einer HÖHEREN Stufe
      überschreibt; ein Kauf einer niedrigeren nicht.
- [x] 3.3 Test: ohne Begründung ist der Knopf nicht auslösbar.
