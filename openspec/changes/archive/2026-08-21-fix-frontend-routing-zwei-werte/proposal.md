## Why

Linear: **AGE-579**.

`deployment-environments` verlangt heute, der Wechsel des Frontend-Laufzeit-
Routings geschehe „ausschließlich durch das Ändern der **drei** Werte
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` und `SUPABASE_DB_PASSWORD`".

Das Runbook `docs/supabase-environments.md` sagt seit C4 ausdrücklich das
Gegenteil — „Es sind zwei Werte, nicht drei" — und begründet es. Zwei
normative Quellen widersprechen einander, und die falsche ist die, die
`SHALL` sagt.

**Am Code nachgemessen, nicht aus den Dokumenten übernommen (2026-08-21):**

| Frage | Befund |
|---|---|
| Wer liest `SUPABASE_DB_PASSWORD`? | genau **ein** Verbraucher: `supabase/seed/demo_seed.lib.ts:49`, der Demo-Seed, und der liest aus `dev` |
| Kann es ins Bundle geraten? | **Nein.** Kein `VITE_`-Präfix — Vite backt es nicht ein |
| Woran hängt das Frontend-Routing wirklich? | `src/lib/supabase.ts:5-6`, genau zwei Werte |

Der Fehler ist **Bestand**: er stand schon vor AGE-576 im Hauptspec, und
dessen MODIFIED-Delta hat ihn unverändert mitgeschleppt. Deshalb wurde er dort
bewusst nicht mitgefixt — er gehörte nicht in jenen Diff.

**Warum das mehr ist als ein Schreibfehler.** Die Anforderung ist die
Handlungsanweisung für Schritt 5 des PROD-Neuaufbaus. Wer ihr folgt, setzt in
Infisical `prod` ein `SUPABASE_DB_PASSWORD` — heute das Passwort des **alten**
Projekts — und hält den Umzug danach für vollständig. Der Wert hat dort keinen
Verbraucher; die Handlung ist also nicht bloß überflüssig, sie erzeugt ein
falsches Fertig-Gefühl an genau der Stelle, an der PROD live geht.

## What Changes

- **Die Anforderung „Zwei getrennte Supabase-Projekte mit festen Rollen" nennt
  zwei Werte statt drei** und streicht `SUPABASE_DB_PASSWORD` aus der
  Aufzählung.
- **Die Anforderung „Bis zum Import trägt allein DEV die Rolle beider
  Umgebungen" zieht nach.** Ihr Szenario „Das Aufsetzen von PROD lenkt keinen
  Verkehr um" nennt die drei Werte ein zweites Mal. Ohne sie widerspräche der
  gefaltete Hauptspec sich weiterhin selbst.
- **Beide betroffenen Szenarien behalten ihre Titel.** Ein umgetaufter Titel in
  einem MODIFIED-Block löscht das alte Szenario beim Archivieren.
- **Ein neues Szenario macht die Streichung prüfbar**, und zwar am Bundle statt
  an der Absicht: Build mit gesetztem `SUPABASE_DB_PASSWORD`, danach im
  Erzeugnis danach suchen.
- **Eine Zeile im Runbook wird mitkorrigiert** (`docs/supabase-environments.md`,
  „Umzug der drei prod-Werte"). Siehe unten — sie widerspricht der eigenen
  Anleitung 26 Zeilen darüber.
- **Kein Anwendungscode, keine Migration, keine Konfiguration.** Der Spec
  beschreibt ab hier, was ohnehin schon der Fall ist.

## Was der Plan-Review geändert hat

Der erste Entwurf dieser Change **hat den Fehler nur zur Hälfte gefunden** und
behauptete obendrein, das Runbook sei durchgehend richtig. Beides war falsch,
und beides fand codex im Plan-Review (2b), bevor eine Zeile geschrieben war.

Die Ursache ist es wert, festgehalten zu werden: die Gegenprobe lief als
`grep -rn "drei Werte"` — **und die Specs sind hart umbrochen.** In
`deployment-environments/spec.md` steht „bis die drei" am Ende von Zeile 71 und
„Frontend-Werte" am Anfang von Zeile 72. `grep` arbeitet zeilenweise und konnte
die Stelle nicht finden. Im Runbook hieß es zudem „drei **prod**-Werte", eine
Formulierung, nach der niemand gesucht hatte.

**Eine zeilenweise Suche über hart umbrochenen Fließtext ist keine
Vollständigkeitsprüfung.** Aufgabe 3.1 sucht deshalb jetzt nach Varianten und
prüft jeden Treffer einzeln, statt einer Zeichenkette zu vertrauen.

## Impact

- Betroffener Spec: `deployment-environments` — **zwei** Anforderungen, zwei
  korrigierte Szenarien, ein neues.
- `docs/supabase-environments.md` — **eine Zeile**, die sich selbst widersprach.
- Kein Anwendungscode, kein Test, keine Datenbank.
