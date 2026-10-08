# 0010 — Ein Recht gilt erst, wenn alle drei Wege es tragen

- Status: angenommen
- Datum: 2026-10-08
- Linear: AGE-1001

## Kontext

AGE-1000 hat die Rechtematrix zu Konfiguration gemacht: eine Tabelle
`berechtigungen`, eine Funktion `darf()`, Policies, die sie lesen. Danach stand
die Matrix in sieben Policies — und war trotzdem umgehbar.

Beide Relationen waren für **jedes angemeldete Konto als MENGE** lesbar:

- `profiles` ab Rang 4 über `profiles_select_self_or_discover` — einschliesslich
  der Zeilen mit `is_public = false`, die die Sicht gerade herausfiltert;
- `profiles_public` mit `security_invoker = off`, was die RLS der Basistabelle
  umgeht, **ohne** eigene Rangprüfung.

Ein `GET /rest/v1/profiles?select=id` genügte, um den Mitgliederbestand
abzuzählen. Die Matrix galt für die Oberfläche; am Rohzugriff kam sie nicht an.

## Entscheidung

`select` auf `public.profiles` und `public.profiles_public` wird **allen vier
Rollen namentlich entzogen** (`public`, `anon`, `authenticated`,
`service_role`). An ihre Stelle treten **neun SECURITY-DEFINER-Funktionen**, die
jeweils genau einen Schnitt liefern und die Lebenszyklus-Prüfungen **selbst
führen** — `is_activated()`, `activated_at`, `disabled_at`, `deleted_at`, für
Aufrufer **und** Ziel.

Ein Recht gilt damit erst, wenn **alle drei Wege** es tragen: die Policy, die
Sicht und der Grant. Zwei davon reichen nicht; genau das war der Zustand vorher.

## Die abgelehnte Alternative, und sie ist gemessen

Der naheliegende Flicken nach dem Entzug wäre `grant select (id) on profiles`
gewesen — spaltenweise, nur der Schlüssel, damit die Schreibwege weiter
funktionieren.

Das war der **erste Befund der Plan-Review**, und er kam, bevor eine Zeile Code
existierte. Gemessen gegen den lokalen Stack, mit einer Wegwerfrolle in einer
zurückgerollten Transaktion:

```
nur UPDATE(spalte), kein SELECT:  update … where id = $1  →  VERWEIGERT
dasselbe update OHNE where                               →  gelingt
zusätzlich SELECT(id):            das update             →  gelingt
… und dann select count(*)                               →  ALLE ZEILEN
```

Zwei Dinge stehen darin. Erstens: `update … where id = $1` braucht `select` auf
die Spalten der **WHERE-Klausel** — das Schreibrecht fällt also mit dem
Leserecht, ob man will oder nicht. Zweitens, und das ist der Grund für die
Ablehnung: der Flicken, der das repariert, **stellt die Aufzählbarkeit wieder
her**. `count(*)` über eine einzige Spalte zählt den Bestand genauso.

Deshalb fallen die 17 Spalten-Grants für `update` mit, und die Schreibwege
laufen über vier eigene Funktionen.

## Die zweite abgelehnte Alternative

Eine einzige Funktion mit einem `jsonb`-Beutel für alle Schreibwege. Abgelehnt:
benannte Parameter sagen an der Aufrufstelle, was geschrieben wird, und ein
Beutel verschiebt die Prüfung in die Laufzeit. Vier Funktionen, je ein Schnitt —
und bei den Onboarding-Feldern **drei** statt einer mit Vorgabewerten, weil
„null heisst unverändert" ein Feld nie leeren liesse und „null heisst leeren"
ein vergessenes Feld still leerte. Der Funktionsname ist dort die Positivliste.

## Was dabei gelernt wurde und hier stehen bleibt

**Eine DEFINER-Funktion erbt kein Prädikat.** Was die RLS ihr abgenommen hat,
muss sie mitbringen — sonst ist ein Change, der Rechte *schliessen* soll, an
dieser Stelle eine **Ausweitung**. Auch das kam aus der Plan-Review.

**`gespraechspartner_karten` existiert, weil `chat.ts` die Basistabelle
absichtlich gelesen hat.** Ein Gesprächspartner soll seinen Namen auch dann
tragen, wenn er sein Profil nicht öffentlich gestellt hat. Ein Ersatz mit dem
Prädikat der Sicht hätte im Chat Namen verschwinden lassen — **nur** bei den
Zurückgezogenen, also bei denen, die am wenigsten damit rechnen, und von keinem
Test mit öffentlichen Konten bemerkt. In der Sichtprobe steht der Name da.

**Die Wurzeln nennen, nicht nur die Ebenen.** Die erste Zählung der
Aufrufstellen lief über `src/` und fand neunzehn. Die zwanzigste liegt in
`supabase/functions/create-checkout-session/index.ts` — derselbe Client, dieselbe
Rolle, eine andere Wurzel. Und `feed_top_authors` war die *zweite* Funktion, die
die Sicht liest; gefunden, weil der ganze Funktionskatalog befragt wurde und
nicht nur die eine, die im Vorgang stand.

## Folgen

- Der Mitgliederbestand lässt sich nicht mehr abzählen. Gemessen über PostgREST
  mit echten Tokens, Rang 3 bis 6: `profiles`, `profiles_public` und
  `select=count` geben **403**, an jedem Rang.
- `search_directory` wird DEFINER, sonst nähme ihr der Entzug die Grundlage. Die
  Maskierung der erweiterten Spalten hängt danach **allein** am Eintrittstor —
  das Ergebnis bleibt gleich, der Grund nicht, und beides steht als Zusage.
- `feed_top_authors` **bleibt INVOKER**. Sie zählt `posts` unter den Rechten des
  Aufrufers, und beide SELECT-Policies tragen `veroeffentlicht_ab <= now()`; als
  DEFINER zählte sie terminierte Beiträge mit.
- Jede neue Stelle, die Profildaten braucht, braucht künftig eine **Funktion**.
  Das ist Absicht: der Schnitt wird dann einmal entschieden und steht im
  Katalog, statt in einer `select`-Liste zu entstehen.
