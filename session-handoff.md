# Session Handoff — 2026-08-20 (fünfte Sitzung)

**DEV trägt den Spiegel.** Gruppe 5 ist vollständig, der Auszug darf
„Sicherung" heißen. Der erste DEV-Lauf ist abgebrochen — an einem Fehler, den
kein lokaler Lauf hätte zeigen können, und genau dafür gab es 5.2.

## Accomplished

**5.5 Sichtprobe** (`4901afc`). Fünf echte Profile in der laufenden Oberfläche,
alle mit Titelbild und Avatar aus dem Storage, Verzeichnis meldet 36 Mitglieder,
**Konsole über alle Seiten leer**. Anmeldefähig gemacht wurde ein übernommenes
Konto lokal per GoTrue-Admin; die Oberfläche lief als nacktes `vite` gegen
`127.0.0.1:54321` — `pnpm dev` hätte über Infisical gegen DEV geredet.

**5.2/5.3, zweiter Anlauf** (`fe102f5`, `bf798f6`). Der erste Lauf brach bei
4.1b ab. Behoben, dann Exit 0. **Unabhängig nachgerechnet**, nicht aus dem
Eigenprotokoll: 858 Zeilen (857 + `matching_manager`), 36 Tabellen, 125 Objekte
mit **allen 125 eTags gleich**, genau drei deklarierte Abweichungen.

**5.6 Sicherungslauf** (`feac273`). `--sicherung` lässt 4.13 **und** 4.9/4.10
aus. Dreiteilig belegt: ohne Schalter 0/72 Hashes im Auszug und Anmeldung
HTTP 400; mit Schalter **72/72 byteweise** und **null** Abweichungen; plus die
Kontrolle, dass die Anmeldung überhaupt am Hash hängt (bekannter bcrypt-Hash
per SQL → HTTP 200). Kein echtes PROD-Passwort verwendet.

Auch gefallen: **4.7** (nur zu einem Drittel, siehe unten) und **4.8a**.

Bericht: `openspec/changes/sync-dev-from-prod/messungen/gruppe-5-sichtprobe-2026-08-20.md`
(drei Nachträge).

## Decisions

- **`auth` wird per Regel geleert, nicht per Namensliste.** *Warum:* der erste
  DEV-Lauf räumte nur `auth.users` und `auth.identities`; stehen blieben
  13 `sessions`, 81 `refresh_tokens`, 13 `mfa_amr_claims` und ein
  `one_time_token`. Alle diese Fremdschlüssel sind `ON DELETE CASCADE` — das
  trug nicht, weil **`session_replication_role = replica` die Cascade-Trigger
  mit stilllegt**. Im replica-Modus verschwindet nur, was benannt wird. Eine
  Namensliste war die falsche Bauform: `oauth_consents` und `webauthn_*` sind
  neu und stünden in keiner handgepflegten Liste. `schema_migrations` bleibt.
- **Jede geleerte auth-Tabelle wird im Leeren-Schritt nachgezählt.** *Warum:*
  geprüft wurde „`auth.users` ist leer". Der Abbruch kam dadurch vier Schritte
  später aus der Fremdschlüsselprüfung — mit halb eingespieltem Ziel.
- **`--sicherung` lässt zwei Dinge aus, nicht eines.** *Warum:* mit nur 4.13
  übersprungen meldete die Abnahme zwei Abweichungen statt null — fünf Stufen
  und die `matching_manager`-Zeile. Das ist ein **DEV-Bestand mit echten
  Hashes**, die schlechteste der drei Fassungen. Im Sicherungslauf ist die
  Deklaration daher leer: null Abweichungen ist die Zusage.
- **Gegen `--ziel=dev` ist `--sicherung` abgelehnt, nicht abgeraten.** *Warum:*
  neutralisierte Hashes sind einer der zwei Ausgleiche für „keine
  Anonymisierung". Der Schalter kommt aus einer kopierten Befehlszeile, und die
  gefährliche Fassung unterscheidet sich um ein Wort. Abbruch vor jedem
  Verbindungsaufbau.
- **Kein `--ziel=prod` gebaut.** *Warum:* 5.6 verlangt den Beleg, dass der
  Auszug die Rolle *tragen kann*. Für einen Aufrufer, den es nicht gibt, wird
  nichts vorgehalten.

## Files modified

- `scripts/sync-dev-ruecklauf.logic.ts` — neu `authTabellenZumLeeren()` und
  `pruefeSicherungslauf()`
- `scripts/sync-dev-ruecklauf.ts` — auth-Tabellen zur Laufzeit ermitteln,
  Nachzählung im Leeren-Schritt, 4.13 und 4.9/4.10 hinter dem Schalter,
  Deklaration im Sicherungslauf leer
- `scripts/sync-dev-ruecklauf.test.ts` — 8 neue Tests (4 Leeren-Regel,
  4 Sicherungsschalter), alle erst rot
- `package.json` — `sync:dev` (mit `--env=prod`, siehe 1.1)
- `openspec/changes/sync-dev-from-prod/` — `tasks.md` (4.7, 4.8a, 5.2, 5.3,
  5.5, 5.6 abgehakt; `owner`-Posten in 5.3), ein Bericht mit drei Nachträgen
- **Ausserhalb des Repos:** DEV trägt jetzt den Spiegel. Der lokale Stack
  ebenfalls, mit neutralisierten Hashes (nach dem Sicherungslauf wieder
  aufgeräumt, nachgezählt 0/72).

## Next session: start here

Branch `donald/age-576-spiegel-dev-prod`, HEAD `feac273`, Arbeitsbaum sauber,
**kein PR**. `pnpm test` (1326), typecheck, lint und Prettier grün.

**Erste Aktion ist die zurückgestellte Sichtprobe auf `fbc-platform.pages.dev`**
— die ausgelieferte Fläche liest gegen DEV und zeigt seit heute die echten
Mitglieder statt der Demo-Personas. Das ist der einzige Teil des Spiegels, den
noch niemand angesehen hat. Danach Gruppe 6, und dort ist **6.2 die eigentliche
Arbeit**: `docs/supabase-environments.md` und `docs/prod-neuaufbau-plan.md`
(Schritt 1 auf `--sicherung` umstellen, Schritt 0 schließen). 6.1 ist faktisch
schon grün, muss aber am Stück laufen. Dann 6.3 (zwei Prüfer anderer
Hersteller), 6.4 `openspec archive`, 6.5 Linear — vorher `get_issue` lesen, die
Automation schaltet selbst.

Eine Falle aus dieser Sitzung: der DEV-Lauf **fällt beim Klassifikator** wie
`db:push:prod`. Nicht umgehen — Donald den Befehl mit `!` geben.

## Open questions

- **4.10 Dokumente sind weiter nicht nachgezogen** und jetzt tatsächlich
  überholt: `docs/demo-zugang.md`, `docs/demo-script.md` und die drei
  Abnahmedokumente. `pnpm demo:seed`/`demo:reset` gegen DEV zerstört den
  Spiegel.
- **Neue Flanke: DEV trägt 72 echte Adressen und einen lebenden
  E-Mail-Webhook** (`…/functions/v1/notify-contact-request`), und der
  Resend-Zugang ist zu PROD byte-identisch. Heute verstellt durch
  neutralisierte Hashes und `contact_requests = 0`, aber die
  Selbstregistrierung ist offen. Gehört auf die Rücknahmeliste vor Go-Live.
- **4.7 ist nur zu einem Drittel gemessen.** `trg_event_feed_post` ist echt
  belegt (8 Events, `posts` bleibt 29). Die Post- und
  Benachrichtigungshälften sind **leer gelaufen**: der Auszug trägt
  `contact_requests = 0` und `notifications = 0`. Nicht größer lesen.
- **`socials` ist auf keiner öffentlichen Fläche sichtbar.** 34 Profile tragen
  Netzwerke, `profiles_public` führt die Spalte nicht, keine Komponente
  rendert sie. Bestandscode, eigenes Issue wert.
- **`storage.objects.owner` ist im Spiegel überall leer**, auf PROD bei 8 von
  125 gesetzt. Folgenlos — keine der 14 Policies nennt `owner`.
- Unverändert offen: Detlevs Zahlungsliste (AGE-534) · Downgrade (AGE-516) ·
  `admin_list_feedback()` ohne Paging · AGE-497 · AGE-541 · AGE-512 · AGE-256 ·
  AGE-513 · AGE-258 · eigenes Issue für `send-activation` (2xx trotz
  Resend-401) · `demo_personas.sql` scheitert lokal an einem Fremdschlüssel
  (vorbestehend).
