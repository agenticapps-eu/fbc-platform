## ADDED Requirements

### Requirement: Ein Admin nimmt ein Mitglied aus dem Verkehr, ohne es zu löschen

Das System SHALL zwei `SECURITY DEFINER`-Funktionen mit `set search_path = ''`
führen, `admin_disable_member(target uuid, grund text default null)` und
`admin_enable_member(target uuid)`, die in ihrem Rumpf `is_admin()` prüfen und
andernfalls mit `42501` abbrechen.

`admin_disable_member` SHALL `profiles.disabled_at` auf `now()` setzen.
`admin_enable_member` SHALL es auf `null` zurücksetzen. Beide SHALL in
**derselben Transaktion** eine Zeile in `admin_audit` schreiben
(`disable_member` / `enable_member`); ein `exception`-Block um dieses INSERT
SHALL NOT bestehen, weil sonst eine Sichtbarkeitsänderung ohne Spur bestehen
könnte.

**Die Sperre SHALL zwei Sperren sein.** `disabled_at` allein hält eine bereits
bestehende Sitzung nicht auf, deren Zugriffe erst an den Policies scheitern —
und es hindert niemanden daran, sich anzumelden. Das System SHALL deshalb
zusätzlich `auth.users.banned_until` setzen, über eine Edge Function mit
`service_role`, weil `auth.users` GoTrue gehört und keiner API-Rolle zum
Schreiben offensteht.

**Die vier Funktionen SHALL NOT `authenticated` zum Aufruf offenstehen.** EXECUTE
SHALL bei `service_role` liegen, damit die Edge Function der **einzige** Eingang
ist. Läge es bei `authenticated`, könnte ein Admin die Datenbankfunktion
unmittelbar aufrufen und einen Zustand erzeugen, in dem `disabled_at` gesetzt ist
und der Ban fehlt — die zugesagte Doppelsperre wäre dann keine Zusage, sondern
eine Gewohnheit.

Das weicht bewusst vom Muster der übrigen `admin_*`-Funktionen ab, die bei
`authenticated` liegen, damit die Abwehr *in* der Funktion prüfbar stattfindet.
Der Unterschied ist, dass diese vier eine Wirkung **ausserhalb** der Datenbank
haben, die die Datenbank nicht selbst herstellen kann. Die `is_admin()`-Prüfung
im Rumpf SHALL dennoch bestehen bleiben: sie ist die zweite Schranke, nicht die
erste.

**Die Datenbank SHALL in BEIDEN Richtungen zuerst kommen**, der Ban danach.
Scheitert der erste Schritt, hat sich nichts geändert, und der Aufrufer bekommt
den übersetzten Fehlercode.

*Geändert am 2026-08-24.* Die erste Fassung schrieb für das Öffnen die
umgekehrte Reihenfolge vor, um zu vermeiden, dass ein Profil sichtbar wird,
während die Anmeldung noch gesperrt ist. Sie erzeugte dafür zwei Zustände, die
dieses Dokument an anderer Stelle ausdrücklich verbietet:

- **Lehnt die Datenbank ab, ist der Ban schon weg.** „Reaktivieren" auf ein
  gelöschtes Profil bricht mit `22023` ab — nach einem vorgezogenen Entbannen
  bleibt „ein gelöschtes Mitglied mit aufgehobener Sperre", also genau das, was
  die Übergangstabelle ausschliessen soll.
- **Die Antwort kommt zu spät.** `admin_restore_member` sagt in `entbannen`
  erst, OB entbannt werden soll; war das Mitglied vor dem Löschen deaktiviert,
  darf die Sperre nicht fallen. Wer vorher entbannt, kann die Antwort nicht mehr
  befolgen.

Der Preis ist der umgekehrte halbe Zustand — sichtbar, aber ausgesperrt. Er ist
über die Oberfläche erreichbar (deaktivieren, dann reaktivieren) und damit die
kleinere Hälfte des Schadens; dieselbe Abwägung wie beim Schliessen, nur
andersherum.

Beide Richtungen SHALL **wiederholbar** sein, solange der Zustand unvollständig
ist. Eine Handlung, die ihren eigenen halben Ausgang nicht heilen kann, ist keine
Handlung, sondern eine Falle.

**Der halbe Zustand SHALL benannt werden, nicht verschwiegen.** Gelingt der
Datenbankteil und scheitert der Ban-Schritt, SHALL die Edge Function mit
**`207`** antworten. Die Oberfläche SHALL daraufhin eine **Warnung** zeigen und
SHALL NOT diesen Ausgang als Erfolg darstellen.

**Verborgen und gesperrt SHALL zusammengehören, und der Statuscode SHALL genau
das ausdrücken:** `200` heisst, dass beide Hälften übereinstimmen, `207`, dass
sie es nicht tun. Welche fehlt, SHALL der Rumpf sagen — beim Schliessen
`{ hidden: true, banned: false }` (unsichtbar, aber anmeldefähig), beim Öffnen
`{ hidden: false, banned: true }` (sichtbar, aber ausgesperrt). Die beiden sind
**nicht** derselbe Zustand aus zwei Richtungen; ein Rumpf, der für beide
dasselbe meldet, sagt für eine der Richtungen das Gegenteil der Wahrheit.

Ein Wiederherstellen, das laut `entbannen` **nicht** entbannen soll, ist
`{ hidden: true, banned: true }` und damit ein **Erfolg**, kein halber Zustand:
das Mitglied ist zurück in der Mitgliedschaft und bleibt deaktiviert. Die
Oberfläche SHALL das als solches melden und SHALL NOT ein schlichtes
„wiederhergestellt" zeigen — sonst sucht jemand den Fehler, der keiner ist.

Die `admin_audit`-Zeile SHALL in diesem Fall dennoch entstehen — sie
protokolliert die Änderung an `disabled_at`, und die hat stattgefunden. Der
Teilfehlschlag SHALL im `payload` vermerkt sein, damit die Spur nicht mehr
behauptet, als geschehen ist.

Ein zweiter Aufruf auf ein bereits deaktiviertes Profil, **dessen Ban steht**,
SHALL mit `22023` abbrechen. `disabled_at` bliebe sonst unverändert, während
eine zweite Protokollzeile eine Änderung behauptet, die nicht stattfand.

Fehlt dagegen der Ban, SHALL derselbe Aufruf **nicht** abbrechen, sondern ihn
nachsetzen. Das ist keine Ausnahme von der Regel darüber, sondern ihre
Anwendung: der Zustand ist unvollständig, und ein Abbruch machte ihn durch die
Oberfläche unheilbar — der Admin müsste erst reaktivieren, um erneut
deaktivieren zu können, und liesse das Konto dabei kurz wieder sichtbar werden.

Ein Admin SHALL sich selbst nicht deaktivieren können; der Versuch SHALL mit
`22023` abbrechen. Ein Verein ohne erreichbaren Admin hat keinen Weg zurück.

#### Scenario: Ein Nicht-Admin kommt nicht durch

- **WHEN** ein Mitglied ohne Admin-Rolle `admin_disable_member()` aufruft
- **THEN** bricht die Funktion mit `42501` ab und `disabled_at` bleibt unverändert

#### Scenario: Deaktivieren macht unsichtbar

- **WHEN** ein Admin ein bestätigtes, öffentliches Mitglied deaktiviert
- **THEN** trägt dessen Profil `disabled_at`, und es erscheint danach weder über
  `profiles_select_self_or_discover`, noch in `profiles_public`, noch über
  `search_directory` — geprüft an allen dreien, nicht an einer

#### Scenario: Ein deaktiviertes Mitglied kommt nicht mehr herein

- **WHEN** ein deaktiviertes Mitglied sich mit seinem gültigen Passwort anmeldet
- **THEN** weist GoTrue die Anmeldung ab, weil `banned_until` in der Zukunft
  liegt — es entsteht gar keine Sitzung

#### Scenario: Das eigene Konto ist nicht deaktivierbar

- **WHEN** ein Admin sich selbst als `target` übergibt
- **THEN** bricht die Funktion mit `22023` ab

#### Scenario: Zweimal deaktivieren ist ein Fehler, keine zweite Protokollzeile

- **WHEN** ein Admin ein bereits deaktiviertes **und gebanntes** Profil erneut
  deaktiviert
- **THEN** bricht die Funktion mit `22023` ab und es entsteht keine zweite
  `admin_audit`-Zeile

#### Scenario: Der halbe Zustand wird als solcher gemeldet

- **GIVEN** ein Bestand, in dem der Auth-Dienst den Ban ablehnt
- **WHEN** ein Admin ein Mitglied deaktiviert
- **THEN** antwortet die Edge Function mit `207` und `banned: false`, das Profil
  trägt `disabled_at`, und die Oberfläche zeigt eine Warnung, die sagt, dass das
  Mitglied unsichtbar ist, sich aber weiterhin anmelden kann — kein Erfolgston

#### Scenario: Der halbe Zustand ist heilbar

- **GIVEN** ein Mitglied mit gesetztem `disabled_at`, dessen Ban fehlt
- **WHEN** ein Admin „deaktivieren" erneut auslöst
- **THEN** bricht die Funktion **nicht** mit `22023` ab, sondern setzt den Ban
  nach — ohne dass das Mitglied dazwischen wieder sichtbar wird

#### Scenario: Reaktivieren stellt beides wieder her

- **WHEN** ein Admin ein deaktiviertes Mitglied wieder freigibt
- **THEN** ist `disabled_at` null, `banned_until` ist aufgehoben, das Profil
  erscheint wieder im Verzeichnis, und in `admin_audit` steht `enable_member`

#### Scenario: Beim Öffnen geht der Ban zuerst

- **GIVEN** ein Bestand, in dem der Auth-Dienst die Entbannung ablehnt
- **WHEN** ein Admin ein deaktiviertes Mitglied freigibt
- **THEN** bleibt `disabled_at` gesetzt, das Profil bleibt unsichtbar, und die
  Handlung „reaktivieren" wird weiterhin angeboten — es entsteht **kein**
  Zustand, in dem das Profil sichtbar ist und die Anmeldung noch gesperrt

#### Scenario: Ein direkter Datenbankaufruf ist kein Weg vorbei

- **WHEN** ein Admin mit einer gewöhnlichen Sitzung `admin_disable_member`
  unmittelbar über die Datenbank-API aufruft
- **THEN** wird der Aufruf abgewiesen, weil EXECUTE nicht bei `authenticated`
  liegt — der Zustand „unsichtbar, aber nicht gesperrt" entsteht nicht aus
  Versehen

#### Scenario: Beide Richtungen hinterlassen eine Spur

- **WHEN** ein Admin ein Mitglied deaktiviert und danach wieder freigibt
- **THEN** stehen zwei Zeilen in `admin_audit`, jede mit dem handelnden Admin
  als `actor` und dem Mitglied als `target`

### Requirement: Ein Admin entfernt ein Mitglied, ohne seine Zeile zu löschen

Das System SHALL zwei `SECURITY DEFINER`-Funktionen mit `set search_path = ''`
führen, `admin_delete_member(target uuid, grund text default null)` und
`admin_restore_member(target uuid)`, die `is_admin()` prüfen und andernfalls mit
`42501` abbrechen.

`admin_delete_member` SHALL `profiles.deleted_at` setzen und **SHALL NOT** eine
Zeile aus `profiles` oder `auth.users` entfernen. Ein entferntes Mitglied SHALL
in keiner Fläche erscheinen ausser der Admin-Ansicht „Gelöscht", und von dort
SHALL es wiederherstellbar sein.

Löschen SHALL die Sperren des Deaktivierens **mitbringen**, nicht ersetzen: ein
gelöschtes Mitglied SHALL sich ebenfalls nicht anmelden können. Ein Admin, der
löscht, ohne vorher zu deaktivieren, SHALL kein Konto hinterlassen, das noch
hereinkommt.

**`admin_delete_member` SHALL `disabled_at` dabei NICHT verändern.** `deleted_at`
gatet selbstständig — sowohl die Sichtbarkeit als auch den Ban. Setzte das
Löschen zusätzlich `disabled_at`, ginge die Information verloren, ob das
Mitglied **vor** dem Löschen bereits deaktiviert war, und das Wiederherstellen
hätte keine richtige Antwort mehr: `deleted_at` allein zu leeren liesse einen
zuvor aktiven Menschen deaktiviert zurück, beide zu leeren gäbe einem zuvor
gesperrten seinen Zugang zurück. Ein Feld, das zwei Sachverhalte trägt, kann
keinen davon zurückgeben.

`admin_restore_member` SHALL entsprechend `deleted_at` leeren und den Ban **nur
dann** aufheben, wenn `disabled_at` null ist. War das Mitglied vor dem Löschen
deaktiviert, ist es danach wieder deaktiviert — und nichts sonst.

Ein Admin SHALL sich selbst nicht löschen können (`22023`).

**Was das Mitglied hinterlassen hat, SHALL stehen bleiben.** Beiträge,
Kommentare und Anmeldungen SHALL nicht mitgelöscht werden. Ein Beitrag, der aus
einem Gesprächsfaden verschwindet, in dem andere geantwortet haben, verändert
fremde Beiträge.

Der endgültige Entzug — Zeilen wirklich löschen, Auskunft nach DSGVO — SHALL
NOT Teil dieser Anforderung sein und bleibt `add-dsgvo-compliance`.

#### Scenario: Die Zeile bleibt bestehen

- **WHEN** ein Admin ein Mitglied löscht
- **THEN** existiert seine Zeile in `profiles` und in `auth.users` weiterhin und
  trägt `deleted_at`

#### Scenario: Gelöschte sind nirgends gelistet

- **WHEN** ein gelöschtes Mitglied über Verzeichnis, `profiles_public`,
  `search_directory` und die Teilnehmerliste einer Veranstaltung gesucht wird
- **THEN** erscheint es in keiner davon

#### Scenario: Löschen schliesst auch den Zugang

- **WHEN** ein Admin ein **aktives, nicht deaktiviertes** Mitglied löscht
- **THEN** kann dieses sich danach nicht mehr anmelden

#### Scenario: Wiederherstellen bringt es zurück

- **WHEN** ein Admin ein **aktives** Mitglied löscht und danach wiederherstellt
- **THEN** ist `deleted_at` null, `disabled_at` ist null, der Ban ist aufgehoben,
  das Mitglied erscheint wieder, und in `admin_audit` steht `restore_member`

#### Scenario: Wiederherstellen gibt keinen Zugang zurück, den es nicht gab

- **WHEN** ein Admin ein **bereits deaktiviertes** Mitglied löscht und danach
  wiederherstellt
- **THEN** ist `deleted_at` null, `disabled_at` steht **unverändert** auf seinem
  ursprünglichen Zeitpunkt, der Ban bleibt bestehen, und das Mitglied ist
  weiterhin unsichtbar — der Zustand vor dem Löschen, nicht ein besserer

#### Scenario: Beiträge überleben ihr Mitglied

- **WHEN** ein Mitglied gelöscht wird, das einen Beitrag mit Kommentaren anderer
  geschrieben hat
- **THEN** sind Beitrag und Kommentare weiterhin lesbar

### Requirement: Eine Rolle überlebt den Entzug des Zugangs nicht

Das System SHALL `is_admin()` und `is_matching_manager()` zusätzlich davon
abhängig machen, dass das aufrufende Konto **zugangsberechtigt** ist — aktiviert,
nicht deaktiviert, nicht gelöscht. Eine Zeile in `staff_roles` SHALL NOT allein
genügen.

**Warum das hierher gehört und nicht in einen Nachtrag:** ohne diese Bedingung
ist das Deaktivieren eines Admins wirkungslos gegenüber genau den Flächen, die
am meisten preisgeben. `is_admin()` liest heute ausschliesslich `staff_roles`;
die `SECURITY DEFINER`-Funktionen `admin_get_profile`, `admin_find_profile`,
`admin_update_profile`, `admin_list_members` und die Lesepolicy auf
`admin_audit` prüfen nichts darüber hinaus. Ein deaktivierter Admin mit noch
gültigem Token könnte damit weiterhin fremde Profile lesen und ändern, die
Mitgliedschaft aufzählen und das Protokoll mitlesen — während die gewöhnliche
RLS ihm bereits alles verweigert. Die Fähigkeit, jemanden auszuschliessen, wäre
für die am höchsten privilegierte Gruppe die einzige, die nicht wirkt.

Dass heute **jeder** Admin und jeder Matching-Manager in beiden Datenbanken
aktiviert ist, SHALL geprüft sein, bevor die Bedingung greift — die
Verschärfung sperrt sonst denjenigen aus, der sie zurücknehmen müsste.

Ein Admin SHALL sich weiterhin nicht selbst deaktivieren oder löschen können;
zusammen halten die beiden Regeln den Verein davon ab, ohne erreichbaren Admin
dazustehen.

#### Scenario: Ein deaktivierter Admin ist kein Admin mehr

- **GIVEN** ein Admin, der deaktiviert wurde, mit einem noch gültigen Token
- **WHEN** er `admin_list_members`, `admin_get_profile` oder
  `admin_update_profile` aufruft
- **THEN** bricht jeder dieser Aufrufe mit `42501` ab

#### Scenario: Auch das Protokoll bleibt ihm verschlossen

- **GIVEN** derselbe deaktivierte Admin
- **WHEN** er `admin_audit` liest
- **THEN** liefert die Abfrage null Zeilen

#### Scenario: Ein gelöschter Matching-Manager triagiert nicht mehr

- **GIVEN** ein Matching-Manager, dessen Konto gelöscht wurde
- **WHEN** er die Zuteilungsliste liest oder einen Eintrag ändern will
- **THEN** wird beides verweigert

#### Scenario: Die Verschärfung sperrt keinen bestehenden Admin aus

- **WHEN** vor dem Wirksamwerden geprüft wird, ob ein Admin oder
  Matching-Manager ohne `activated_at` besteht
- **THEN** gibt es keinen — die Prüfung ist Teil der Abnahme und nicht eine
  Annahme

### Requirement: Ein entferntes Mitglied wird zur Zahlungsart und zum Zeitpunkt geführt

Das System SHALL in `profile_legacy` eine Spalte `payment_type text` führen, die
auf genau acht Werte eingeschränkt ist: `rechnung`, `stripe`, `copecart`,
`paypal`, `digistore24`, `ehren`, `partner`, `offen`. Ein anderer Wert SHALL die
Einschränkung verletzen und abbrechen; `null` SHALL zulässig bleiben und
„nicht erfasst" bedeuten.

Die Einschränkung SHALL in der Datenbank stehen und SHALL NOT allein in der
Oberfläche bestehen. Eine Zahlungsart, die nur ein Auswahlfeld kennt, ist beim
nächsten Skript ein freier Text.

`admin_update_profile` SHALL `payment_type` in ihre Weissliste aufnehmen, damit
die Änderung denselben Weg und dieselbe Spur nimmt wie `paid_until`.

`paid_until` SHALL weiterhin in `profile_legacy` liegen und SHALL NOT nach
`profiles` wandern: dort kostete jede Spalte einen Grant, den Golden-Snapshot
und die Preisgabe ab Stufe `discover`.

#### Scenario: Eine unbekannte Zahlungsart wird abgewiesen

- **WHEN** `payment_type` auf `'bitcoin'` gesetzt wird
- **THEN** bricht die Datenbank ab — nicht die Oberfläche

#### Scenario: Nicht erfasst ist ein zulässiger Zustand

- **WHEN** ein Mitglied ohne belegte Zahlungsart gespeichert wird
- **THEN** bleibt `payment_type` null und die Fläche zeigt „nicht erfasst",
  nicht eine geratene Zahlungsart

#### Scenario: Die Änderung nimmt den Weg über die Spur

- **WHEN** ein Admin `payment_type` über `admin_update_profile` ändert
- **THEN** steht die Änderung in `admin_audit` im `payload`, wie `paid_until`
  auch

### Requirement: Jeder Übergang hat genau einen definierten Ausgang

Das System SHALL für jede der vier Lebenszyklus-Handlungen und jeden
Ausgangszustand festlegen, was geschieht. Ein Übergang ohne festgelegten Ausgang
ist keine Lücke in der Dokumentation, sondern eine im Verhalten: er endet
entweder in einer Protokollzeile über eine Änderung, die nicht stattfand, oder
in einem Fehler, den die Oberfläche nicht erwartet.

Zustand ist das Paar `(disabled_at, deleted_at)` zuzüglich der Frage, ob der Ban
gesetzt ist.

| Ausgangszustand | deaktivieren | reaktivieren | löschen | wiederherstellen |
|---|---|---|---|---|
| aktiv | setzt `disabled_at` + Ban | `22023` | setzt `deleted_at` + Ban | `22023` |
| deaktiviert, Ban gesetzt | `22023` | hebt beides auf | setzt `deleted_at`, lässt `disabled_at` | `22023` |
| deaktiviert, **Ban fehlt** | **setzt den Ban nach** | hebt beides auf | setzt `deleted_at` | `22023` |
| gelöscht | `22023` | `22023` | `22023` | leert `deleted_at`; entbannt nur, wenn `disabled_at` null |
| Ziel existiert nicht | `P0002` | `P0002` | `P0002` | `P0002` |
| Ziel ist der Aufrufer selbst | `22023` | — | `22023` | — |

Die Zeile „deaktiviert, Ban fehlt" ist der Grund für die Tabelle: sie ist der
einzige Fall, in dem dieselbe Handlung auf denselben sichtbaren Zustand nicht
abbricht, sondern nacharbeitet.

„Reaktivieren" auf ein gelöschtes Profil SHALL abbrechen und SHALL NOT
stillschweigend nur `disabled_at` leeren — das Ergebnis wäre ein gelöschtes
Mitglied mit aufgehobener Sperre, also genau der Zustand, den beide Handlungen
ausschliessen sollen.

**Jeder Übergang SHALL die Zeile sperren, die er liest** (`select … for update`
oder ein bedingtes `update … returning`). Zwei gleichzeitige Aufrufe SHALL NOT
zwei Protokollzeilen über eine Änderung erzeugen, die einmal stattfand.

Eine `admin_audit`-Zeile SHALL genau dann entstehen, wenn sich in derselben
Transaktion ein Feld **tatsächlich geändert** hat. Das Nachsetzen eines fehlenden
Bans SHALL keine zweite Zeile über eine Sichtbarkeitsänderung schreiben, sondern
den Nachtrag als solchen vermerken.

#### Scenario: Reaktivieren greift bei einem gelöschten Profil nicht

- **WHEN** ein Admin `admin_enable_member` auf ein gelöschtes Profil aufruft
- **THEN** bricht die Funktion mit `22023` ab und `deleted_at` bleibt gesetzt

#### Scenario: Wiederherstellen greift bei einem nicht gelöschten Profil nicht

- **WHEN** ein Admin `admin_restore_member` auf ein Profil ohne `deleted_at`
  aufruft
- **THEN** bricht die Funktion mit `22023` ab

#### Scenario: Ein nicht existierendes Ziel meldet sich als solches

- **WHEN** eine der vier Funktionen mit einer unbekannten `uuid` aufgerufen wird
- **THEN** bricht sie mit `P0002` ab — nicht mit einer stillen Nulländerung

#### Scenario: Zwei gleichzeitige Aufrufe schreiben eine Zeile, nicht zwei

- **WHEN** zwei Aufrufe von `admin_disable_member` auf dasselbe Ziel gleichzeitig
  laufen
- **THEN** gelingt genau einer, der andere bricht mit `22023` ab, und in
  `admin_audit` steht genau eine Zeile

### Requirement: Die Admin-Mitgliederfläche führt Handlungen in einem Menü je Zeile

Das System SHALL die Handlungen einer Zeile in einem Menü führen, das über eine
Schaltfläche am Zeilenende geöffnet wird, statt sie als einzelne Knöpfe
nebeneinanderzustellen.

Das Menü SHALL nur anbieten, was auf die jeweilige Zeile anwendbar ist:
„direkt aktivieren" SHALL NOT an bestätigten Zeilen erscheinen, „reaktivieren"
SHALL nur an deaktivierten. Einen Knopf anzubieten, dessen einziger Ausgang ein
Fehler ist, ist eine Einladung zum Fehlklick.

„deaktivieren" SHALL NOT an einer bereits deaktivierten Zeile erscheinen,
**deren Ban steht** — dort wäre `22023` der einzige Ausgang. **Fehlt der Ban,
SHALL es erscheinen**, denn dann ist der Aufruf kein Fehler, sondern der
Nachsetz-Weg aus der Anforderung weiter oben. Ohne diese Unterscheidung
widersprechen sich die beiden Zusagen: der halbe Zustand sieht in der Liste aus
wie jede andere deaktivierte Zeile, und die Handlung könnte ihren eigenen
halben Ausgang nicht heilen — nach der Formulierung dieses Dokuments also
„keine Handlung, sondern eine Falle".

Damit die Fläche das unterscheiden kann, SHALL die Mitgliederliste den
Ban-Zustand je Zeile mitliefern. Ein **abgelaufener** Ban SHALL NOT als Ban
zählen.

Für eine **gelöschte** Zeile besteht kein solcher Weg: die Übergangstabelle
bricht „löschen" dort in jedem Fall ab. Das Menü SHALL ihn folglich nicht
anbieten und SHALL NOT einen erfinden.

**Deaktivieren und Löschen SHALL je eine Rückfrage verlangen**, die das Mitglied
**namentlich** nennt und die Folge benennt. Beide sind umkehrbar, aber beide
nehmen einem Menschen den Zugang; eine optische Trennung allein SHALL NOT als
Schutz gelten.

Das Menü SHALL mit der Tastatur bedienbar sein und SHALL sich beim Verlassen
schliessen.

#### Scenario: Das Menü zeigt nur Anwendbares

- **WHEN** ein Admin das Menü einer bereits deaktivierten Zeile öffnet, deren
  Ban steht
- **THEN** steht dort „reaktivieren", aber nicht „deaktivieren"

#### Scenario: Der fehlende Ban macht die Handlung wieder sichtbar

- **GIVEN** eine deaktivierte Zeile, deren Ban fehlt — der halbe Zustand nach
  einem `207`
- **WHEN** ein Admin ihr Menü öffnet
- **THEN** steht dort „deaktivieren", und ein Aufruf setzt den Ban nach, statt
  mit `22023` abzubrechen

#### Scenario: Wiederherstellen weckt eine Deaktivierung nicht auf

- **GIVEN** ein Mitglied, das erst deaktiviert und danach gelöscht wurde
- **WHEN** ein Admin „wiederherstellen" auslöst
- **THEN** ist `deleted_at` geleert, `disabled_at` steht weiter, die Sperre
  bleibt bestehen — und die Oberfläche meldet „bleibt deaktiviert" statt eines
  schlichten „wiederhergestellt"

#### Scenario: Deaktivieren fragt namentlich nach

- **WHEN** ein Admin „deaktivieren" auslöst
- **THEN** erscheint eine Rückfrage, die das Mitglied beim Namen nennt und sagt,
  dass es sich danach nicht mehr anmelden kann

#### Scenario: Abbrechen ändert nichts

- **WHEN** ein Admin die Rückfrage zum Löschen abbricht
- **THEN** bleibt `deleted_at` unverändert und es entsteht keine
  `admin_audit`-Zeile

### Requirement: Die Admin-Mitgliederfläche trennt die Zustände in Reiter

Das System SHALL unter `/admin/mitglieder` fünf Reiter führen: **Alle**,
**Nicht aktiviert**, **Deaktiviert**, **Gelöscht** und **Mitgliedschaft**.

**Die Reiter sind NICHT die fünf `p_status`-Werte**, und die Abbildung SHALL
ausdrücklich festgeschrieben sein statt vermutet:

| Reiter | `p_status` | Darstellung |
|---|---|---|
| Alle | `alle` | Verwaltung |
| Nicht aktiviert | `offen` | Verwaltung |
| Deaktiviert | `deaktiviert` | Verwaltung |
| Gelöscht | `geloescht` | Verwaltung |
| Mitgliedschaft | `alle` | **Mitgliedschaft** |

„Mitgliedschaft" ist damit ein **Darstellungsmodus über derselben Menge wie
„Alle"**, kein eigener Filter. Der Wert `aktiviert` bleibt bestehen, hat aber
keinen Reiter: er ist über die Funktion erreichbar und wird von der Fläche
derzeit nicht benutzt. Das ist zu benennen und nicht zu verschweigen — ein
Parameterwert ohne Aufrufer sieht sonst wie ein vergessener aus.

**Deaktivierte und Gelöschte SHALL NOT unter „Alle" erscheinen.** „Alle" meint
die Mitgliedschaft, nicht den Datenbestand; ein entferntes Mitglied zwischen den
aktiven zu führen, macht jede Zählung auf dieser Fläche unbrauchbar. Für
„Mitgliedschaft" gilt dasselbe: wer nicht mehr dabei ist, hat keinen
Zahlungszeitraum, der noch etwas bedeutet.

Der Reiter „Mitgliedschaft" SHALL je Mitglied Stufe, `paid_until` und
`payment_type` zeigen. **Änderbar SHALL dabei nur `paid_until` und
`payment_type` sein; die Stufe SHALL hier nur lesbar sein.** Ein Stufenwechsel
berührt Rechte und Preise und hat einen eigenen Weg (AGE-516); ihn nebenbei in
einer Tabellenzeile zu erlauben, wäre die folgenreichste Änderung auf dieser
Fläche und zugleich die unauffälligste.

Ein Mitglied ohne `paid_until` SHALL ein LEERES Feld zeigen und SHALL NOT ein
geratenes Datum tragen. Das leere Feld ist die Auskunft; ein Wort daneben SHALL
NOT dieselbe Aussage ein zweites Mal machen.

*Geändert am 24.08. auf Donalds Befund an der laufenden Fläche.* Die erste
Fassung verlangte das Wort „unbekannt" neben dem Feld. Sie war für eine reine
Anzeige geschrieben; im Reiter steht dort aber ein Eingabefeld, und daneben ein
Auswahlfeld, das mit „nicht erfasst" bereits dasselbe sagt. Schlimmer als die
Dopplung war die Wirkung: das Wort erschien nur an den leeren Zeilen und schob
in jeder von ihnen die folgenden Felder um seine eigene Breite. Die eigentliche
Zusage — **es wird nichts vorbelegt** — hing nie an dem Wort.

Die drei bestehenden Sichten (Tabelle, Karten, Verzeichnis) SHALL erhalten
bleiben und SHALL innerhalb der Reiter umschaltbar sein.

Der gewählte Reiter SHALL in der Adresse stehen, damit ein Neuladen ihn nicht
verliert.

#### Scenario: Deaktivierte stehen nicht unter „Alle"

- **WHEN** ein Admin den Reiter „Alle" über einem Bestand öffnet, der ein
  deaktiviertes Mitglied enthält
- **THEN** erscheint dieses dort nicht, sondern nur unter „Deaktiviert"

#### Scenario: Ein Mitglied ohne bezahlt-bis wird nicht geraten

- **WHEN** der Reiter „Mitgliedschaft" ein Mitglied ohne `paid_until` zeigt
- **THEN** bleibt das Feld leer und trägt kein Datum — und kein Wort daneben
  wiederholt die Auskunft

#### Scenario: Der Reiter überlebt ein Neuladen

- **WHEN** ein Admin den Reiter „Gelöscht" wählt und die Seite neu lädt
- **THEN** steht er wieder auf „Gelöscht"

#### Scenario: Die Stufe lässt sich hier nicht ändern

- **WHEN** ein Admin im Reiter „Mitgliedschaft" die Stufe eines Mitglieds
  ansieht
- **THEN** wird sie angezeigt, aber nicht als Eingabefeld angeboten

#### Scenario: „Mitgliedschaft" zeigt dieselbe Menge wie „Alle"

- **WHEN** ein Admin zwischen „Alle" und „Mitgliedschaft" umschaltet
- **THEN** stehen dieselben Mitglieder in beiden — deaktivierte und gelöschte in
  keinem von beiden

## MODIFIED Requirements

### Requirement: Ein Admin listet Mitglieder über eine Funktion, die unbestätigte einschliesst

Das System SHALL eine `SECURITY DEFINER`-Funktion
`admin_list_members(p_query text default null, p_status text default null,
p_limit int default 50, p_offset int default 0)` mit `set search_path = ''`
führen, die in ihrem Rumpf `is_admin()` prüft und andernfalls mit `42501`
abbricht.

**Alle vier Parameter SHALL einen Vorgabewert tragen.** Ohne ihn meldet Postgres
für einen argumentlosen Aufruf „function does not exist" statt der Prüfung, die
diese Anforderung zusagt — der Aufrufer bekäme also einen anderen Fehler als den
zugesicherten.

Sie SHALL Profile **unabhängig von `activated_at`, `disabled_at` und
`deleted_at`** zurückgeben können. Das ist ihr Zweck: alle drei Felder schalten
Sichtbarkeit ab, und diese Funktion ist die einzige Fläche, auf der ein so
abgeschaltetes Mitglied noch vorkommt.

`p_status` SHALL genau fünf Werte kennen: `alle`, `aktiviert`, `offen`,
`deaktiviert`, `geloescht`. Ein **unbekannter** Wert SHALL mit `22023` abbrechen
und SHALL NOT stillschweigend wie `alle` wirken — ein vertippter Filter, der
alles zeigt, sieht aus wie ein leerer Filter.

**`alle`, `aktiviert` und `offen` SHALL Deaktivierte und Gelöschte
ausschliessen.** Sie beantworten Fragen über die Mitgliedschaft, und ein
entferntes Mitglied gehört nicht dazu. `deaktiviert` SHALL genau die mit
gesetztem `disabled_at` und ohne `deleted_at` liefern, `geloescht` genau die mit
gesetztem `deleted_at` — unabhängig davon, ob sie zusätzlich deaktiviert sind,
weil Löschen die Sperre mitbringt und beide Reiter sonst dieselben Zeilen
zeigten.

`p_query` SHALL über `login_email` und `name` suchen, ohne Rücksicht auf
Gross- und Kleinschreibung, und SHALL bei `null` oder leer nicht filtern. Eine
Mindestlänge SHALL NOT bestehen.

Sie SHALL je Zeile `bestaetigt` als `(activated_at is not null)` mitliefern,
damit die Fläche den Zustand anzeigen kann, ohne ihn zu erraten, und zusätzlich
`deaktiviert_seit` und `geloescht_seit` als die beiden Zeitstempel. **Zeitpunkte,
nicht Wahrheitswerte:** die Fläche soll sagen können, seit wann — und ein
Wahrheitswert liesse sich nicht nachträglich zu einem Zeitpunkt erweitern, ohne
jeden Aufrufer zu ändern.

Sie SHALL für den Reiter „Mitgliedschaft" zusätzlich `paid_until` und
`payment_type` mitliefern. Beide stehen in `profile_legacy` und SHALL über einen
`left join` kommen, damit ein Mitglied ohne Altdatenzeile nicht aus der Liste
fällt.

**Die Funktion SHALL abgeworfen und neu angelegt werden, nicht ersetzt.**
`create or replace function` kann den Rückgabetyp einer bestehenden Funktion
nicht ändern und bricht mit „cannot change return type of existing function" ab;
die neuen Spalten ändern ihn. Mit dem Abwurf SHALL die Migration Grants,
Kommentar und Parameter-Vorgabewerte **wiederherstellen** — ein `drop` nimmt sie
mit, und ein fehlender Vorgabewert bringt für einen argumentlosen Aufruf wieder
„function does not exist" statt der zugesicherten `42501`.

**Die Verbindung zu `auth.users` SHALL geprüft sein.** Sie ist heute ein
`join`, kein `left join`: ein Profil ohne Zeile in `auth.users` fiele lautlos
aus der Liste — auf genau der Fläche, die entstanden ist, weil Mitglieder
anderswo lautlos fehlten. Ob solche Zeilen bestehen können, SHALL an der
Datenbank geprüft und das Ergebnis festgehalten werden; die Verbindungsart
SHALL der Antwort folgen und nicht der Gewohnheit.

Sie SHALL `login_email` mitliefern und SHALL NOT Spalten aus `profile_contacts`
liefern. Die Anmeldeadresse identifiziert das Konto; die Kontaktdaten sind das,
was der Rest des Systems hinter Kontaktanfragen hält.

Sie SHALL blättern: `p_limit` und `p_offset` SHALL die Ergebnismenge begrenzen
und verschieben, und die Fläche SHALL sie benutzen.

Die Reihenfolge SHALL **unbestätigte zuerst**, dann nach `name`, dann nach `id`
sortieren. Der Stichentscheid über `id` ist nicht schmückend: nach `name` allein
ist die Reihenfolge bei Namensdubletten und bei `null` nicht bestimmt, und eine
unbestimmte Reihenfolge lässt Zeilen zwischen zwei Seitenaufrufen verschwinden
oder doppelt erscheinen.

Ihre übrigen Spalten SHALL denen von `search_directory` entsprechen, damit die
Verzeichnis-Ansicht die vorhandene Karte speist statt sie nachzubauen. Diese
Übereinstimmung SHALL geprüft werden — die Projektion besteht damit zweimal und
liefe sonst still auseinander. Geprüft SHALL **beides** werden: die Spaltenliste,
und für ein bestätigtes Mitglied der Zeileninhalt beider Funktionen.

Platzhalterzeichen des Mustervergleichs SHALL die Funktion entschärfen.

#### Scenario: Ein Nicht-Admin bekommt nichts

- **WHEN** ein Mitglied ohne Admin-Rolle `admin_list_members()` ohne Argumente aufruft
- **THEN** bricht die Funktion mit `42501` ab — nicht mit „function does not
  exist", und nicht mit einer leeren Liste, die wie ein leerer Verein aussähe

#### Scenario: Ein unbestätigtes Mitglied steht in der Liste

- **WHEN** ein Admin die Liste über einen Bestand aufruft, in dem ein Profil
  `activated_at is null` trägt
- **THEN** ist dieses Profil enthalten und trägt `bestaetigt = false`

#### Scenario: Der Status-Filter trennt die beiden Gruppen

- **WHEN** ein Admin `p_status = 'offen'` über einen Bestand aus bestätigten und
  unbestätigten Mitgliedern aufruft
- **THEN** kommen genau die unbestätigten zurück; mit `'aktiviert'` genau die
  bestätigten; mit `'alle'` und mit `null` alle — in allen drei Fällen ohne
  deaktivierte und ohne gelöschte

#### Scenario: Entfernte Mitglieder haben eigene Filter

- **WHEN** ein Admin `p_status = 'deaktiviert'` und danach `'geloescht'` über
  einen Bestand aufruft, der von beidem je eines enthält
- **THEN** liefert jeder Aufruf genau das zugehörige Mitglied, und ein Mitglied,
  das gelöscht **und** deaktiviert ist, erscheint unter `geloescht`

#### Scenario: Ein unbekannter Status ist ein Fehler, keine stille Vollansicht

- **WHEN** ein Admin `p_status = 'offfen'` übergibt
- **THEN** bricht die Funktion mit `22023` ab

#### Scenario: Die Suche findet über Name und Anmeldeadresse

- **WHEN** ein Admin einen Teil eines Namens übergibt, und getrennt davon einen
  Teil einer Anmeldeadresse
- **THEN** liefert jeder der beiden Aufrufe das zugehörige Mitglied, unabhängig
  von Gross- und Kleinschreibung

#### Scenario: Kontaktdaten kommen nicht vor

- **WHEN** die Spaltenliste der Funktion untersucht wird
- **THEN** enthält sie `login_email`, aber keine Spalte aus `profile_contacts` —
  weder Adresse noch Telefonnummer. Geprüft wird die **Spaltenliste**, nicht ein
  Beispieldatensatz: ein leeres Feld sähe sonst aus wie ein fehlendes

#### Scenario: Ein Mitglied ohne Altdatenzeile fällt nicht aus der Liste

- **WHEN** ein Admin die Liste über ein Mitglied ohne Zeile in `profile_legacy`
  aufruft
- **THEN** ist es enthalten und trägt `paid_until = null` und
  `payment_type = null`

#### Scenario: Kein Profil fällt still durch die Verbindung

- **WHEN** die Zahl der Zeilen in `profiles` gegen die Zahl der von
  `admin_list_members` gelieferten Zeilen ohne Filter gehalten wird
- **THEN** stimmen beide überein — und weichen sie ab, benennt die Prüfung die
  fehlenden Profile, statt eine kleinere Liste als vollständig auszugeben

#### Scenario: Die neu angelegte Funktion trägt ihre Vorgabewerte wieder

- **WHEN** nach der Migration ein Nicht-Admin `admin_list_members()` ohne
  Argumente aufruft
- **THEN** bricht sie mit `42501` ab — nicht mit „function does not exist", was
  ein beim Abwurf verlorener Vorgabewert verursacht hätte

#### Scenario: Die Seiten schneiden richtig und wiederholbar

- **WHEN** ein Admin die Liste mit `p_limit = 2, p_offset = 2` über fünf
  Mitglieder aufruft, darunter zwei mit gleichem Namen und eines ohne Namen
- **THEN** kommen genau die Mitglieder drei und vier zurück, und ein zweiter
  Aufruf liefert dieselben zwei in derselben Reihenfolge

#### Scenario: Ein Suchbegriff aus Jokerzeichen findet nicht alles

- **WHEN** ein Admin `%` als Suchbegriff übergibt
- **THEN** wird es als Text gesucht, nicht als Muster — die Funktion liefert die
  Treffer zu diesem Zeichen und nicht die gesamte Mitgliedschaft

#### Scenario: Die Spalten laufen nicht auseinander

- **WHEN** die Spaltenliste von `admin_list_members` gegen die von
  `search_directory` gehalten wird
- **THEN** stimmen die Verzeichnisspalten überein, und eine Abweichung lässt die
  Prüfung fehlschlagen und benennt die abweichende Spalte

#### Scenario: Dieselbe Zeile in beiden Funktionen

- **WHEN** ein **bestätigtes** Mitglied über `admin_list_members` und über
  `search_directory` gelesen wird
- **THEN** stimmen die Werte der Verzeichnisspalten überein — die Prüfung fasst
  damit auch eine Abweichung, die die Spaltennamen unberührt lässt
