## Context

Der Verein läuft seit Ende August mit echten Mitgliederdaten auf PROD. Ein
Mitglied, das gehen will, kann sein Konto heute nur auf Zuruf löschen lassen.
AGE-644 macht daraus eine harte Voraussetzung für die Store-Einreichung.

**Was es schon gibt.** AGE-581 hat den Lebenszyklus eines Mitglieds gebaut, und
zwar mit genau der Sicht, die dieser Change braucht:

| Vorhanden | Was es tut |
|---|---|
| `profiles.deleted_at` / `disabled_at` | blendet die Zeile aus `profiles_public` und den Verzeichnis-Prädikaten aus |
| `former_member_entries(post_ids, comment_ids)` | sagt dem Feed „Ehemaliges Mitglied", ohne zu verraten, *warum* |
| `admin_delete_member` / `admin_restore_member` | weiche, **wiederherstellbare** Admin-Löschung über `service_role` |
| `admin-set-member-ban` (Edge Function) | das Muster: einziger Eingang, weil `auth.users` GoTrue gehört |

Die Entscheidung „anonymisieren, Fremdsicht bleibt" ist damit architektonisch
vorbereitet — die Anzeige als *Ehemaliges Mitglied* muss nicht erfunden werden.

**Was fehlt**, ist die Unwiderruflichkeit. `deleted_at` **blendet nur aus**: Name,
Bio, Firma, Adresse und Bilder stehen danach unverändert in der Datenbank. Für
eine Admin-Entfernung ist das richtig, für eine DSGVO-Löschung ist es keine
Löschung.

**Die Sperre.** `profiles.id references auth.users (id) on delete cascade`, und an
`profiles` hängen **35 Fremdschlüssel**, fast alle ebenfalls `on delete cascade`.
Ein `auth.admin.deleteUser()` löscht damit heute die gesamte Kette — Beiträge,
Kommentare, Nachrichten, Kontaktanfragen. Das ist das genaue Gegenteil der
getroffenen Entscheidung, und es passiert still.

## Goals / Non-Goals

**Goals**

- Ein Mitglied löscht sein Konto selbst, auf allen drei Flächen, unwiderruflich.
- Personenbezug verschwindet aus allen **strukturierten** Feldern — auch aus dem
  Volltextindex und dem Objektspeicher.
- Fremde Gesprächsfäden bleiben unversehrt.
- Die `auth.users`-Identität geht, ohne die Inhaltstabellen mitzureissen, und der
  Zugang endet sofort statt erst mit Ablauf des Zugriffstokens.

**Non-Goals**

- Kein DSAR-Export, keine Einwilligungsverwaltung, kein Audit-Log (AGE-260).
- Keine Karenzzeit und kein Widerrufsfenster — die Löschung wirkt sofort.
- Die weiche Admin-Löschung wird nicht ersetzt (sie wird in **D7** um eine
  Verweigerung ergänzt).
- Kein Rückbau der 35 Kaskaden auf `profiles`. Sie bleiben richtig für den Fall,
  dass eine Profilzeile *doch* verschwindet; dieser Change sorgt dafür, dass sie
  bei einer Kontolöschung gar nicht erst auslösen.
- **Keine Umschreibung fremder Beitrags- und Nachrichtentexte** — siehe D9, das
  ist eine bewusst benannte Grenze, keine Auslassung.

## Decisions

### D1 — Die Profilzeile bleibt stehen, geleert (Grabstein)

Statt `delete from profiles` werden die PII-Spalten geleert und die Zeile als
namenloser Anker behalten. Nur so behalten die 35 abhängigen Tabellen ihren
Fremdschlüssel, und `former_member_entries()` findet weiterhin eine Zeile, um
„Ehemaliges Mitglied" zu beantworten.

*Verworfen: die Kaskaden auf `set null` umstellen.* Die betroffenen Spalten sind
`not null` (`author_id`, `sender_id`, `from_id`/`to_id`), es wären 35 Migrationen
statt einer, und der Feed verlöre die Auskunft, wer der Urheber *war* — er könnte
„Ehemaliges Mitglied" nicht mehr von „nie dagewesen" unterscheiden.

Beim Leeren ist gegen `not null`, `check` und Trigger zu prüfen: nicht jede Spalte
nimmt `null`, und für die betroffenen ist ein neutraler Ersatzwert zu wählen.

### D2 — Der Fremdschlüssel auf `auth.users` wird ENTFERNT, nicht abgeschwächt

Damit `auth.users` gelöscht werden kann, ohne D1 zu zerstören, muss
`profiles_id_fkey` **fallen**.

> **Korrektur aus dem Plan-Review (codex, HIGH).** Der erste Entwurf wollte den
> Schlüssel „ohne Kaskade neu setzen". Das wäre `on delete no action` — der
> Standard — und hätte die Löschung nicht etwa erlaubt, sondern **verhindert**:
> solange die Grabstein-Zeile auf `auth.users` zeigt, scheitert deren Löschung an
> der referenziellen Integrität. Zwischen „Kaskade weg" und „Fremdschlüssel weg"
> liegt der ganze Change.

Die Kopplung wandert damit aus der Datenbank in die Löschfunktion, die beide
Seiten in fester Reihenfolge behandelt.

*Verworfen: `on delete set null`* — `profiles.id` ist Primärschlüssel.
*Verworfen: `auth.users` behalten und dort die E-Mail anonymisieren* — dann bliebe
eine Anmeldeidentität bestehen; das Requirement verlangt ihren Abgang, und Apple
wie DSGVO lesen „Konto gelöscht" so.

Was dadurch entfällt, ist die automatische Aufräumung verwaister Profile, wenn
jemand einen Nutzer direkt in der GoTrue-Konsole löscht. Bewusster Tausch: ein
verwaistes, aber sichtbares Profil ist reparierbar, eine still gelöschte
Beitragskette nicht.

### D3 — `search_doc` pflegt sich selbst; die Pflicht liegt bei seinen acht Quellspalten

*Gemessen am lokalen Stack, 08.09.:* `profiles.search_doc` ist eine
`generated always as … stored`-Spalte über `name, company, branche, short_bio,
headline, roles, competencies, interests`. Sie **kann** nicht von Hand gesetzt
werden und muss es auch nicht.

Die Sorge war trotzdem berechtigt, sie trifft nur eine andere Stelle: der Index
bleibt genau so lange durchsuchbar, wie **eine** dieser acht Spalten noch etwas
enthält. Die erste Fassung dieses Plans führte nur vier davon als PII —
`branche`, `short_bio`, `roles`, `competencies` und `interests` fehlten. Die
Datenmatrix führt jetzt alle acht; Test 5.2 sichert die Vollständigkeit ab.

### D4 — Edge Function als einziger Eingang; wo die Identität verifiziert wird

Dasselbe Muster wie `admin-set-member-ban`: Die Anonymisierungs-Funktion bekommt
`execute` nur für `service_role`, damit niemand einen Halbzustand erzeugen kann,
in dem die Profilzeile geleert ist und `auth.users` noch steht.

Die Funktion handelt **ausschliesslich am Aufrufer selbst**; eine Ziel-ID als
Parameter gibt es nicht. Trifft dennoch eine fremde Ziel-ID ein, wird sie
**abgelehnt**, nicht stillschweigend ignoriert.

**Wo verifiziert wird, ist festzuschreiben, nicht anzunehmen** (codex, MEDIUM):
`sub` aus dem Token zu *lesen* ist keine Verifikation. Entweder verifiziert das
Gateway die Signatur, bevor die Funktion läuft — dann muss die
Deployment-Konfiguration das erzwingen und der Change sie benennen — oder die
Funktion verifiziert selbst über `getClaims()`. Zu prüfen ist beides gegen die
projektbekannte ES256-Falle, die `getUser()` ausschliesst; asymmetrische
Claim-Prüfung ist davon nicht betroffen. Ungültige Signatur, falscher Issuer,
abgelaufenes Token und fremde Ziel-ID gehören in die Tests.

### D5 — Reihenfolge: Dateien ZUERST, `auth.users` ZULETZT

> **Korrektur aus dem Plan-Review (codex, HIGH) — mit einer Einschränkung.** Der
> erste Entwurf löschte `auth.users` vor den Dateien und widersprach dabei seiner
> eigenen Erläuterung; das ist korrigiert.
>
> Codex' *Begründung* misst sich auf diesem Schema allerdings **nicht**:
> `storage.objects` trägt zwar `owner` und `owner_id`, aber **keinen
> Fremdschlüssel auf `auth.users`** — der einzige ist `bucket_id →
> storage.buckets` (gemessen am lokalen Stack, 08.09.). Die Nutzerlöschung
> scheitert hier also nicht an Objekteigentum.
>
> Die Reihenfolge bleibt trotzdem umgedreht, aus dem zweiten Grund: ist
> `auth.users` erst weg, kann bei einem Abbruch niemand mehr die Pfade
> nachschlagen. Der Befund war richtig, seine Begründung trägt hier nur nicht.

1. Schreibzugriff des Kontos sperren (siehe D8), damit kein paralleler Upload das
   Inventar überholt
2. Objektinventar sichern — alle Dateien des Kontos, **einschliesslich ersetzter
   Avatare und Waisen**, nicht nur die Pfade, die in `profiles` stehen
3. Objekte aus `avatars`, `covers`, `post-media`, `feedback-screenshots` löschen;
   ein fehlendes Objekt ist kein Fehler
4. Anonymisieren (Spalten leeren, `search_doc` neu, Löschzustand setzen)
5. `auth.users` entfernen

Jeder Schritt ist **idempotent**, damit ein Abbruch durch Wiederholung heilbar
ist. Ein Teilfehler darf keine Erfolgsmeldung auslösen; der zurückbleibende
Zustand hat dann **zu wenig** gelöscht, nie zu viel. Das Nachholen ist eine
Admin-Handlung — einen dauerhaften Auftragsspeicher mit Fortschritt führt dieser
Change bewusst nicht ein, weil er sonst das Audit-Log aus AGE-260 vorwegnähme.

### D6 — Die Aufbewahrungs-Ausnahme ist heute leer, bindet aber die Zukunft

Es gibt derzeit **keine Rechnungstabelle** — `add-easybill-invoicing` ist nicht
umgesetzt. Das Requirement bleibt stehen, weil es die Schnittstelle festlegt.

Als Auflage an den späteren Change: aufbewahrungspflichtige Belege müssen die
nötigen Angaben **bei ihrer Erstellung kopieren**, nicht per Fremdschlüssel aus
`profiles` lesen. Sonst ist die Rechnung nach einer Kontolöschung entweder
unvollständig oder sie hält den Personenbezug offen, den die Löschung nehmen soll.

### D7 — Ein eigener, irreversibler Löschzustand; `admin_restore_member` verweigert ihn

> **Korrektur aus dem Plan-Review (codex, HIGH).** `deleted_at` war als einzige
> Unsichtbarkeitssperre vorgesehen — und `admin_restore_member` setzt genau dieses
> Feld auf `null` zurück. Ein Restore hätte den leeren Grabstein wieder ins
> Verzeichnis geholt.

Der Löschzustand ist daher **eigen und dauerhaft**, nicht `deleted_at` allein.
`admin_restore_member` verweigert ihn ausdrücklich; die weiche Admin-Löschung
bleibt für alle anderen Konten wiederherstellbar. Gleichzeitiges Restore und
Löschen ist abzusichern.

Die Sichtbarkeits-Prädikate müssen den neuen Zustand ebenso ausblenden wie
`deleted_at`. **Achtung, drei Stellen:** die RLS-Prädikate, `profiles_public`
(läuft mit `security_invoker = off`) und die DEFINER-RPCs, die ihr Prädikat
abgeschrieben führen — darunter `former_member_entries`.

### D8 — Der Zugang endet sofort, nicht mit Ablauf des Zugriffstokens

> **Korrektur aus dem Plan-Review (codex, HIGH).** `deleteUser()` entwertet
> Refresh-Tokens, aber ein bereits ausgestelltes Zugriffstoken bleibt bis zu
> seinem Ablauf gültig. Da die Profilzeile absichtlich stehenbleibt, liefert
> `auth.uid()` weiterhin dieselbe ID — das gelöschte Konto könnte in diesem
> Fenster weiter schreiben und neue PII anlegen.

Der Löschzustand muss deshalb **serverseitig durchgesetzt** werden.

**Gemessen am 08.09.: er wird es bereits.** `is_activated()` liest
`deleted_at`, und die Zählung über `pg_policies` ergibt:

| Fläche | schreibende Policies mit `is_activated()` | ohne |
|---|---|---|
| Schema `public` | **34** | **0** |
| `storage.objects` | alle (INSERT über `with_check`, UPDATE über beide, DELETE über `qual`) | 0 |

Weil die Löschung `deleted_at` mitsetzt (D7), ist das Konto damit in dem
Augenblick schreibgesperrt — Datenbank wie Objektspeicher —, in dem die
Anonymisierung durchläuft, und zwar unabhängig von jedem noch gültigen Token.
Hier ist also **nichts zu bauen, nur etwas festzuhalten**: die Zusagen 11 und 12
in `kontoloeschung_test.sql` halten die Null fest.

Zusage 12 ist per Mutation gegengeprüft: nimmt man `is_activated()` aus
`offers_write_own` heraus, fällt **genau diese eine** Zusage — nicht mehr und
nicht weniger. Sie misst also das Gate und nicht seine Nachbarschaft. Sie
schreibt bewusst gegen `offers` und nicht gegen `posts`: dort hat
`authenticated` kein INSERT-Recht, die Ablehnung käme aus dem ACL statt aus der
Policy, und beide melden `42501`.

### D9 — Freitext bleibt, und das Versprechen wird entsprechend formuliert

> **Aus dem Plan-Review (codex HIGH, gemini LOW).** Das Leeren der Profilfelder
> erreicht keinen Freitext: eine Nachricht „meine Nummer ist …", ein Beitrag, in
> dem jemand den Namen ausschreibt, und die **@-Erwähnungen**, die dieses Projekt
> über den *Namen* auflöst (`buildMentionResolver` in `src/lib/feed.ts`) — dort
> steht der Name im Text eines fremden Beitrags.

Das ist die unvermeidliche Kehrseite der Entscheidung „fremde Gesprächsfäden
bleiben stehen". Der Change löst sie **nicht** auf, denn fremde Beiträge
umzuschreiben verändert die Aussage anderer Menschen. Zwei Folgen:

1. Das Spec-Versprechen wird auf das eingeschränkt, was es halten kann:
   Personenbezug verschwindet aus den **strukturierten** Feldern.
2. Die Oberfläche muss eine Erwähnung, die sich nicht mehr auflösen lässt, als
   schlichten Text darstellen statt als toten Verweis.

Freitext auf Anfrage zu bereinigen bleibt der manuelle Weg — er ist auch heute
schon der einzige und wird durch diesen Change nicht schlechter.

### D10 — Kommende Anmeldungen, Gastgeberrollen und geplante Beiträge

> **Aus dem Plan-Review (gemini HIGH, codex MEDIUM).** Eine anonyme, aber
> bestehende Anmeldung belegt einen Platz — `event_registrations` führt eine
> `waitlist`, es rückt also niemand nach. Ein Gastgeber, der geht, hinterlässt
> eine Veranstaltung ohne Ansprechpartner. Geplante Beiträge würden nach der
> Löschung weiter veröffentlicht.

Festgelegt wird:

- **Anmeldungen zu künftigen Veranstaltungen** werden auf `cancelled` gesetzt,
  damit der Platz frei wird. Vergangene Anmeldungen bleiben anonym stehen.
- **Geplante, noch nicht veröffentlichte Beiträge** werden gelöscht — sie sind
  noch niemandes Gesprächsfaden.
- **Offene, noch nicht angenommene Kontaktanfragen** des Kontos werden
  zurückgezogen; angenommene bleiben (sie sind Teil eines fremden Verlaufs).
- **Künftige Veranstaltungen, deren Gastgeber das Konto ist**, sind der einzige
  Fall, der eine Person braucht: sie werden nicht automatisch abgesagt, sondern
  bleiben mit anonymem Gastgeber stehen und sind eine Admin-Aufgabe. Automatisches
  Absagen träfe alle Angemeldeten.

Gruppenunterhaltungen gibt es nicht — `message_threads` ist über
`unique (a_profile_id, b_profile_id)` strikt zweiseitig. Der entsprechende
Review-Befund läuft damit ins Leere.

## Risks / Trade-offs

- **Apples Lesart von „zugehörige Daten"** → codex hält das Erhalten fremder
  Gesprächsfäden für einen möglichen Ablehnungsgrund bei der Store-Prüfung. Die
  Entscheidung dazu ist getroffen (Donald, 08.09.) und die Praxis grosser Dienste
  stützt sie; das Restrisiko ist benannt und liegt bei der Einreichung, nicht bei
  diesem Change. Siehe Open Questions.
- **Das Migrationsfenster ist scharf** → Der Fremdschlüssel muss fallen, *bevor*
  die erste Löschung läuft. Läuft die Edge Function gegen eine Umgebung, in der
  die Migration fehlt, löscht der `auth.users`-Abgang die ganze Kette. Deshalb
  zweistufig **und** serverseitig abgesichert: die Funktion prüft den Schemazustand
  und verweigert bei inkompatiblem Schema, statt sich auf die Reihenfolge des
  Ausrollens zu verlassen.
- **Verwaiste Profile nach D2** → Ein direkt in GoTrue gelöschter Nutzer
  hinterlässt eine Profilzeile. Sichtbar und reparierbar; in der Spalte
  dokumentieren.
- **`search_doc` als stiller Rückkanal (D3)** → Test, der nach der Löschung mit
  dem alten Namen sucht und nichts findet.
- **Dateien im Objektspeicher werden heute nie aufgeräumt** → gemessen an den
  Event-Covern auf PROD, wo Waisen liegen. Ein fehlendes Objekt ist kein Fehler;
  fremde Dateien dürfen nicht mitgehen, und das gehört eigens geprüft.
- **Ein Test gegen die geteilte DEV-Datenbank kann fremde Daten löschen** → Der
  Nachweis gehört gegen den lokalen Stack, mit eigens angelegtem Konto.
- **Unwiderruflichkeit trifft auch Fehlbedienung** → die Rückfrage benennt die
  Folge, nicht nur „Sind Sie sicher?".

## Migration Plan

1. Migration: `profiles_id_fkey` **entfernen** (D2).
2. Migration: Löschzustand (D7) — Spalte, Prädikate an allen drei Stellen,
   `admin_restore_member` verweigert ihn, schreibende Prädikate sperren (D8).
3. Migration: Anonymisierungs-Funktion; `execute` nur `service_role`, `revoke`
   für `public`, `anon`, `authenticated` ausdrücklich aussprechen — geerbte
   Rechte reichen nicht, und der Grants-Schnappschuss in der CI zieht mit.
4. Auf DEV ausrollen und **zurücklesen**, dass der Fremdschlüssel weg ist — nicht
   nur, dass die Kaskade weg ist; `NO ACTION` sähe im Schema ähnlich aus und wäre
   der falsche Zustand.
5. Edge Function deployen.
6. Oberfläche ausliefern.
7. **Denselben Rückleseschritt auf PROD**, bevor der Weg dort erreichbar ist.

**Rollback:** Schritte 1–3 sind rückwärts kompatibel, solange keine Löschung lief.
Nach der ersten Löschung gibt es kein Zurück; das ist die Natur der Sache.

## Open Questions

- ~~**Apple-Risiko (codex HIGH #2)**~~ — **entschieden (Donald, 08.09.):** Es
  bleibt beim Anonymisieren. Das Restrisiko ist eine Ablehnungsrunde, auf die man
  mit einer Begründung antwortet; der Preis der Gegenrichtung wäre dauerhaft und
  träfe die verbliebenen Mitglieder. Das Risiko ist in AGE-644 vermerkt, damit es
  bei der Einreichung auf dem Tisch liegt und nicht neu entdeckt wird.
- **`event-covers`:** Titelbilder von Veranstaltungen, die das Konto angelegt hat,
  gehören zur Veranstaltung und nicht zur Person — Vorschlag: bleiben. Zu
  bestätigen, und Vorsicht, weil auf DEV Waisen aus dem Spiegel liegen.
- **Wo genau sitzt der Einstiegspunkt?** Einstellungen ist naheliegend; die
  Platzierung wird an der laufenden Oberfläche gezeigt, nicht hier entschieden.
- **Bestätigungs-E-Mail?** Nicht gefordert, und sie bräuchte die Adresse, die
  gerade gelöscht wird. Vorschlag: nein.
- **Erneute Registrierung mit derselben Adresse** erzeugt ein neues Konto und
  verbindet nichts wieder. Angenommen, nicht geprüft — gehört in einen Test.
- **Laufende Zahlungen:** ob eine Kontolöschung ein aktives Stripe-Abo beendet,
  ist offen. Heute trägt `profile_legacy` ein `paid_until` und ein Downgrade fehlt
  ohnehin — der Punkt ist ausserhalb dieses Changes, aber er ist real.
