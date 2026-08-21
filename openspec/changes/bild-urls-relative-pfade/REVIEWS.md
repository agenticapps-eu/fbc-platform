---
reviewers: [gemini, codex]
models: [gemini-cli-default-nicht-ermittelbar, gpt-5.6-sol]
verdicts: [APPROVE, REQUEST-CHANGES]
reviewed_artifacts_sha: ccb012a37098bfe2d77394a97276ca7331ea1e26e24b547d1854895bf63e7888
---

# Change review — bild-urls-relative-pfade

Beide Reviewer sind fremder Anbieter; der eigene (claude) wurde nicht aufgerufen.
Zeitlimit 900 s. Beide exit 0, keiner ungezählt.

## Reviewer: gemini (Modell nicht ermittelbar)

VERDICT: APPROVE — drei Befunde, drei Annahmen.

- **[MEDIUM] tasks 3.4** — die Vollständigkeitsprüfung der Anzeigestellen war
  als Handgriff formuliert. → als Suche formuliert, nicht als Augenschein.
- **[LOW] tasks 1.1** — woher käme je eine `data:`-URL? → **Nachgemessen: aus
  nirgends.** Alle Vorschauen laufen über `URL.createObjectURL`
  (`AvatarCropper.tsx:128,213`, `CommunityFeed.tsx:314`), erzeugen also `blob:`.
  Der Befund ist berechtigt; codex' Scheme-Definition erledigt ihn mit.
- **[LOW] tasks 2.3** — „nachsehen, ob `saveProfile` …" ist ein Handgriff, kein
  Test. → zu einem Test gemacht.

**Seine dritte Annahme war die gefährlichste und ungeprüft:** ob diese Werte
ausserhalb der React-Anwendung benutzt werden — E-Mail-Vorlagen, Drittdienste.
Nachgemessen: `grep -rn "avatar_url\|cover_url" supabase/functions/` findet
**nichts**. Die Annahme hält.

## Reviewer: codex (gpt-5.6-sol)

VERDICT: REQUEST-CHANGES — sieben Befunde, zwei HIGH.

- **[HIGH] Rollout-Reihenfolge und Nachzügler-Schreibzugriffe.**
- **[HIGH] Die Migration schnitte zu breit.**
- **[MEDIUM] Spec-Widerspruch** zwischen Sollzustand und dauerhaftem
  Durchreichen.
- **[MEDIUM] Es gibt mehr als zwei Erzeuger** — der Demo-Seed.
- **[MEDIUM] Ein einmaliger Handlauf** ist für eine Datenmigration zu wenig.
- **[MEDIUM] „Absolut" ist nicht definiert**, und `http:` fehlt.
- **[LOW] `wp_bilder`** braucht die URL auch für den `HEAD`-Check.

## Nicht gezählt

Keiner.

## Resolution

**Alle zehn Befunde geprüft, alle zehn übernommen.** Jeder erst am Quelltext
nachgemessen — dieselbe Regel wie bei AGE-576 und AGE-579.

### HIGH 1 — Rollout-Reihenfolge · **bestätigt, und es zerlegt den Zuschnitt**

Nachgemessen: `uploadBild` gibt ohne neuen Blob den **alten Wert** zurück
(`profile.ts:305`), und sowohl `saveProfile` (`profile.ts:343-344`) als auch
`admin-profile.ts:170-171` schreiben die Spalte **bedingungslos**.

Daraus folgen zwei Richtungen, und der Durchreiche-Mechanismus deckt nur eine:

| Reihenfolge | Was bricht |
|---|---|
| Migration zuerst | ein **altes** Bundle bekommt `uid/123.webp` und rendert `<img src="uid/123.webp">` — relativ zum Anwendungs-Origin, also ein totes Bild auf der ganzen Fläche |
| Erzeuger zuerst | neue Pfade in einer Datenbank, deren Leser sie noch nicht auflösen |

**Folge: diese Change kann nicht als ein PR ausgeliefert werden.** Sie zerfällt
in zwei Stufen mit einem Deploy dazwischen. Stufe 1 (nur Leser) ist für sich
folgenlos — sie ändert nichts Beobachtbares, weil alle Bestandswerte absolut
sind und durchgereicht werden.

### HIGH 2 — Die Migration schnitte zu breit · **Argument trägt, Entwurf gedreht**

Der Entwurf verbot, die Projektkennung hart zu schreiben — „sonst trüge die
Migration die Kopplung, die sie beseitigen soll". codex hält dagegen, dass eine
**einmalige historische** Migration keine Laufzeitkopplung ist, und dass das
weite Muster `https://<irgendeine>.supabase.co/…/avatars/` eine absichtlich
externe URL aus einem fremden Supabase-Projekt mit zerschnitte — **im
Widerspruch zum eigenen Szenario „fremde Werte bleiben unangetastet"**.

Das ist richtig, und die Lösung ist besser als beide Ausgangspositionen: die
Migration schneidet nur um, **wenn das Objekt nachweislich lokal existiert**
(`storage.objects` mit passendem `bucket_id` und `name`). Damit ist sie weder an
eine Kennung gebunden noch je zu breit — sie fasst genau die Werte an, deren Bild
danach auch wirklich da ist.

### MEDIUM 4 — Mehr als zwei Erzeuger · **bestätigt**

`demo_personas.sql:88` und `demo_legacy_profile.sql:60` schreiben
`https://i.pravatar.cc/300?u=…`. Das ist **gar kein** Supabase-Storage: die
Migration fasst es nicht an, und der Auflöser reicht es durch. Falsch war die
**Spec-Formulierung** — „SHALL den Pfad tragen, nicht eine absolute URL" verbietet
sie fälschlich. Die Anforderung wird auf **Supabase-verwaltete** Profilmedien
begrenzt; ein fremd gehostetes Bild bleibt ausdrücklich erlaubt.

### MEDIUM 6 — „Absolut" ist nicht definiert · **bestätigt**

Der lokale Stack läuft auf Port 54321 (`supabase/config.toml:10`), erzeugt also
`http://…`-URLs. Eine Whitelist aus `https`/`blob`/`data` hätte genau die lokalen
Werte beschädigt. **Absolut heisst ab jetzt: trägt ein URI-Schema** — nicht: steht
auf einer Liste.

### Die übrigen

| Befund | Folge |
|---|---|
| MEDIUM 3, Spec-Widerspruch | Sollzustand und Übergang **getrennt** formuliert; das Durchreichen von `blob:` ist eine Aussage über die *Eingabe der Anzeigefunktion*, nicht über *Spaltenwerte* — der erste Entwurf hat beides vermengt |
| MEDIUM 5, Migrationstest | automatisiert, mit Idempotenz, fremdem Host, falschem Bucket, nacktem Pfad, `null` und einem Nachzügler-Schreibzugriff |
| LOW 7, `wp_bilder` | Prüf-URL (für `HEAD`, Zeile 490) und persistierter Pfad ausdrücklich getrennt; alle drei Zweige einzeln getestet |
| gemini MEDIUM/LOW | 3.4 als Suche, 2.3 als Test |

## Was der Review gekostet und was er verhindert hat

Er hat den Zuschnitt der Change **verdoppelt** — aus einem PR werden zwei mit
einem Deploy dazwischen. Ohne ihn wäre die naheliegende Fassung ausgeliefert
worden: Code und Migration in einem Merge. Der `migrate-dev`-Lauf wendet
Migrationen auf `main` automatisch an, der Frontend-Deploy läuft daneben — die
Reihenfolge wäre dem Zufall überlassen gewesen, und ein Treffer hätte **jedes
Profilbild der Anwendung** auf ein totes `<img>` gesetzt, bis der Deploy
nachzieht.

Das ist derselbe Fehlertyp wie in AGE-579: nicht falsch gedacht, sondern zu
schmal geprüft.
