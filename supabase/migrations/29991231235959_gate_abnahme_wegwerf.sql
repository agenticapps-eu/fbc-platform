-- WEGWERF — Abnahme des Drift-Gates (AGE-496 Task 16.2), 2026-08-05.
--
-- Diese Migration wird ABSICHTLICH auf main gemergt und NICHT auf PROD
-- angewendet. Erwartung: `drift-gate` wird rot und verhindert `deploy`.
-- Sie wird unmittelbar danach per revert zurueckgenommen.
--
-- Sie veraendert nichts. `select 1` ist ein No-op; selbst wenn sie
-- versehentlich angewendet wuerde, bliebe das Schema unberuehrt — nur der
-- Eintrag in der Migrationshistorie muesste dann von Hand raus.
select 1;
