# Plan-Reviews — Push-Fundament (AGE-641)

Schritt 2b: gegnerische Review des Plans, **bevor** Code steht. Jeder Befund
unten wurde nach dem Bericht **selbst nachgemessen** — Reviewer pruefen den
Text, nicht die Welt, und ein uebernommener Befund ist so lange eine Behauptung,
bis ein Grep ihn traegt.

## Reviewer 1 — opencode

**MODEL:** Kimi-K3.5 (`synthetic/hf:moonshotai/Kimi-K3.5`) — fremder Anbieter.

### Eine Rahmung, die NICHT stimmt

Der Bericht haelt fest, der Baum sei „half-way landed" und typecheke nicht. Das
war zum Laufzeitpunkt richtig und ist es nicht mehr: der Reviewer lief
absichtlich parallel zu A1 und sah einen Baum mitten in der Umbenennung.
Nachgemessen nach Abschluss von A1: `pnpm typecheck` ohne Ausgabe, 173
Testdateien / 1958 Zusagen gruen, 42 pgTAP in den zwei betroffenen Dateien.

Die inhaltlichen Befunde beruehrt das nicht. Sie stehen alle.

### Angenommen und nachgemessen

| # | Befund | Nachgemessen |
| --- | --- | --- |
| **H1** | `notify_app_contact` ist wirkungslos: `handle_contact_request_change()` schreibt unbedingt und ruft `hinweis_erwuenscht` nie | `grep hinweis_erwuenscht 20260614100000_contact_request_flow.sql` → **null Treffer**. Bestaetigt. |
| **H2** | Die Sperrbildschirm-Zusage deckt `contact_request` nicht — dessen Nutzlast traegt Mitglieder-Freitext | `20260614100000:54` schreibt `'message', new.message`. Bestaetigt. **Zusatzbefund beim Nachmessen:** `HinweisGlocke.tsx:166-168` liest ihn nie — der Text wird geschrieben und nirgends angezeigt. |
| **H4** | Es sind **acht** Typen, nicht sieben — `release_note` fehlt in der Zaehlung | `20260827140000_release_notes.sql:140` schreibt `'release_note'`. Bestaetigt. Die Zahl im Proposal war am Tag des Schreibens bereits falsch. |
| **H3** | Das Delta sagt „jeder Typ hat einen Schalter", der geltende Spec verbietet genau das fuer `release_note` | `openspec/specs/notifications/spec.md:340-341`. Bestaetigt. |
| **M2** | Der Release-Note-Abschnitt nennt vier Spalten, die die Umbenennung toetet | `spec.md:350` nennt `notify_inapp_post, _event, _comment, _like`. Bestaetigt. |
| **M1** | Das Loeschen toter Token steht auf derselben `service_role`-Eigenschaft, die der Entwurf fuers LESEN ausdruecklich verwirft | Zugestanden — der Entwurf wendet seine eigene Lehre auf die Haelfte an. |
| **M3** | Die Zustell-RPC braucht `grant execute to service_role`; keine Aufgabe sagt es | Vorbild im Repo: `20260827100000:124-127`. Zugestanden. |
| **M4** | Unverzeichnete Typen in `push_routing` haben keine festgelegte Semantik | Zugestanden; mit H4 am ersten Tag real, nicht hypothetisch. |
| **L1** | Der Webhook feuert ~69-mal je Beitrag fuer Zeilen, die nie pushen | Zugestanden. |
| **L3** | `member_joined` steht als toter `case` in der Glocke | `HinweisGlocke.tsx:172`, kein Schreiber im Migrationsbaum. Bestaetigt — **nicht** in diesem Change angefasst (fremder Code, eigener Vorgang). |

### Ausdruecklich geprueft und NICHT beanstandet

Der Reviewer hat den `MODIFIED`-Block klauselweise gegen die Quelle gehalten:
alle fuenf urspruenglichen Szenarien ueberleben, „remaining three types" wurde
zu Recht auf „the remaining types" geweitet, die Owner-only- und Orakel-Absaetze
stehen woertlich. Kein stiller Verlust. Das deckt sich mit der eigenen Pruefung.

### Entscheidungen daraus (Donald, 27.08.)

1. **H2** — Freitext **an der Quelle streichen UND im Transport filtern**. Die
   Glocke verliert nichts, weil sie ihn nie las. Doppelt, weil die ALTEN Zeilen
   ihn weitertragen und nur der Transportfilter sie schuetzt.
2. **Altbestand** — bestehende Zeilen bleiben unangetastet. Keine schreibende
   Aenderung an echten Mitgliederdaten auf PROD; der Transportfilter genuegt.
3. **H1** — der Juni-Trigger wird **in diesem Change** verdrahtet. Ein Schalter
   in den Einstellungen, der nichts tut, ist schlimmer als keiner.

## Reviewer 2 — codex

**MODEL:** GPT-5 (OpenAI Codex) — fremder Anbieter, und diesmal **selbst
geprueft**: die `MODEL:`-Zeile nennt keinen weiterdelegierten Unter-Reviewer.
Auftrag ausdruecklich auf das gerichtet, was Reviewer 1 uebersehen hat; die vier
Befunde von dort waren als „nicht wiederholen" vorgegeben.

**Verdikt: REQUEST CHANGES.**

### Angenommen und nachgemessen

| # | Befund | Nachgemessen |
| --- | --- | --- |
| **H5** | Jedes aktivierte Mitglied kann sich SELBST Hinweiszeilen schreiben und damit ab Phase B beliebig viel Push-Arbeit erzeugen | `20260715140000_explicit_grants.sql:77` erteilt `insert` auf `notifications` an `authenticated`; `notifications_own` (`20260806080100:399`) laesst `profile_id = auth.uid()` durch. Bestaetigt. **Zusatzmessung:** `grep 'from("notifications")' src/` findet **keinen einzigen** Insert — der Grant ist ungenutzt und kann entzogen werden. |
| **H6** | Der PROD-Webhook fehlt in der Abnahme, UND der Drift-Scanner wuerde ihn als unerlaubtes Objekt melden | `scripts/db-drift-scan.ts:27` fuehrt `ERWARTET_OHNE_MIGRATION` mit genau zwei Webhook-Namen; `migrate-prod.yml:132` laesst den Scan bei jeder Migration laufen. Bestaetigt — und laut Betriebserfahrung blockt ein roter Drift-Gate **jeden** Frontend-Deploy stumm. |
| **H7** | Globale Token-Eindeutigkeit plus owner-only RLS strandet ein Token beim Kontowechsel: schlaegt die Abmelde-Aufraeumung fehl, kann Konto B die Zeile von A nicht uebernehmen, und A's Hinweise erreichen ein Geraet, das B benutzt | Die Identitaetsabbildung stimmt (`profiles.id` = `auth.users.id`, `20260611115655:17`), der Lebenszyklus nicht. Zugestanden. Braucht eine `claim_push_token`-RPC statt eines gewoehnlichen Inserts. |
| **M5** | Kein dauerhafter Zustellzustand, keine Wiederholung, keine Idempotenz: ein 429/5xx verliert den Push endgueltig, ein Wiederholungslauf schickt ihn doppelt | Zugestanden. Siehe „Offene Entscheidung" unten. |
| **M6** | `plattform` und `letzter_kontakt` stehen in den Aufgaben, aber in keiner Anforderung des Deltas | Zugestanden. |
| **M7** | Ein Change, der zur Haelfte gemergt wird, widerspricht dem Ein-Change-ein-PR-Lebenszyklus des Repos | Zugestanden als Beobachtung — der Schnitt ist aber **Donalds ausdrueckliche Entscheidung** vom 27.08. Wird nicht eigenmaechtig zurueckgedreht; siehe „Offene Entscheidung". |
| **L4** | Das Proposal sagt „keine Web-Komponenten ausser `EinstellungenPage.tsx`", A3 fasst aber `HinweisGlocke.tsx` an; und kein Vorgang laesst den `message`-Hinweis seinen Gespraechsfaden oeffnen | Bestaetigt — die Formulierung im Proposal war falsch. Korrigiert. |

### Ausdruecklich geprueft und NICHT beanstandet

- **Gruppen-Chats gibt es nicht.** `specs/messaging/spec.md:3` — Gespraeche sind
  strikt eins-zu-eins, ein Gegenueber je Nachricht ist heute richtig.
- **Der Nachrichten-Trigger ist nicht umgehbar.** Ein `after insert`-Trigger
  laesst sich vom Client nicht ueberspringen.
- **Kein Wettlauf zwischen Webhook und Transaktion.** `pg_net` startet die
  HTTP-Arbeit nach dem Commit; der echte Wettlauf liegt zwischen der Annahme
  durch den Anbieter und der dauerhaften Quittung.

Das ist bemerkenswert, weil es drei Befunde sind, die der Auftrag ausdruecklich
nahegelegt hat und die der Reviewer **verworfen** hat, statt sie zu liefern.

## Offene Entscheidung nach Reviewer 2

**M5 — Zustellzustand.** GPT-5 verlangt dauerhaften Zustand je
`(notification_id, token_id)`, Wiederholungsplan und einen atomaren
Idempotenz-Schluessel. Das ist kein zweites Ereignissystem, sondern
Transportzustand — der Einwand ist berechtigt. Es ist aber auch deutlich mehr,
als das Issue verlangt, und die Alternative („bestmuehte Zustellung, Verlust bei
5xx wird hingenommen und dokumentiert") ist bei einem Verein mit rund siebzig
Mitgliedern vertretbar. **Donald entscheidet.**

**M7 — Schnitt.** Ebenso: Phase B als abhaengiger eigener Change waere
lebenszyklus-sauber, widerspricht aber der bereits getroffenen Entscheidung.
**Donald entscheidet.**
