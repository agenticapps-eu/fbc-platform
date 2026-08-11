# Evidence — C7 (AGE-528)

## Task 1.0 / 1.0b — darf `anon` aus einem privaten Bucket signieren?

Die Frage, an der der ganze Change hängt (`design.md`, „Das eine Risiko").
Gemessen **vor** der ersten Migration, gegen den lokalen Stack.

```
tsx scripts/probe-post-media-signatur.ts
```

Gemessen am 2026-08-11, lokaler Stack (`127.0.0.1:54322` / `:54321`),
Supabase CLI 2.113. Die Sonde baut einen Wegwerf-Aufbau nach demselben Muster
wie das Ziel — privater Bucket, `SECURITY DEFINER`-Prädikat, SELECT-Policy für
`anon` — und räumt ihn wieder ab.

### Ergebnis: ALLE PRUEFUNGEN ERFUELLT

| Fall | Erwartet | Gemessen |
|---|---|---|
| **A** Objekt eines `public`-Beitrags, anon signiert | signierte URL | signierte URL erhalten |
| **A** Abruf der signierten URL | HTTP 200 | **HTTP 200** |
| **A** rohe öffentliche Bucket-URL | HTTP 4xx | **HTTP 400** |
| **B** dasselbe Objekt als `members`-Beitrag | Ablehnung | **abgelehnt: „Object not found"** |
| **C** Objekt ohne `post_media`-Zeile (verwaist) | Ablehnung | **abgelehnt: „Object not found"** |
| **D** nachgebauter Pfad, eigenes Präfix | Ablehnung | **abgelehnt: „Object not found"** |
| **E** 120 Pfade in einem Aufruf | 120 URLs | **120 URLs in 17 ms** |
| **F** Stapel mit einem verbotenen Pfad | 4 von 5 | **4 von 5** |

### Was das entscheidet

**Der gewählte Weg ist gangbar.** Der Rückfallweg aus Task 1.1 (Edge Function
mit `service_role`) wird **nicht** gebraucht; `design.md` bleibt unverändert.

**Drei Befunde, die über die Frage hinausgehen:**

1. **Die Ablehnung lautet „Object not found", nicht „permission denied".**
   Der Storage unterscheidet die beiden Fälle nach außen nicht — für einen
   ausgeloggten Besucher ist ein Bild, das er nicht sehen darf, von einem
   nicht existierenden ununterscheidbar. Das ist gut (keine Aufzählbarkeit),
   hat aber eine Folge für den Code: **ein „not found" beim Signieren ist kein
   Fehlerzustand, den man melden darf** — es ist der Normalfall eines Bildes,
   das den Betrachter nichts angeht. Wer es an Sentry meldet, meldet Rauschen.
   Gehört in Task 5.2a.

2. **17 ms für 120 Signaturen.** Die Sorge aus dem Plan-Review (opencode, LOW),
   die Policy werte je Objekt eine `SECURITY DEFINER`-Funktion mit Join aus und
   das könne teuer werden, ist gegenstandslos — lokal, ohne Netz. Der Wert ist
   die Untergrenze, nicht die Erwartung für DEV; er schließt aber aus, dass die
   Konstruktion selbst das Problem ist.

3. **Teilablehnung bestätigt.** `createSignedUrls` verwirft den Stapel nicht,
   wenn ein Pfad nicht erlaubt ist — es liefert die erlaubten und lässt den
   einen aus. Die Entscheidung in 5.2a (je Bild behandeln, nie den ganzen
   Beitrag verwerfen) ist damit gemessen, nicht vermutet.

### Nebenbefund beim Bauen der Sonde

`storage.protect_delete()` verbietet **direktes SQL-Löschen** in
`storage.objects` / `storage.buckets` („Direct deletion from storage tables is
not allowed"). Aufräumen läuft deshalb über die Storage-API
(`emptyBucket` + `deleteBucket`), Anlegen über `createBucket`. Für die
pgTAP-Fälle in Task 2.1 heißt das: ein Testaufbau, der Objekte per SQL wieder
entfernen will, scheitert am Trigger — nicht an der Policy.

## Task 1.0c — noch offen

Die Sonde gegen **DEV** laufen zu lassen (Plan-Review: ein grüner lokaler Lauf
sagt nichts über DEV, wenn die Supabase-Versionen auseinanderliegen) steht noch
aus. Sie ist **blockiert**: `infisical` hat keine Session, und der Login
braucht ein echtes Terminal (`! infisical login`).

Blockiert nicht den Fortschritt — 1.0c gehört ohnehin vor den Zeitpunkt, an
dem Block 2 auf DEV landet, und bis dahin müssen die Migrationen erst
existieren.
