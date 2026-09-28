# Entwurf — mitglied-anlegen (AGE-927)

## Die eine Entscheidung, die alles andere trägt

Der Einladungsstand wird **abgeleitet**, nicht gespeichert. Es entsteht keine
Spalte `eingeladen_am` in `profiles`, kein Flag, kein Trigger.

*Warum:* die Wahrheit steht bereits in `activation_tokens` und wird dort von
`issue_activation_token` geschrieben. Eine zweite Ablage müsste mit ihr
synchron gehalten werden, und jeder Weg, auf dem ein Token entsteht, ohne die
Kopie zu berühren, macht die Liste still falsch. Abgeleitet kann sie nicht
auseinanderlaufen.

*Was es kostet:* je Zeile ein Blick in `activation_tokens`. Bei 78 Profilen und
einer Seite von 50 ist das nichts; die Tabelle hat `profile_id` im Index, weil
`issue_activation_token` selbst danach sucht. Sollte es je teuer werden, ist der
Umbau auf eine gepflegte Spalte eine eigene Änderung — und dann mit dem Trigger,
der sie ehrlich hält.

## Die drei Funktionen, in dieser Reihenfolge

Die Reihenfolge ist nicht frei: `member_state_matches` ist Argument der beiden
anderen, also muss sie zuerst stehen, und weil ihre Signatur sich ändert, müssen
die beiden Aufrufer in **derselben** Migration neu deklariert werden.

### 1. `member_state_matches` bekommt ein fünftes Argument

```
member_state_matches(p_status, p_activated_at, p_disabled_at, p_deleted_at,
                     p_eingeladen_am timestamptz)
```

`angelegt` ist `p_activated_at is null and p_eingeladen_am is null` (plus die
bestehende Bedingung, dass weder deaktiviert noch gelöscht), `eingeladen`
dasselbe mit `p_eingeladen_am is not null`. `offen` bleibt unverändert die
Vereinigung.

**Sie bleibt `immutable`.** Sie liest weiterhin nichts — der Zeitpunkt kommt als
Argument herein. Das ist der Grund, warum das Argument überhaupt existiert statt
eines `exists`-Ausdrucks im Rumpf: eine Bedingung, die läse, wäre `stable`, und
der Planer müsste sie je Zeile als Blackbox aufrufen, statt sie in den Filter zu
ziehen.

**Signaturwechsel heisst `drop` + `create`.** Ein `create or replace` legt bei
geänderter Parameterliste eine **zweite** Funktion an; ein Aufruf mit vier
Argumenten wäre danach mehrdeutig. Also abwerfen — und **den `revoke` danach
wieder aussprechen**: er wird nicht geerbt, und `default privileges` wirken auf
Funktionen ohnehin nicht.

Weil beide Aufrufer `security definer` mit Eigentümer `postgres` sind, braucht
`authenticated` weiterhin kein Ausführungsrecht. Der `revoke ... from public,
anon` bleibt die engere Fassung und wird wortgleich wiederholt.

### 2. `admin_list_members` bekommt eine Spalte

Der Rückgabetyp ändert sich, also `drop` + `create`. Mit dem Abwurf gehen
**Grants, Kommentar und die vier Parameter-Vorgabewerte** verloren; alle vier
Dinge kommen in derselben Migration zurück. Der fehlende Vorgabewert ist dabei
der teuerste Verlust: ein argumentloser Aufruf meldete sonst „function does not
exist" statt der zugesagten `42501`, und die Anforderung sagt genau diesen
Unterschied zu.

Die Ableitung als `left join lateral` auf das Maximum, nicht als korrelierter
Ausdruck in der Auswahlliste — sie wird an **zwei** Stellen gebraucht, in der
Spalte und im Filter, und zweimal geschrieben liefe sie auseinander:

```sql
left join lateral (
  select max(t.created_at) as eingeladen_am
    from public.activation_tokens t
   where t.profile_id = p.id
) tok on true
```

### 3. `admin_member_counts` zählt zwei Zustände mehr

Derselbe `left join lateral`, dieselbe geteilte Bedingung. Dass `angelegt +
eingeladen = offen` gilt, ist dann keine Zusage, die jemand einhalten muss,
sondern eine Folge davon, dass alle drei dieselbe Funktion fragen.

## Was `offen` bleibt, und warum es bleibt

`offen` wird **nicht** entfernt. Es hat nach dieser Änderung keinen Filter mehr
auf der Fläche, bleibt aber gültiger `p_status`.

*Warum:* Es zu entfernen wäre ein zweiter Bruch ohne Gewinn — `admin_member_counts`
liefert die Zahl, ein Lesezeichen trägt den Wert, und die Summenzusage
(`angelegt + eingeladen = offen`) braucht ihn, um überhaupt prüfbar zu sein.
Ein Wert ohne Fläche ist in dieser Datei schon einmal vorgekommen (`aktiviert`)
und wurde dort benannt statt verschwiegen; dasselbe hier.

Ein `?tab=offen` fällt auf ① Angelegt. Nicht auf „Alle": ein Lesezeichen, das
etwas Bestimmtes suchte, darf nicht in der stillsten möglichen Antwort landen.

## Die Edge Function

`admin-create-member`, Muster `admin-change-email`: `verify_jwt = true`,
Admin-Prüfung über `staff_roles`, Admin-API mit `service_role`.

**Die Kennung kommt aus dem JWT, nicht aus `getUser()`.** Seit der Umstellung auf
ES256-Signing-Keys liefert `getUser()` in Edge Functions nichts Brauchbares; der
`sub` wird aus dem Token gelesen. Das ist in den bestehenden Functions so gebaut
und wird hier nicht neu erfunden.

Ablauf:

1. JWT lesen, `sub` ziehen, `staff_roles` prüfen → sonst 403.
2. Adresse normalisieren (`lower(trim(...))`) und nachsehen, ob sie existiert.
   Existiert sie: **kein** zweites Konto, sondern eine Antwort, die das
   bestehende Mitglied benennt. Die Prüfung ist eine Bequemlichkeit, kein
   Schutz — den Schutz leistet die Eindeutigkeit in `auth.users`, und der
   `409`-Weg muss auch dann stimmen, wenn zwei Anlagen sich überholen.
3. Konto anlegen: `email_confirm: true`, **kein Passwort im Rumpf**. Das Profil
   entsteht über den bestehenden Trigger; Name und `tier` werden danach gesetzt.
4. Haken gesetzt → dieselbe Kette wie „Zugangslink schicken" aufrufen. **Nicht**
   `admin_activate_member`.

**Die Reihenfolge 3 → 4 ist nicht umkehrbar**, und Schritt 4 darf Schritt 3 nicht
zurückdrehen: scheitert der Versand, ist das Konto trotzdem angelegt und steht in
① Angelegt. Das ist der bessere Ausgang als ein halb entstandenes Konto — und die
Antwort muss es sagen.

## Die Oberfläche

**Zwei Gruppen, ein gewählter Filter.** Die Aufnahmestrecke ① → ② → ③ steht als
Folge über der bestehenden Reiterleiste (Alle · Deaktiviert · Gelöscht ·
Mitgliedschaft). Technisch ist das dieselbe Auswahl wie heute: ein Wert, der in
der Adresse steht. Die Trennung ist Darstellung.

*Warum nicht sieben flache Reiter:* dann stünde „③ Bestätigt" gleichrangig neben
„Gelöscht", und die Reihenfolge ①→②→③ wäre nur noch Anordnung statt Aussage.
Detlev soll sehen, dass ein Mitglied einen Weg durchläuft.

**Die Auswahl gilt je Seite.** Ein „alles auswählen", das stillschweigend 35
ungesehene Zeilen umfasst, wäre genau das „an alle", das ADR-0007 ausschliesst.

**Der Bericht trennt die Ausgänge.** `issue_activation_token` kennt vier, die
den Admin verschieden angehen: verschickt, `pending` (gültiger Link im
Postfach), `rate_limited` / `rate_limited_day`, und Fehler. Eine Sammelzahl
„N verschickt" wäre über einer gemischten Menge schlicht falsch.

## Was die Wächter angeht

`admin_member_list_test.sql` benennt fünf Funktionsidentitäten über
`::regprocedure`. Zeigt einer davon nach der Migration auf eine Signatur, die es
nicht mehr gibt, **bricht der Test nicht ein — er prüft dann nichts**. Die Casts
werden mitgezogen, und der erste Lauf nach der Migration muss belegen, dass sie
noch greifen.

`grants_test.sql` hält einen Golden-Snapshot über **Tabellen**. Hier entsteht
keine Tabelle; der Snapshot sollte unberührt bleiben. Das ist eine Erwartung,
keine Zusage — sie wird gemessen, nicht angenommen.

`src/types/database.types.ts` ist **handgepflegt**. `supabase gen types` darf
nicht darüberlaufen; die neue Spalte und die beiden neuen Statuswerte werden von
Hand nachgetragen.
