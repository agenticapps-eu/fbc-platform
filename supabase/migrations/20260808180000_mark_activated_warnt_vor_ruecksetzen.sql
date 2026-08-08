-- Die Bedingung des abgeleiteten Zwecks steht jetzt dort, wo sie brechen wuerde
-- (AGE-505) — Befund 8.6 aus Review 5.4.
--
-- ── Der Befund ─────────────────────────────────────────────────────────────
-- Seit AGE-505 speichert `issue_activation_token` den Zweck eines Tokens NICHT,
-- sondern leitet ihn ab: `profiles.activated_at is not null` heisst „Reset",
-- sonst „Aktivierung" (20260807200000). Das ist der Kern des Entwurfs und
-- bewusst so gewaehlt — ein gespeicherter Zweck koennte vom Kontostand
-- abweichen, ein abgeleiteter nie.
--
-- Er traegt aber nur unter einer Bedingung: `activated_at` hat GENAU EINEN
-- Schreiber, naemlich `mark_activated`, und der setzt per `coalesce` nur, was
-- noch nicht steht. Eine Deaktivierung gibt es heute nicht. Wer je eine
-- Sperrfunktion baut, die `activated_at` auf null zuruecksetzt, macht jedes
-- ausstehende Reset-Token zum Re-Aktivierer: dieselbe Mail, derselbe Link,
-- andere Wirkung.
--
-- ── Warum das eine eigene Migration ist ────────────────────────────────────
-- Die Bedingung stand nur im KOPF von 20260807200000 — also in der Migration,
-- die den Reset einfuehrt, und damit an der Stelle, an der niemand nachsieht,
-- der Monate spaeter eine Sperrfunktion schreibt. Wer `activated_at` anfasst,
-- sieht `mark_activated`. Dort gehoert die Warnung hin.
--
-- Verworfen: den Kommentar in 20260806080200 selbst ergaenzen. Die Migration
-- ist auf beiden Projekten laengst angewandt; eine nachtraegliche Aenderung
-- ihres Inhalts wirkt nirgends und laesst Datei und Datenbank auseinanderlaufen.
--
-- Verworfen: eine Regel, die das Zuruecksetzen technisch verhindert (Trigger,
-- Check). Sie wuerde eine Sperrfunktion verbieten, die es geben darf — nur eben
-- nicht, ohne den Zweck vorher zu speichern. Die Entscheidung gehoert dem, der
-- sie baut; was fehlte, war die Information.
--
-- Die Function selbst bleibt unveraendert — nur ihr Kommentar waechst. Der
-- pgTAP-Test in rls_test.sql nagelt ihn fest (`obj_description`), damit die
-- Warnung nicht bei der naechsten Neudeklaration wortlos verschwindet.
--
-- Donald / Claude, 2026-08-08.

comment on function public.mark_activated(uuid) is
  'Setzt profiles.activated_at (AGE-495). Idempotent: ein zweiter Aufruf '
  'ueberschreibt den Zeitpunkt nicht. Der LETZTE Schritt der Einloesung — er '
  'oeffnet das Gate, deshalb steht er hinter Passwort und Sitzungswiderruf. '
  'Nur service_role; kein Client darf sich selbst aktivieren. '
  'WARNUNG (AGE-505, Befund 8.6): activated_at hat GENAU EINEN Schreiber, und '
  'issue_activation_token leitet den Zweck eines Tokens daraus ab — steht ein '
  'Zeitpunkt, ist das naechste Token ein Passwort-Reset, sonst eine '
  'Aktivierung. Wer eine Sperr- oder Deaktivierungsfunktion baut, die '
  'activated_at auf null zuruecksetzt, macht damit jedes ausstehende '
  'Reset-Token zum Re-Aktivierer. Dann muss der Zweck gespeichert werden, '
  'statt abgeleitet zu werden.';
