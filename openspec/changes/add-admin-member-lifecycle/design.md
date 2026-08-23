# Design — add-admin-member-lifecycle (AGE-581)

## Context

Der Umfang dieses Changes wurde **gemessen, bevor er geschätzt wurde**. Die
naheliegende Annahme — „`activated_at` steht überall, das wird gross" — hätte in
die Irre geführt: `grep` über `supabase/migrations/` findet 86 Vorkommen allein
in `20260806080100_activation_gate.sql`. Das Verzeichnis ist forward-only, ein
`grep` darüber zählt also auch alles, was längst ersetzt wurde.

Eine Abfrage gegen den **echten** Datenbankstand (`pg_policies`,
`pg_get_functiondef`, `pg_get_viewdef` auf DEV, lesend) ergibt ein anderes Bild:

| Träger | Zahl | Direkt oder geerbt |
|---|---|---|
| Policies mit `is_activated()` | ~40 | **geerbt** |
| Policies mit `activated_at is not null` im Prädikat | **1** | direkt (`profiles_select_self_or_discover`) |
| Views | **1** | direkt (`profiles_public`, `security_invoker=off`) |
| Funktionen mit direktem Prädikat | **6** | `is_activated`, `is_activated_profile`, `admin_list_members`, `admin_find_profile`, `event_attendees`, `my_activation_state` |

Damit ist die Aufgabe klein: **zwei Prädikatfunktionen, eine Policy, eine View**
tragen die Änderung, und rund vierzig Policies erben sie.

**Diese Inventur hat aber eine blinde Stelle, und sie war teuer.** Sie findet
nur Stellen, die `activated_at` oder `is_activated` bereits *nennen* — sie kann
nicht finden, wo ein Gate **fehlt**. Der Plan-Review hat genau dort den
schwersten Befund gesetzt: `is_admin()` liest ausschliesslich `staff_roles`.
Ein deaktivierter Admin behielte mit gültigem Token jede Admin-Fähigkeit,
während die gewöhnliche RLS ihm längst alles verweigert — die Fähigkeit,
jemanden auszuschliessen, wirkte ausgerechnet bei der am höchsten privilegierten
Gruppe nicht. `is_matching_manager()` hat dieselbe Lücke.

Beide werden deshalb mitgeändert. Vorher ist zu prüfen, dass jeder bestehende
Rolleninhaber aktiviert ist — sonst sperrt die Verschärfung denjenigen aus, der
sie zurücknehmen müsste. **Geprüft am 23.08.** (`scripts/probe-age581-admins.ts`):
in PROD zwei Admins, in DEV drei Admins und ein Matching-Manager, alle
aktiviert.

## Goals / Non-Goals

**Goals.** Ein Mitglied unsichtbar machen und aussperren; es entfernen, ohne
seine Zeile zu löschen; beides umkehren; Stufe, Zahlungszeitraum und Zahlungsart
an einem Ort **sehen** und die letzten beiden **ändern**.

**Die Stufe ist hier nur lesbar.** Ein Stufenwechsel berührt Rechte und Preise
und hat einen eigenen Weg (AGE-516). Ihn nebenbei in einer Tabellenzeile zu
erlauben, wäre die folgenreichste Änderung auf dieser Fläche und zugleich die
unauffälligste.

**Non-Goals.** Hard-Delete und DSGVO-Auskunft (`add-dsgvo-compliance`).
Massenauswahl und Rundmail (AGE-304). Stufen-Downgrade (AGE-516). Eine
Rollen-Feinsteuerung, wer deaktivieren darf — `is_admin()` bleibt die einzige
Schranke.

## Decisions

### 1. Die Bedingung wandert in die Prädikate, nicht in die Aufrufer

`is_activated()` und `is_activated_profile(uuid)` bekommen
`and disabled_at is null and deleted_at is null`. Rund vierzig Policies rufen
sie und ändern sich nicht.

*Verworfen: jede Policy einzeln umhängen.* Es wäre expliziter, aber es hiesse,
dieselbe Bedingung vierzigmal zu schreiben — und vierzig Gelegenheiten zu
schaffen, sie unterschiedlich zu schreiben. Die Erfahrung dieses Projekts spricht
dagegen: `profiles_public` und die DEFINER-RPCs duplizieren ihr Prädikat bereits,
und genau daraus entstand die Regel, dass jedes neue Gate an drei Stellen
gepflegt werden muss.

*Verworfen: die Funktionen umbenennen* (`has_access()` o. ä.). Der Name
`is_activated()` sagt dann weniger, als die Funktion tut. Aber ein Rename
berührt vierzig Policies — also genau das, was diese Entscheidung vermeidet.

gemini hat im Plan-Review zu Recht eingewandt, dass ein Kommentar eine schwache
Sicherung gegen ein Missverständnis des Namens ist. Der Ausgleich, den gemini
selbst vorschlägt, wird übernommen: der Funktionskommentar beginnt mit einer
ausdrücklichen **Warnung**, dass der Name unvollständig ist, und benennt die
vollständige Bedingung. Der Rename bleibt als Nachfolge-Notiz — wenn die
Policies aus anderem Anlass ohnehin angefasst werden, ist er dort billig.

### 2. Zwei Sperren, und die Reihenfolge hängt von der Richtung ab

`disabled_at` allein hält eine **laufende** Sitzung nicht auf und verhindert
keine Neuanmeldung. `banned_until` allein liesse eine laufende Sitzung
weiterlaufen. Also beides.

Die Reihenfolge ist festgelegt — und sie ist **nicht in beiden Richtungen
dieselbe**. Der erste Entwurf schrieb pauschal „Datenbank zuerst"; das ist nur
fürs Schliessen richtig.

| Richtung | Reihenfolge | Warum |
|---|---|---|
| **Schliessen** (deaktivieren, löschen) | DB, dann Ban | Bricht der Ban ab, ist das Mitglied unsichtbar und kommt noch herein — die kleinere Hälfte des Schadens |
| **Öffnen** (reaktivieren, wiederherstellen) | Ban, dann DB | Andersherum ist das Profil sichtbar, während die Anmeldung noch gesperrt ist — und die Zeile gilt nicht mehr als deaktiviert, also **verschwindet die Handlung aus der Oberfläche**, mit der man es reparieren würde |

Der zweite Punkt ist der eigentliche: nicht die Sichtbarkeit für ein paar
Sekunden, sondern dass der halbe Zustand unerreichbar wird. Dieselbe Überlegung
verlangt, dass **beide Richtungen wiederholbar** sind, solange der Zustand
unvollständig ist. Eine Handlung, die ihren eigenen halben Ausgang nicht heilen
kann, ist eine Falle.

*Gefunden im Plan-Review (codex), bevor eine Zeile Code stand.*

*Verworfen: nur das DB-Gate.* Der Auftrag lautete „kein Login zulassen". Ein
Konto, das sich anmelden kann und dann auf einen Sperrhinweis läuft, hat sich
angemeldet.

`auth.users` gehört GoTrue und steht keiner API-Rolle zum Schreiben offen —
deshalb eine Edge Function mit `service_role` und nicht ein UPDATE in der RPC.
`service_role` hält auf keiner `public`-Tabelle ein Recht (AGE-312), die
Function muss ihren DB-Teil also über die DEFINER-RPC nehmen.

**Und die vier RPCs liegen NICHT bei `authenticated`.** Täten sie es — wie die
übrigen `admin_*`-Funktionen —, könnte ein Admin die Datenbankfunktion direkt
aufrufen und den Ban überspringen; die Doppelsperre wäre dann keine Zusage,
sondern eine Gewohnheit der Oberfläche. EXECUTE liegt deshalb bei
`service_role`, und die Edge Function ist der einzige Eingang. Die
`is_admin()`-Prüfung im Rumpf bleibt trotzdem: sie ist die zweite Schranke.

Das ist eine bewusste Abweichung vom Hausmuster („die Abwehr findet IN der
Funktion statt und ist dort prüfbar"). Sie ist gerechtfertigt, weil diese vier
Funktionen als einzige eine Wirkung **ausserhalb** der Datenbank haben, die die
Datenbank nicht selbst herstellen kann.

### 3. `disabled_at`/`deleted_at` in `profiles`, nicht in `member_settings`

Die Projektregel lautet: eigentümerprivate Spalten gehören nach
`member_settings`, weil jede Spalte in `profiles` einen Grant, einen
Golden-Snapshot-Eintrag und die Preisgabe ab `discover` kostet.

Diese beiden Spalten fallen **nicht** darunter. Sie sind keine
eigentümerprivaten Angaben, sondern Gate-Felder wie `activated_at`, das
ebenfalls in `profiles` steht — und sie müssen von den Prädikatfunktionen und
der Policy auf `profiles` gelesen werden, im selben Zugriff. Die Preisgabe ab
`discover` entfällt zudem: ein Profil mit gesetztem `disabled_at` wird gar nicht
mehr geliefert.

`profiles` trägt `grant select … to authenticated` **tabellenweit** (gemessen,
`20260715140000_explicit_grants.sql:95`), eine neue Spalte kostet also keinen
neuen SELECT-Grant. Der Golden-Snapshot in `grants_test.sql` ist dennoch
mitzupflegen (AGE-455).

### 4. Zeitpunkte, nicht Wahrheitswerte

`disabled_at timestamptz` statt `is_disabled boolean`. Die Fläche soll „seit
wann" sagen können, und ein Wahrheitswert liesse sich später nicht zu einem
Zeitpunkt erweitern, ohne jeden Aufrufer anzufassen. Dieselbe Wahl wie bei
`activated_at`.

### 5. Löschen fasst `disabled_at` nicht an

`admin_delete_member` setzt **nur** `deleted_at`. Der erste Entwurf setzte
`disabled_at` mit — „die Sperre kommt mit" — und zerstörte damit die einzige
Information, die das Wiederherstellen braucht: war dieses Mitglied vorher schon
deaktiviert?

Ohne sie hat `admin_restore_member` keine richtige Antwort. Nur `deleted_at` zu
leeren liesse einen zuvor aktiven Menschen deaktiviert zurück; beide zu leeren
gäbe einem zuvor gesperrten seinen Zugang zurück. Ein Feld, das zwei
Sachverhalte trägt, kann keinen davon zurückgeben.

`deleted_at` gatet stattdessen selbst — Sichtbarkeit **und** Ban. Beim
Wiederherstellen wird entbannt, wenn `disabled_at` null ist, und sonst nicht.

*Ebenfalls aus dem Plan-Review (codex).*

### 6. „Ehemaliges Mitglied" braucht eine eigene, sehr schmale Auskunft

Wenn ein gelöschtes Profil aus `profiles_public` fällt, zeigt der Feed heute
automatisch den Rückfall „Mitglied" (`feed.ts:220`). Das erfüllt „ohne
Verlinkung", aber es macht **zwei Ursachen ununterscheidbar**: „hat sein Profil
nicht öffentlich gestellt" und „ist kein Mitglied mehr" sähen gleich aus — das
Muster, das in diesem Projekt schon zweimal Fehldiagnosen verursacht hat.

Also eine DEFINER-Funktion — aber sie nimmt **Beitrags- und Kommentar-IDs**,
nicht Profil-IDs.

Der erste Entwurf übergab Profil-IDs und versprach, das seien nur solche „aus
einem sichtbaren Beitrag". Das ist eine Zusage, die die Funktion nicht halten
kann: sie sieht nicht, woher der Aufrufer die IDs hat. Jeder Angemeldete hätte
beliebige bekannte IDs durchreichen und erfahren können, wer aus dem Verein
entfernt wurde — also genau das, was das Delta ausschliesst. Nimmt sie
Beitrags-IDs, löst sie den Urheber selbst auf und wendet dabei dasselbe
Sichtbarkeitsprädikat an wie der Beitrag.

*Auch das kam aus dem Plan-Review. Die Zusage stand im Delta, bevor jemand
prüfte, ob die vorgeschlagene Signatur sie tragen kann.*

*Verworfen: `profiles_public` liefert gelöschte mit neutralisiertem Namen.* Dann
stünden sie wieder im Verzeichnis, in der Suche und in jeder Kartenliste. Die
View ist die Verzeichnisprojektion, kein Namensdienst.

*Verworfen: den Rückfalltext pauschal auf „Ehemaliges Mitglied" ändern.* Dann
hiessen auch die zurückgezogenen Mitglieder so, die sehr wohl noch da sind.

### 7. Reiter statt eines Status-Auswahlfelds, und „Alle" heisst nicht „alle Zeilen"

Fünf Reiter: Alle · Nicht aktiviert · Deaktiviert · Gelöscht · Mitgliedschaft.

**Die Reiter sind nicht die fünf Status.** Der erste Entwurf behauptete,
`p_status` „trage" sie — das stimmt nicht: „Mitgliedschaft" ist ein
Darstellungsmodus über derselben Menge wie „Alle", und `aktiviert` hat gar
keinen Reiter. Die Abbildung steht jetzt ausdrücklich im Delta.

**`alle` schliesst Deaktivierte und Gelöschte aus.** Das ist bewusst ein Bruch
mit dem Wort: „Alle" beantwortet „wer ist Mitglied?", nicht „was steht in der
Tabelle?". Ein entferntes Mitglied zwischen den aktiven zu führen, machte jede
Zählung auf dieser Fläche unbrauchbar — und die Fläche existiert, um zu zählen,
wer noch wartet.

Ein gelöschtes **und** deaktiviertes Mitglied erscheint unter `geloescht`, nicht
unter beiden: Löschen bringt die Sperre mit, sonst zeigten beide Reiter nach der
Datenpflege dieselben Zeilen.

### 8. Der Reiter steht in der Adresse

`?tab=geloescht` als Suchparameter. Ohne ihn verlöre ein Neuladen den Reiter —
und diese Fläche wird beim Aufräumen oft neu geladen.

## Risks / Trade-offs

**Das grösste Risiko ist Aussperrung durch Erfolg.** Ändern
`is_activated()`/`is_activated_profile()` ihre Bedingung falsch, verlieren
**alle** Mitglieder gleichzeitig jeden Zugriff — vierzig Policies erben den
Fehler. Gegenmassnahmen: pgTAP-Test, der die drei Zustände (aktiv, deaktiviert,
gelöscht) gegen Policy, View und Verzeichnisfunktion einzeln prüft; und der
bestehende Aktivierungs-Gate-Test muss unverändert grün bleiben.

**Ein Admin kann sich selbst nicht aussperren** — beide Funktionen brechen ab,
wenn `target = auth.uid()`. Das schützt nicht gegen zwei Admins, die einander
deaktivieren; dafür gibt es keine Vorkehrung, und es wäre eine, die niemand
braucht.

**Die Edge Function kann scheitern, während die DB-Änderung steht.** Kein
verteiltes Zurückrollen; stattdessen die festgelegte Reihenfolge (Entscheidung
2) und eine Fehlermeldung, die den halben Zustand benennt statt ihn zu
verschweigen.

**`event_attendees()` und `my_activation_state()`** tragen das Prädikat direkt
und werden mitgeändert: die erste soll entfernte Teilnehmer nicht mehr
auflisten, die zweite muss den Sperrzustand melden können — sonst zeigte die
Oberfläche einem gesperrten Konto den Aktivierungsbildschirm und lüde es ein,
sich einen Link schicken zu lassen.

## Migration Plan

Eine Migration, forward-only, in dieser Reihenfolge:

1. Spalten `disabled_at`, `deleted_at` auf `profiles`; `payment_type` auf
   `profile_legacy` mit `check`-Einschränkung. Keine UPDATE-Grants für
   Client-Rollen.
2. `is_activated()` und `is_activated_profile()` ersetzen.
3. `profiles_select_self_or_discover` und `profiles_public` ersetzen.
4. `admin_list_members` ersetzen (fünf Status, drei neue Spalten).
5. `event_attendees`, `my_activation_state` ersetzen.
6. `admin_disable_member`, `admin_enable_member`, `admin_delete_member`,
   `admin_restore_member`, `former_member_ids` anlegen; Grants ausdrücklich.
7. `admin_update_profile` um `payment_type` in der Weissliste ersetzen.

Danach `grants_test.sql` (Golden-Snapshot) nachziehen.

Die Datenpflege — 59 Zuordnungen, 11 Deaktivierungen, 10 Adresskorrekturen —
läuft **nicht** in dieser Migration, sondern nach dem Merge über ein Skript und
die gebaute Fläche. Eine Migration, die Daten eines bestimmten Vereins zu einem
bestimmten Datum schreibt, wäre auf jeder anderen Instanz falsch.

### 9. Der Ban ist eine Dauer, kein Zeitpunkt — gemessen, nicht angenommen

Die erste Fassung dieses Dokuments führte als offene Frage, ob GoTrue ein
`banned_until` hundert Jahre in der Zukunft annimmt. Die Probe gegen den lokalen
Stack (`scripts/probe-age581-gotrue-ban.ts`, 23.08.) beantwortet das — und
korrigiert die Frage selbst:

| Schritt | Ergebnis |
|---|---|
| Anmeldung vor dem Bann | erfolgreich |
| `ban_duration: "876000h"` (100 Jahre) | **angenommen**, `banned_until = 2126-07-30` |
| Anmeldung nach dem Bann | **abgewiesen, HTTP 400, „User is banned"** |
| `ban_duration: "none"` | hebt auf; Anmeldung klappt wieder |

**Die Admin-API nimmt `ban_duration` als Dauer entgegen, nicht `banned_until` als
Zeitpunkt.** Ein Zeitpunkt hätte sich nicht setzen lassen. Die Spalte heisst so,
das Feld der API nicht — und die Umkehrung ist ein eigener Wert (`"none"`), kein
Nullwert.

Die Wahrheit über den Zustand bleibt dennoch `disabled_at`. `banned_until` ist
die Durchsetzung; ein Zeitstempel hundert Jahre voraus ist keine Aussage, die
sich lesen liesse.

## Open Questions

- **Zwei Adressen aus der Übersicht sind nicht setzbar**: eine trägt kein `@`,
  eine gehört bereits einer anderen Person. Sie bleiben in der Datenpflege
  ausgenommen und werden gemeldet. Einzelheiten in
  `docs/age-581-mitgliederabgleich.md` — hier nicht, weil das Repo öffentlich
  ist.
- **Die Adresse des zweiten Admins** weicht ebenfalls ab. Er ist Admin und
  aktiviert; eine falsch gesetzte Anmeldeadresse sperrt ihn aus der Fläche aus,
  auf der man sie korrigieren würde. Ausgenommen, bis er sie selbst bestätigt.
