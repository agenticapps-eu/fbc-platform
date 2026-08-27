# Entwurf — Push-Fundament (AGE-641)

## Die eine Entscheidung, aus der die anderen folgen

**Push liest `notifications`.** Alles andere ist Folge davon: kein Polling, kein
zweites Ereignissystem, kein zweiter Schalter, keine zweite Wahrheit darüber,
wer was sehen darf. Die Zeile existiert bereits und wurde bereits gegen
Sichtbarkeit und Opt-out geprüft, als sie geschrieben wurde.

## Sieben Typen, nicht vier

| Typ | Seit | Opt-out heute | Push (Vorschlag §4) |
| --- | --- | --- | --- |
| `contact_request` | Juni | **keiner** | ja |
| `contact_request_accepted` | Juni | **keiner** | ja |
| `contact_request_declined` | Juni | **keiner** | ja |
| `post_created` | 27.08. | `notify_inapp_post` | nein |
| `event_created` | 27.08. | `notify_inapp_event` | vertagt (Bündelung) |
| `comment_on_post` | 27.08. | `notify_inapp_comment` | nein |
| `like_on_post` | 27.08. | `notify_inapp_like` | nein |
| **`message`** | **neu** | **neu** | **ja — der Kernfall** |

Die drei oberen sind der Grund, warum `notify_app_contact` dazukommt: sie werden
gepusht und wären sonst die einzigen ohne Abschalter.

## Warum der Text an der Quelle fehlt, nicht im Transport

Naheliegend wäre, `send-push` den Nachrichtentext weglassen zu lassen. Verworfen:
dann trägt die `notifications`-Zeile ihn, und jeder **künftige** Leser — ein
zweiter Transport, ein Export, eine Admin-Fläche — trägt ihn weiter. Die
bestehende Zusage für die vier Typen sagt es bereits („a notification row is not
subject to the subject's visibility once written"). Der Nachrichtentext folgt
derselben Regel: er steht nie drin.

Damit ist „kein Inhalt auf dem Sperrbildschirm" keine Eigenschaft der Function,
die jemand versehentlich zurücknehmen kann, sondern eine der Daten.

## Warum die Zuordnung eine Tabelle ist

`push_routing (type text primary key, push boolean not null)`.

Die Liste in §4 ist ausdrücklich **noch nicht mit Detlev abgestimmt**. Stünde sie
als `case` in der Function, kostete jede Änderung einen Function-Deploy — und
die erste Push-Nachricht entscheidet, ob jemand Push anlässt. Als Zeile ist sie
ein `update`.

Verworfen: eine Check-Constraint auf `notifications.type`. Es gibt heute keine
(blankes `text`), und eine einzuführen hieße, jeden neuen Typ zweimal
anzumelden. `push_routing` ist die Anmeldung.

Nicht in der Tabelle: **Bündelung**. `event_created` steht auf `false`, weil
Bündeln eine Zustellzeit-Mechanik ist und kein Transport. Ein `gebuendelt`-Feld
ohne die Mechanik dahinter wäre eine Zusage, die nichts einlöst.

## Warum eine DEFINER-RPC und nicht der Dienstschlüssel

`service_role` hält in `public` **keine** Tabellenrechte, die dieses Repository
ausspricht. Dass sie lokal trotzdem 35 von 36 Tabellen liest, ist eine
Eigenschaft der **Instanz** — sie hat sich zwischen AGE-622 und AGE-623 an
einem Tag gedreht, ohne dass jemand etwas entschieden hätte. Ein Zustellweg, der
darauf steht, fällt zur Laufzeit und ohne Vorwarnung aus.

Also: `push_zustellung_daten(notification_id)`, SECURITY DEFINER, für keine
Client-Rolle aufrufbar. Sie prüft in einem Zug Aktivierung, Schalter und
Zuordnung und gibt zurück, was zuzustellen ist — oder nichts.

## Der Webhook steht nicht im Repo

`send-push` wird von einem Database Webhook angestoßen, genau wie
`notify-contact-request` (`verify_jwt=false`, gemeinsames Geheimnis im
`Authorization`-Kopf). Der Migrationsbaum enthält **null** `pg_net`-Aufrufe; der
Webhook wird in der Supabase-Konsole eingetragen.

Das ist eine Fläche, die in keinem Diff auftaucht und die beim Umschalten
zwischen DEV und PROD schon einmal zurückgeblieben ist. Sie steht darum
ausdrücklich in `tasks.md` und in der Abnahme — **zweimal gesetzt, einmal je
Projekt**.

## Verworfene Alternativen

| Alternative | Warum nicht |
| --- | --- |
| Getrennte `notify_push_*`-Spalten | Zwei Schalter für ein Ereignis; das Issue nennt es selbst eine Falle |
| Namen `notify_inapp_*` behalten | Die Tabelle trägt daneben `notify_email_*`; die Konvention ist transport-präfigiert und trägt bereits einen zweiten Transport |
| Eigene `push_queue`-Tabelle | Ein zweites Ereignissystem neben `notifications` — genau das, was das Issue verbietet |
| Text in der Zeile, Filter im Transport | Verlagert eine Datenzusage in Code, den jemand ändern kann |
| Umbenennung dem Web-Strang überlassen | Eine Spaltenumbenennung ist atomar; halb gelandet ist der Build kaputt |

## Koexistenz mit dem Web-Strang

Vier Berührungspunkte, zwei davon standen nicht in der Absprache:

| Datei | Wer |
| --- | --- |
| `package.json` | beide — kleine, häufige Commits |
| `src/lib/supabase.ts` | Mobil (AGE-642), Web bitte melden |
| **`src/lib/database.types.ts`** | **beide** — von Hand gepflegt, `gen types` läuft nie drüber |
| **`supabase/tests/grants_test.sql`** | **beide** — alphabetischer Golden-Snapshot; `push_tokens` landet direkt neben dem gerade eingefügten `release_entry_skips` |

`src/pages/EinstellungenPage.tsx` fasst der Mobil-Strang **einmal** an, für acht
Bezeichner (Donald, 27.08.).

---

# Nachtrag nach der Plan-Review (27.08.)

Zwei Reviewer fremder Anbieter, beide vor der ersten Codezeile. Sieben Befunde
angenommen und nachgemessen; die Belege stehen in `REVIEWS.md`. Vier davon
haben den Entwurf **geändert**, nicht nur ergänzt:

## Was falsch war

**Die Typ-Zählung.** Acht schreibende Typen, nicht sieben — `release_note`
fehlte, obwohl er am selben Tag entstand wie die Messung. Daraus folgte der
Satz „jeder Typ hat einen Schalter", der dem geltenden Spec widerspricht
(`specs/notifications/spec.md:340` verlangt für genau diesen Typ **keinen**).
Der Ausnahmefall steht jetzt ausdrücklich im Delta, und `release_note` wird
nicht gepusht: **der eine Typ ohne Abschalter ist der eine, der niemandem aufs
Gerät gehört.**

**Der Schalter war Zierrat.** `notify_app_contact` anzulegen und in
`hinweis_erwuenscht` einzutragen genügte nicht — der Kontakt-Trigger ruft diese
Funktion nie. Eine Spalte, die kein schreibender Weg liest, ist ein Schalter,
der in den Einstellungen behauptet, etwas sei aus, während es an ist.

**Die Sperrbildschirm-Zusage hatte ein Loch.** Sie galt für die vier
AGE-620-Typen und den neuen `message`-Typ — nicht für `contact_request`, dessen
Nutzlast seit Juni Mitglieder-Freitext trägt und den Abschnitt 4 pushen will.
Der Text verlässt jetzt die Quelle, **und** der Transport baut aus einer festen
Feldliste: das eine schützt die neuen Zeilen, das andere die alten.

**Die eigene Lehre halb angewandt.** Lesen über eine DEFINER-RPC, aber Löschen
direkt — beides steht auf derselben `service_role`-Eigenschaft, die als
instabil verworfen wurde. Jetzt beides über RPCs.

## Zwei Fallen, die keiner der Befunde erfunden hat

**Jedes Mitglied kann sich selbst Hinweise schreiben.**
`20260715140000:77` erteilt `insert` auf `notifications` an `authenticated`,
`notifications_own` lässt eigene Zeilen durch. Ohne Push ist das folgenlos; mit
Push erzeugt es Zustellarbeit auf fremde Kosten. Nachgemessen: **kein einziger
Client-Insert** im Quelltext — der Grant ist ungenutzt und wird entzogen.

**Der Drift-Scanner kennt genau zwei Webhooks.** `db-drift-scan.ts:27` führt
`ERWARTET_OHNE_MIGRATION` als Erlaubnisliste, und `migrate-prod.yml:132` lässt
den Scan bei jeder PROD-Migration laufen. Ein per Konsole angelegter
`send-push`-Webhook, der dort nicht einträgt, macht ihn rot — und ein rotes
Drift-Gate überspringt den Frontend-Deploy **stumm**. Die Fläche „außerhalb des
Diffs" hat also bereits einen Wächter, den dieser Change auslösen würde. Er
steht jetzt als eigener Punkt in der Abnahme.

## Was offen bleibt

**Zustellzustand.** Kein dauerhafter Zustand je `(notification_id, token_id)`,
keine Wiederholung, keine Idempotenz: ein 429 oder 5xx verliert den Push
endgültig, ein Wiederholungslauf schickt ihn doppelt. Der Einwand ist
berechtigt und ausdrücklich kein zweites Ereignissystem, sondern
Transportzustand. Er ist aber auch deutlich mehr, als das Issue verlangt.
**Donald entscheidet, bevor A5 beginnt.**

## Was die Reviewer geprüft und NICHT beanstandet haben

Gruppen-Chats gibt es nicht (`specs/messaging/spec.md:3`) — ein Gegenüber je
Nachricht ist richtig. Ein `after insert`-Trigger ist vom Client nicht
umgehbar. Und es gibt keinen Wettlauf zwischen Webhook und Transaktion:
`pg_net` startet nach dem Commit. Der `MODIFIED`-Block wurde klauselweise gegen
die Quelle gehalten — kein stiller Verlust.
