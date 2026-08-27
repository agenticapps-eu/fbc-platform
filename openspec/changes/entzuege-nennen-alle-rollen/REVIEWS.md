# Plan-Review — entzuege-nennen-alle-rollen (AGE-622)

Zwei Reviewer, beide **anderer Anbieter** als der Autor des Deltas (Claude).
Beide **REQUEST-CHANGES**. Der Plan wurde daraufhin verkleinert, bevor eine
Zeile Code existierte.

| Reviewer | Modell (selbstgemeldet) | Verdikt |
| --- | --- | --- |
| `gemini` | gemini-pro | REQUEST-CHANGES |
| `opencode` | hf:moonshotai/Kimi-K3 | REQUEST-CHANGES |

`codex` wurde nicht befragt: es prüft nicht selbst, sondern startet
Unter-Reviewer und liefert deren Antwort unter seinem Namen — einmal sogar
`claude`, den Anbieter des Autors.

## Der Befund, der den Plan gedreht hat

**Beide** fanden unabhängig dieselbe Stelle, und die eigene Messung hatte sie
kurz zuvor ebenfalls: `supabase/functions/notify-contact-request/index.ts:91-111`
baut seinen Client mit `SUPABASE_SERVICE_ROLE_KEY` und liest damit direkt
`profile_contacts`, `profiles` und `contact_requests`.

Der erste Entwurf wollte `service_role` **flächendeckend** die Tabellenrechte in
`public` entziehen. Das hätte diese Function gebrochen — und mit ihr die
Kontaktanfrage-Mail, wenige Tage vor dem Go-Live.

**Übernommen:** Der flächendeckende Entzug und die verallgemeinerte Zusage sind
aus dem Change entfernt. Sie hängen an einer PROD-Messung und am Umbau der
Function auf `DEFINER`-RPCs. Beides ist jetzt **AGE-623**.

## Der Befund, der eine Grundannahme widerlegt hat

`opencode` allein: `20260715140000_explicit_grants.sql:35-36` sagt wörtlich
*„service_role bleibt unangetastet: es umgeht RLS per Definition und traegt die
Edge Functions"*, und der Entzug in Abschnitt 1 lautet `revoke all on all tables
in schema public from anon, authenticated` — **ohne `service_role`**.

Nachgemessen: stimmt beides.

Damit ist der „AGE-312-Lockdown", auf den sich `rls_test.sql:1866` beruft, für
`service_role` **nie ausgesprochen worden**. Er gilt nur dort zufällig, wo die
Instanz von sich aus nichts vergibt — wie auf dem lokalen Stack (0 von 36
Tabellen). Auf einem gehosteten Projekt vergibt der Standard-Bootstrap
`service_role` Rechte, und genau darauf steht `notify-contact-request` heute.

**Folge für die Lagebeschreibung:** die Vermutung im ersten Entwurf, PROD sei
die *strenge* Sorte und der Entzug dort folgenlos, ist damit eher widerlegt als
gestützt. Der `staff_roles`-Entzug ist auf PROD **kein No-op**, sondern eine
echte Änderung. Er bleibt trotzdem drin, weil beide Admin-Functions ausdrücklich
festhalten, dass sie diese Tabelle NICHT direkt lesen — aber der Vorschlag sagt
das jetzt so, statt „schreibt fest, was ohnehin gilt".

## Weiter übernommen

1. **Die eigene Befundtabelle wandte die eigene Regel zu eng an** (`opencode`).
   Bei `resolve_display_name` rutscht nicht nur `anon` durch, sondern auch
   `service_role`; bei `member_state_matches` `authenticated` **und**
   `service_role`. Die Entzüge nennen jetzt alle vier Rollen.

2. **Drei der neuen Szenarien können auf dem alten lokalen Stack gar nicht rot
   werden** (`opencode`, ausführlich; `gemini` hält dagegen, sie seien trotzdem
   wertvoll). Beide haben recht: sie sind wertvoll *und* vakuum-grün. Der Biss
   kommt einzig vom CLI-Pin. Das steht jetzt im Delta, statt implizit zu bleiben.

3. **Die Vierer-Menge der Zusagen war unbelegt** (`opencode`: „nicht widerlegt,
   aber unbelegt"). Nachgetragen aus dem CI-Log: `grants_test.sql` 7 und 8,
   `rls_test.sql` 261, `admin_member_list_test.sql` 73.

4. **Konkrete Versionsnummer pinnen**, nicht „die letzte neue" (`opencode`).
   Übernommen.

## Nicht übernommen, mit Begründung

- **`alter default privileges … revoke on tables from service_role`**
  (`opencode` Punkt 2). Richtig gesehen — ohne das erbt die nächste neue Tabelle
  auf neuen Instanzen wieder. Gehört aber zur selben Frage wie der
  flächendeckende Entzug: solange `notify-contact-request` auf
  `service_role`-Tabellenrechten steht, ist jede Verengung in dieser Richtung
  verfrüht. Verschoben nach **AGE-623**, dort ausdrücklich als Aufgabe notiert.

- **`notify-contact-request` in DIESEM Change umbauen** (`opencode` Forderung 1,
  `gemini` Empfehlung 1). Der Umbau ist richtig und dringend — aber er ist kein
  Rechte-Entzug, sondern eine Änderung an einem Mailweg mit Sicherheitsprüfung,
  wenige Tage vor dem Go-Live. Ihn in einen Change zu packen, dessen Zweck das
  Entsperren der CI ist, bündelt zwei Risiken ohne Not. Beide Reviewer forderten
  ihn *vor oder mit* dem flächendeckenden Entzug — und der ist entfallen. Die
  Reihenfolge bleibt damit gewahrt: AGE-623 vor jedem weiteren
  `service_role`-Entzug.

- **Formulierung „bei Funktionen trägt nur der namentliche Entzug" einengen**
  (`opencode` Punkt 2, dritter Spiegelstrich). Der Einwand ist berechtigt — die
  Messung im Repo deckt nur `from public`. Die Formulierung stammt aber aus
  einer bestehenden Migration und einer bestehenden Anforderung; sie hier zu
  ändern hieße, eine fremde Aussage im Vorbeigehen umzuschreiben. Als offener
  Punkt notiert.

## Was beide bestätigt haben

- Der Golden-Snapshot ändert sich **nicht**: `grants_test.sql:37` filtert
  `grantee in ('anon','authenticated')`, die Spalten-Assertion nur
  `authenticated`, die Default-ACL-Assertion nur `anon=`/`authenticated=`.
  `service_role` kommt nirgends vor. Beide haben es unabhängig nachgemessen.
- Auf die **neue, strengere** CLI-Sorte zu pinnen ist die richtige Richtung.
- Die Rollenmenge `public, anon, authenticated, service_role` deckt die realen
  Vererbungswege ab; `pg_read_all_data` und `authenticator` sind keine Lücke.
- Die Zeilenangaben `ci.yml:102`, `…blaetterung.sql:121`,
  `…namensaufloesung.sql:81` stimmen (von `opencode` nachgemessen).
