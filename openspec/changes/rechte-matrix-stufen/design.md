# Entwurf — Rechte-Matrix: Verzeichnis ab connect, Kontaktanfragen nach Stufe

Linear: AGE-598 · Proposal: [proposal.md](./proposal.md)

## Context

### Was heute gilt, gemessen und nicht gelesen

**Die Verzeichnisliste hängt an genau einer Policy.** `search_directory` trägt
keine `security`-Zeile und ist damit **`SECURITY INVOKER`**; es liest
`public.profiles` unmittelbar. Darüber liegt
`profiles_select_self_or_discover` (`has_level(3)`). Unterhalb Rang 3 gibt die
RLS nur die eigene Zeile zurück — die Funktion läuft durch, sie liefert bloß
nichts. Es gibt **keine** zweite, niedrigere Schwelle, die man umstellen
könnte.

**Die Liste enthält bereits erweiterte Felder.** Die Rückgabe von
`search_directory` (`20260826110000_abgestufte_namensaufloesung.sql:114-118`)
umfasst neben den Basisfeldern auch `competencies`, `has_offers`, `has_needs`,
`offer_categories` und `need_categories`. Die Trennung „Liste bei `connect`,
erweiterte Felder bei `discover`" ist deshalb **spaltenweise**, nicht
zeilenweise — und das ist der eigentliche Entwurfsgegenstand.

**Ein zweiter Weg an der Schwelle vorbei existiert und bleibt.**
`profiles_public` läuft mit `security_invoker=off` und liefert die Basisfelder
laut Spec ausdrücklich „regardless of the member's tier". Sie trägt an 15
Stellen die Namensauflösung (Feed, Chat, Events, Academy, Admin,
Kontaktanfragen, Verzeichnis). Donald hat am 02.09. entschieden, sie **nicht**
zu gaten.

**Die Kontaktanfrage-Policy trennt schon zwei Klauseln.** In `cr_insert_self`
(`20260806080100_activation_gate.sql:313-333`) steht das Level-Gate in Zeile
320 und der Welpenschutz in Zeile 332, jeweils mit eigenem
`public.is_contact_open() or …`. Die Entkopplung ist deshalb kein Umbau,
sondern das Streichen eines `or`-Zweigs in genau einer Klausel.

**Der Fluchtweg des Welpenschutzes lebt.** Entgegen der Annahme im Linear-Issue
entstehen weiterhin Matches: `recompute_my_matches` wird nach dem Speichern von
Kompass (`compass.ts:289`), Profil (`profile.ts:431`) und Biete/Suche
(`matching-profile.ts:186`) gerufen. `fetchContactRelation`
(`contact-requests.ts`) sucht beim Öffnen eines Profils selbst ein Match und
reicht dessen `match_id` weiter. Entfernt wurde nur die **Anzeige** (AGE-450).
Deshalb konnte Donald den Welpenschutz unverändert lassen.

### Bestand

72 × `impact`, 1 × `discover`, 1 × `basic`. Der Import setzte alle auf `impact`;
`basic` entsteht nur durch Selbstregistrierung.

## Goals / Non-Goals

**Goals:**

- Die Verzeichnis**liste und -suche** ab `connect` (Rang 2) erreichbar machen,
  in Datenbank *und* Navigation.
- Die Rang-3-Grenze für erweiterte Felder **unverändert** halten und das
  beweisen, nicht behaupten.
- Kontaktanfragen staffeln: `basic` gar nicht · `connect` nur an genau
  `connect` · ab `discover` an alle.
- `open_contact` so umbauen, dass es **nur noch** die Staffelung aufhebt.

**Non-Goals:**

- Keine Listungs-Untergrenze. `basic` bleibt gelistet.
- Keine Schwelle auf `profiles_public`.
- Kein Schreibzugriff auf `platform_settings` in PROD.
- Keine inhaltliche Änderung am Welpenschutz.
- Kein Zurückholen der Matching-Oberfläche.

## Decisions

### D1 — Die Maskierung liegt in der Funktion, nicht in einer neuen Policy

**Entscheidung:** `search_directory` bekommt die Stufenlogik in den Rumpf. Die
Basisfelder kommen aus `profiles_public`, die erweiterten Spalten weiterhin aus
`public.profiles` — und damit weiterhin unter der Rang-3-RLS.

**Warum nicht eine zweite RLS-Policy auf `profiles`?** RLS ist
**zeilenweise**. Eine Policy, die einem `connect`-Konto die öffentlichen Zeilen
freigibt, gäbe ihm die **ganze Zeile** — samt `competencies` und allem, was
später dazukommt. Das bricht Entscheidung 2 sofort und still, und es bricht sie
erneut bei jeder neuen Spalte, die jemand an `profiles` hängt.

**Warum nicht `search_directory` auf `SECURITY DEFINER` umstellen?** Das ist
der naheliegende Griff und der gefährlichste: die Funktion schriebe dann das
Rechtemodell **ab**, statt es zu benutzen. Ändert sich die Rang-3-Grenze
später, driftet die Kopie lautlos. `access-control` verlangt ausdrücklich, dass
DEFINER-Funktionen gepinnt und eng gehalten werden — eine Suchfunktion mit
acht Filterparametern ist das Gegenteil davon.

**Die gewählte Form nutzt die Asymmetrie, die schon da ist:** `profiles_public`
umgeht die RLS bewusst und liefert allen die Basisfelder; `public.profiles`
liefert unterhalb Rang 3 nichts. Ein Join über beide maskiert die erweiterten
Spalten **von selbst**, ohne dass irgendwo eine Rangzahl ein zweites Mal
steht. Die Rangzahl `2` steht dann an genau einer Stelle: dem Eintrittstor der
Funktion.

**Folge, die benannt sein will:** Ein `connect`-Konto, das nach `competency`
oder Biete-/Suche-Kategorie filtert, bekommt **leer** — die Filter greifen auf
Daten, die es nicht sehen darf. Das ist richtig, aber es muss die Oberfläche
sagen, sonst sieht es wie ein Fehler aus.

### D2 — Die Staffelung ist ein eigenes Prädikat, keine Bedingungskette

**Entscheidung:** Ein Prädikat `darf_kontaktanfrage_senden(p_to_id uuid)`,
`stable`, `security definer`, `search_path = ''`, `execute` nur für
`authenticated`.

**Warum nicht direkt in der Policy?** Die Regel ist dreistufig und liest die
Stufe des **Empfängers** — in einer `with check`-Klausel, die ohnehin schon
sechs Bedingungen trägt, wäre sie nicht mehr prüfbar. Ein benanntes Prädikat
ist außerdem die einzige Form, die `access-control` („Helper predicates are the
single authority for gating") vorsieht.

**Warum `SECURITY DEFINER`?** Es liest `profiles.tier` des Empfängers. Ein
`connect`-Konto darf fremde volle Zeilen nicht lesen — ohne DEFINER fiele das
Prädikat still auf „kein Recht" und verböte **jede** Anfrage. Dasselbe Muster
und derselbe Grund wie bei `is_new_member` (`six_level_model.sql:152`).

**Die Auslegung von Entscheidung 4 ist „genau `connect`", nicht „`connect` und
darüber".** Donald hat das am 25.08. ausdrücklich so entschieden, mitsamt der
benannten Folge: bei heute 72 `impact` und 0 `connect` darf ein
`connect`-Mitglied **niemanden** anschreiben. Das ist kein Versehen und wird
hier nicht stillschweigend geglättet.

### D3 — Zwei Schalter statt eines, und keiner davon kippt beim Ausrollen

**Entscheidung:** Klausel 320 wird zu
`( public.is_contact_open() or public.darf_kontaktanfrage_senden(to_id) )`.
Klausel 332 wird zu
`( not public.ist_welpenschutz_aktiv() or match_id is not null
   or not public.is_new_member(to_id) )`.

Dazu eine **zweite** Spalte in `platform_settings`:
`welpenschutz_aktiv boolean not null default false`, mit demselben
Admin-Schreibrecht wie `open_contact`.

**Warum nicht bedingungslos, wie zuerst entworfen?** Der erste Entwurf liess
`is_contact_open() or` in Klausel 332 ersatzlos weg. Das hätte den Welpenschutz
**beim Ausrollen sofort scharf gestellt**, ohne dass ein Admin etwas tut — er
steht seit dem 05.08. faktisch aus, weil `open_contact` auf `true` steht. Ein
Mitglied, das heute ein neues Konto anschreiben kann, könnte es nach dem Deploy
nicht mehr; die einzige Milderung wäre ein Neuigkeiten-Eintrag gewesen. Der
Plan-Review hat das als HIGH benannt, und zu Recht: es widerspricht der Zusage,
unter der Donald am 02.09. entschieden hat („zwei Schalter statt einem", „auf
PROD ändert sich heute nichts").

**Die Vorgabe `false` bildet den heutigen *wirksamen* Zustand ab, nicht den
angestrebten.** Das ist bewusst und muss so dastehen: §2 des Stufenmodells sagt
den Welpenschutz zu, und die Vorgabe erfüllt diese Zusage nicht. Sie erfüllt
statt dessen die Zusage, dass eine Migration nichts umlegt, was ein Mensch
umlegen sollte. Wer den Schutz will, schaltet ihn ein — mit derselben Bewegung
wie beim Stufen-Gate.

**Ergebnis: zwei unabhängige Stellschrauben.** `open_contact` hebt die
Staffelung auf und **nur** sie. `welpenschutz_aktiv` schaltet den Welpenschutz
und **nur** ihn. Die Kopplung, an der Teil B bisher scheiterte, ist damit
gelöst, ohne eine neue zu schaffen — und **das Ausrollen ändert für Mitglieder
nichts**, in keiner der beiden Regeln.

### D5 — Filter, die eine Stufe nicht bedienen kann, werden ausgeblendet

**Entscheidung:** Die Filter, die auf maskierten Spalten arbeiten — Kompetenz,
Biete-/Suche-Kategorien, Thema, Angebotsart — SHALL für einen Aufrufer
unterhalb Rang 3 **gar nicht erscheinen**. Sie laufen nicht leer.

Das war zuerst als offene Frage in die Umsetzung verschoben („wird in der
Umsetzung entschieden"). Der Plan-Review hat das als MEDIUM zurückgewiesen, und
das ist berechtigt: es ist eine Gestaltungsfrage, keine Implementierungsfrage,
und sie hier offen zu lassen hiesse, sie nachts um drei zu entscheiden.

**Warum ausblenden statt leer laufen lassen?** Ein sichtbarer Filter ist ein
Versprechen. Einer, der systematisch nichts findet, bricht es bei jeder
Benutzung und erzeugt dabei genau die Frage, die er nicht beantwortet — „liegt
es an mir?". Ein Filter, der nicht da ist, erzeugt sie nicht.

**Was bleibt:** Die Fläche SHALL trotzdem benennen, dass es mehr zu filtern
gibt und ab welcher Stufe — sonst wird aus dem Ausblenden ein zweites
Verschweigen. Ein Hinweis an der Filterspalte, kein leeres Ergebnis.

### D4 — Die Navigationsschwelle folgt, sie führt nicht

`nav.ts:95` geht von `discover` auf `connect`. Das ist Komfort, keine
Sicherheitsgrenze — die Zusage trägt die Datenbank. Der Eintrag wird trotzdem
mit umgestellt, weil eine Fläche, die die RLS freigibt und die Navigation
verbirgt, schlechter ist als beides zu.

### D6 — Der Volltext bekommt eine zweite, magere Fassung

**Der Befund, der diesen Change beinahe zu einem Leck gemacht hätte.**
`search_doc` (`20260613170000_directory_search.sql:55`) enthält
`competencies` **und** `interests`. Die Volltextklausel in `search_directory`
bindet die Suche heute nur an die **Aktivierung** des Aufrufers, nicht an seine
Stufe:

```sql
and (p_query is null or p_query = ''
     or ((public.is_activated() or p.id = (select auth.uid()))
         and p.search_doc @@ public.suchbegriff_zu_tsquery(p_query)))
```

Solange nur Rang 3 die Liste sieht, ist das folgenlos — wer den Volltext
befragen darf, darf die Felder ohnehin lesen. **Mit der Rang-2-Schwelle wird
daraus ein Orakel:** ein `connect`-Konto könnte „Hat Mitglied X die Kompetenz
Y?" stellen und die Antwort daran ablesen, ob die Zeile stehen bleibt. Es
liest die Spalte nicht — es erfragt sie.

Genau diese Orakelklasse hat AGE-291 für den **Namen** erkannt und geschlossen
(Entscheidung 3 dort: den Volltext ans Namensrecht binden). Dieser Change
öffnete sie für Kompetenzen und Interessen wieder, und er widerspräche damit
seiner eigenen Zusage, dass ein Filter auf maskierten Spalten leer liefert —
der Volltext ist funktional so ein Filter, und er lieferte eben nicht leer.

**Entscheidung:** Ein **zweiter tsvector** über ausschließlich Basisfelder
(`name`, `company`, `region`, `short_bio`, `branche`). Aufrufer unterhalb Rang 3
werden gegen diesen geprüft, ab Rang 3 gilt weiterhin `search_doc`. Die Bindung
folgt der Form aus AGE-291.

**Warum nicht das Orakel als gewollt erklären?** Weil es der einzige Weg wäre,
der zum Rest dieses Changes nicht passt: Wir maskieren die Spalte in der
Ausgabe und liessen sie über die Suche abfragbar. Eine Zusage, die man
umgehen kann, ist keine.

### D7 — `branche` wird ein Basisfeld, statt still zu verschwinden

`search_directory` liefert heute `branche` aus `public.profiles` und filtert mit
`p_branche` darauf. `profiles_public` enthält die Spalte **nicht**. Nach D1
bekäme ein `connect`-Konto `branche` also still als NULL, und der
Branchenfilter liefe leer — ohne dass Spec, Szenarien oder Oberflächen-Hinweis
davon wüssten. Die Aufzählung der maskierten Spalten nannte `branche` nicht,
die der betroffenen Filter `p_branche` nicht.

**Entscheidung:** `branche` kommt in `profiles_public`. Sie ist ein
Verzeichnis-Facet und steht auf den Karten — sie gehört zu den Basisfeldern,
nicht zu den erweiterten. Damit bleibt die Maskierungsliste vollständig und der
Branchenfilter funktioniert auf jeder Stufe, die die Liste sieht.

**Das ist eine Erweiterung dessen, was `profiles_public` preisgibt**, und damit
sichtbar für **jedes** aktivierte Mitglied, auch unterhalb der
Verzeichnisschwelle. Das ist vertretbar — `name`, `company`, `region` und
`short_bio` stehen dort bereits, und die Branche ist von derselben Art — aber
es ist eine Entscheidung und keine Aufräumarbeit, deshalb steht sie hier.

## Risks / Trade-offs

**[Die Rang-3-Grenze wird beim Einziehen der Rang-2-Schwelle mitgenommen]** →
Das ist der teuerste denkbare Fehler dieses Changes: er sähe wie ein Erfolg
aus. Gegenmittel ist eine **Positivkontrolle**: die bestehenden
`rls_test.sql`-Zusagen zur Rang-3-Grenze müssen grün bleiben, und ein neuer
pgTAP-Test muss belegen, dass ein `connect`-Konto in der Liste steht **und**
`competencies` leer bekommt. Ein Test, der nur „connect sieht die Liste"
prüft, sieht den Schaden nicht.

**[Die Staffelung wird gegen die falsche Stufe getestet]** → Sechs Stufen, drei
Regeln. Ein Test gegen `basic` und `discover` allein bestätigt die
`connect`→`connect`-Regel nie. Die pgTAP-Abdeckung geht über **alle sechs**
Absenderstufen gegen mindestens `connect` und `impact` als Ziel.

**[Der Welpenschutz wird ohne Flag-Umlegung scharf und niemand rechnet damit]**
→ **Behoben durch D3.** Der zweite Schalter mit Vorgabe `false` sorgt dafür,
dass das Ausrollen nichts umlegt. Der Fluchtweg über ein Match ist gemessen
lebendig, setzt aber voraus, dass beide Seiten Kompass oder Biete/Suche gefüllt
haben.

**[Der ganze Bestand könnte als „neu" gelten]** → `is_new_member` liest
`profiles.created_at`, und der WordPress-Import hat die 72 Bestandsprofile in
**einem** Lauf angelegt. Liegt dieser Lauf weniger als 30 Tage zurück, gelten
**alle** als neu, und ein aktiver Welpenschutz machte praktisch die gesamte
Mitgliedschaft kalt unerreichbar. Das ist **nicht gemessen** und muss es sein,
**bevor** `welpenschutz_aktiv` je auf `true` geht — nicht vor dem Ausrollen,
weil die Vorgabe `false` ist. Steht als eigene Aufgabe. Sollte sich der Verdacht
bestätigen, ist die Frage nicht „schalten oder nicht", sondern ob
`is_new_member` das richtige Datum liest: für importierte Mitglieder ist
`created_at` das Datum des Imports, nicht ihres Beitritts.

**[Ein `connect`-Konto filtert und bekommt leer, ohne zu erfahren warum]** →
Siehe D1. Die Oberfläche braucht denselben Aufstiegs-Hinweis, den
`directory-search` heute für „unterhalb `discover`" kennt — nur an der neuen
Grenze und für die Filter statt für die Liste.

**[Die Aufstiegs-Hinweise nennen weiter `discover`]** → Sie stehen an mehreren
Stellen in `directory-search/spec.md` (Zeilen 434, 489, 497, 747). Nach der
Änderung zeigen sie auf die falsche Stufe. Sie gehören in denselben Delta,
sonst widerspricht die Spec sich selbst.

**[`profiles_public` bleibt offen und jemand hält das später für eine Lücke]**
→ Deshalb wird es als **Nicht-Zusage** geschrieben, nicht weggelassen. Eine
Inventur findet kein fehlendes Gate; sie findet nur, was dasteht.

## Migration Plan

1. **Migration A — Verzeichnis.** `search_directory` neu, mit dem Rang-2-Tor
   und dem Join über `profiles_public`. Die Rang-3-Policy bleibt unberührt.
2. **Migration B — Kontaktanfragen.** Prädikat
   `darf_kontaktanfrage_senden(uuid)` anlegen, Grants ausdrücklich aussprechen
   (neue Funktionen erben nichts), dann `cr_insert_self` neu setzen.
3. **Frontend.** `nav.ts`, der Filter-Hinweis, die Begründung am
   Kontaktanfrage-Knopf.
4. **Ausrollen.** Erst nach `migrate-dev`, dann `migrate-prod` — beides
   getrennt und ausdrücklich.
5. **Das Flag bleibt liegen.** `open_contact` wird in diesem Change **nicht**
   umgelegt.

**Rollback:** Beide Migrationen sind reine Definitionen (`create or replace`,
`drop policy` + `create policy`) ohne Datenmigration. Die Rücknahme ist eine
Gegenmigration, die die alten Rümpfe wiederherstellt; es gibt nichts
nachzuziehen.

## Open Questions

- **Wann wird `open_contact` umgelegt?** Gehört nicht in diesen Change, aber
  ohne diesen Schritt bleibt die Staffelung wirkungslos. Donalds Schalter.
- **Wann wird `welpenschutz_aktiv` umgelegt?** Ebenfalls Donalds Schalter — und
  erst, nachdem das Alter des Bestands gemessen ist (siehe Risiken).
- **Ist `created_at` für importierte Mitglieder das richtige Datum?** Fällt erst
  an, wenn die Messung zeigt, dass der Import innerhalb der 30-Tage-Frist liegt.
  Dann wäre zu entscheiden, ob der Welpenschutz ein eigenes Beitrittsdatum
  braucht. **Nicht Teil dieses Changes**, aber es hängt an ihm.

**Erledigt seit dem Plan-Review:** ob die Filter für `connect` leer laufen oder
verschwinden — entschieden in D5, sie verschwinden.
