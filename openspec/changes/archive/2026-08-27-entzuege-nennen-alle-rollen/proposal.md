# Entzüge nennen alle Rollen, und der service_role-Lockdown wird gemessen

Linear: **AGE-622**

## Why

`main` ist rot, ohne dass sich eine Zeile geändert hat. Belegt, nicht vermutet:
Commit `5d911b9` war am 26.08. um 19:47 grün; **derselbe Commit**, am 27.08. neu
gestartet, lässt `migrations` fallen. Vier pgTAP-Zusagen fallen, alle mit
derselben Form `have: true, want: false` — ein Entzug, der nicht gewirkt hat.

Ausgelöst hat es die Umgebung: `.github/workflows/ci.yml:102` setzt für die
Supabase-CLI `version: latest`. Die Action-SHA ist gepinnt, die CLI und die von
ihr gezogene Datenbank-Abbildung nicht. Eine **neu angelegte** Instanz vergibt
Rechte direkt an die Rolle statt über `public`.

**Der Fehler liegt aber im Repo, nicht in der Umgebung.** Die Anforderung
`Privileges are granted explicitly, inherited by nothing` sagt seit AGE-312
wörtlich: *„Ein Entzug SHALL jede betroffene Rolle namentlich nennen. `revoke …
from public` entfernt einen rollen-eigenen Grant nicht."* Drei Stellen halten
sich nicht daran:

| Objekt | Entzug heute | Rollen, die durchrutschen |
| --- | --- | --- |
| `resolve_display_name(uuid, text)` | `from public` | `anon`, `service_role` |
| `member_state_matches(text, timestamptz, timestamptz, timestamptz)` | `from public, anon` | `authenticated`, `service_role` |
| `staff_roles` | kein Entzug | `service_role` |

Die dritte Spalte trug im ersten Entwurf nur die Rolle, die eine Zusage gerade
fängt — und wandte damit die eigene Regel zu eng an. Die neue Instanz-Sorte
erteilt Default-Grants an `anon`, `authenticated` **und** `service_role`. Der
Befund darüber, was eine Zusage MISST, ist nicht derselbe wie der Befund
darüber, wer ein Recht HÄLT. Aufgefallen ist das in der Plan-Review.

Die vier fallenden Zusagen, aus dem CI-Log:
`grants_test.sql` Test 7 und 8, `rls_test.sql` Test 261,
`admin_member_list_test.sql` Test 73.

`resolve_display_name` kam **gestern** dazu (AGE-583,
`20260826110000_abgestufte_namensaufloesung.sql:81`). Die Anforderung stand da
schon. Die Umgebung hat den Verstoß nicht verursacht, sie hat ihn nur sichtbar
gemacht.

## Die zweite Hälfte — und warum sie NICHT in diesen Change gehört

`rls_test.sql:1865` schreibt einen **Grundsatz** hin — *„service_role hält auf
KEINER Tabelle in `public` ein SELECT/INSERT … alles, was es tut, geht durch
SECURITY-DEFINER-Funktionen"* — und prüft ihn an **einer** Tabelle:
`staff_roles`. Der erste Entwurf dieses Vorschlags wollte das verallgemeinern:
`service_role` flächendeckend die Tabellenrechte entziehen und die Zusage über
alle Tabellen messen.

**Das wäre gefährlich gewesen, und der zitierte Grundsatz ist schlicht falsch.**

`supabase/functions/notify-contact-request/index.ts:91-111` baut seinen Client
mit `SUPABASE_SERVICE_ROLE_KEY` und liest damit **direkt** drei Tabellen:
`profile_contacts`, `profiles`, `contact_requests`. Das ist kein Nebenweg,
sondern die Sicherheitsprüfung der Function: sie vergleicht die behauptete Zeile
gegen die Datenbank, bevor eine Mail hinausgeht. Schlägt der Lesevorgang fehl,
antwortet sie 502 und **die Kontaktanfrage-Mail geht nie hinaus**.

Am lokalen Stack gemessen, mit Positivkontrolle, damit eine Messung aus lauter
`false` nicht vom Leerlauf zu unterscheiden ist:

```
Tabellen in public: 36
davon mit service_role-Recht: 0
  profile_contacts  select=false
  profiles          select=false
  contact_requests  select=false
Gegenprobe authenticated auf profiles: select=true
```

Daraus folgt ein Entweder-oder, das **nicht von hier aus entscheidbar** ist:
entweder PROD ist wie lokal — dann ist dieser Mailweg seit je kaputt — oder PROD
ist die neue Sorte, dann funktioniert er dort, **und ein flächendeckender Entzug
würde ihn brechen**. Wenige Tage vor dem Go-Live ist beides zu teuer, um es zu
raten.

Der flächendeckende Entzug und die verallgemeinerte Zusage sind deshalb aus
diesem Change **entfernt**. Sie gehören hinter zwei Schritte, die es noch nicht
gibt: eine Messung an PROD und den Umbau von `notify-contact-request` auf
`DEFINER`-RPCs. Beides ist ein eigener Vorgang.

Gefunden hat das die eigene Messung; die Plan-Review (gemini) hat es unabhängig
bestätigt und denselben Satz als falsch markiert.

## What Changes

- **Drei Entzüge nennen alle betroffenen Rollen** und geben danach ausdrücklich
  zurück, was gebraucht wird. Damit ist der Zustand von der Instanz-Sorte
  unabhängig. Genau diese drei, keine weiteren:
  `resolve_display_name`, `member_state_matches`, `staff_roles`.
- Der Entzug auf `staff_roles` betrifft `service_role`. Er ist **kein No-op auf
  PROD** — das war die Annahme des ersten Entwurfs und sie ist widerlegt (siehe
  unten). Er ist trotzdem **belegt gefahrlos**:
  `admin-change-email/index.ts:94` und `admin-set-member-ban/index.ts:36` halten
  beide ausdrücklich fest, dass ein direktes `.from("staff_roles")` in
  „permission denied" liefe — sie tun es deshalb nicht. Keine Fläche liest diese
  Tabelle als `service_role`.
- **Der `service_role`-Lockdown wurde nie ausgesprochen.**
  `20260715140000_explicit_grants.sql:35-36` sagt wörtlich *„service_role bleibt
  unangetastet: es umgeht RLS per Definition und traegt die Edge Functions"*,
  und der Entzug in Abschnitt 1 lautet `revoke all on all tables in schema
  public from anon, authenticated` — ohne `service_role`. Der Grundsatz, auf den
  sich `rls_test.sql:1866` beruft, gilt also nur dort zufällig, wo die Instanz
  von sich aus nichts vergibt. Der Kommentar dort wird entschärft, damit er
  nicht weiter eine Zusage behauptet, die er nicht trägt.
- Die Anforderung nimmt `service_role` in die Aufzählung der zu nennenden Rollen
  mit auf und sagt aus, dass derselbe Migrationsstand auf beiden Instanz-Sorten
  denselben Rechtezustand ergeben muss.
- Die CLI-Version in `ci.yml` wird auf eine **konkrete Nummer** gepinnt, nicht
  auf „die letzte neue". Nicht als Behebung, sondern damit die Umgebung nicht
  wieder über Nacht unter dem Repo wegwandert. Gepinnt wird auf die **neue,
  strengere** Sorte, damit weitere zu enge Entzüge weiterhin auffallen statt
  zugedeckt zu werden.
- **Die Gegenprobe in `grants_test.sql` wird repariert.** Sie entzog bis heute
  nur `from public` und behauptete damit, genau die Formulierung wirke, die
  AGE-602 als unzureichend beschreibt. Auf dem alten lokalen Stack ging das
  durch; auf der neuen Sorte fällt sie. **Eine Gegenprobe, die die falsche Form
  vorführt, ist schlimmer als keine — sie schreibt den Irrtum fest, den sie
  aufdecken soll.** Neu dazu kommt eine dritte Probe, die den rollen-eigenen
  Grant **selbst herstellt** und dann zeigt, dass `from public` ihn nicht
  mitnimmt. Die misst auf **jeder** Instanz-Sorte etwas.
- **Der Pin ist nicht bloß Hygiene — er ist der Biss.** Zwei der neuen Szenarien
  können auf dem alten lokalen Stack gar nicht rot werden: dort halten
  `authenticated` und `service_role` von sich aus nichts, und ein Vergleich
  zweier Instanz-Sorten ist innerhalb einer Instanz ohnehin nicht führbar. Diese
  Szenarien messen ausschließlich auf der gepinnten CI-Sorte etwas. Das Delta
  sagt das aus, statt es implizit zu lassen — eine Zusage, die überall grün ist,
  hat sonst niemand als solche erkannt.

## Impact

- Betroffene Fähigkeit: `access-control`, eine Anforderung geändert.
- Eine Migration, die nur Rechte entzieht und zwei zurückgibt. Keine neue
  Tabelle, keine neue Spalte, keine Policy.
- `.github/workflows/ci.yml`: eine Zeile.
- **Der Golden-Snapshot ändert sich nicht.** Er führt `anon`/`authenticated`;
  `service_role` kommt darin nicht vor, und `staff_roles/authenticated=SELECT`
  bleibt wie es ist.

## Was hier NICHT belegt ist

**Ob PROD die alte oder die neue Sorte ist.** Aus dieser Sitzung nicht messbar:
der Supabase-MCP sieht nur ein fremdes Projekt, und der PROD-Zugang liegt in
Infisical, das ein echtes Terminal braucht.

Einschätzung, ausdrücklich als solche: PROD wurde früher angelegt und ist
vermutlich die alte Sorte, die drei Rechte liegen dort also vermutlich **nicht**
offen. Der Fix ist in beiden Welten richtig und in beiden folgenlos, wo das
Recht ohnehin fehlte — er braucht die Antwort deshalb nicht.

Was die Antwort braucht, ist die Frage, ob vor dem Go-Live noch etwas ANDERES
offensteht, das aus derselben Wurzel stammt. Das ist ein eigener Vorgang und
eine Messung an PROD, keine Vermutung hier.

## Risiko

Ein Entzug kann etwas mitnehmen, das jemand braucht. Für jede der drei Stellen
gilt deshalb: erst messen, wer das Recht heute hält und wer es aufruft, dann
entziehen, dann das Gebrauchte namentlich zurückgeben.

Nach der Verkleinerung ist das Risiko klein und benannt:

- `resolve_display_name` → bleibt für `authenticated` ausführbar; `anon` verliert
  ein Recht, das es laut abgeschlossener Liste in `grants_test.sql` nie haben
  sollte.
- `member_state_matches` → verliert `authenticated`; die Funktion wird nur aus
  `SECURITY DEFINER`-Funktionen heraus aufgerufen, die als Eigentümer laufen.
  **Das gehört am grünen Testlauf belegt, nicht behauptet** — die beiden
  Admin-Zusagen in `admin_member_list_test.sql` sind die Fläche dafür.
- `staff_roles` → verliert `service_role`; belegt gefahrlos, siehe oben.

Der eine Entzug, der wirklich hätte weh tun können, ist aus dem Change
entfernt worden, bevor eine Zeile Code existierte.
