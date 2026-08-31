# Session Handoff — 2026-08-31 (AGE-642: D1 halb gebaut, der OTA-Schlüssel ist falsch)

> ## ⚠ ZUERST: Diese Sitzung macht NUR die mobile Hülle
>
> **AGE-642 (Capacitor-Hülle) gehört hierher, alles andere nicht** (Donald,
> 31.08.). Frühere Fassungen schleppten fremde Punkte mit — das war der Grund
> für drei Rebase-Konflikte auf dieser Datei in zwei Tagen. Wer den Stand
> ausserhalb AGE-642 braucht, **fragt die Sitzung `fbc-platform-f4`**; sie
> schreibt ihre Übergabe nicht mehr ins Repo.
>
> ### ⛔ Für AGE-599 gilt weiterhin: NICHT löschen
>
> Die acht Objekte in `event-covers` auf DEV stammen aus dem Spiegel DEV ← PROD
> (AGE-576); kein Skript stellt sie wieder her. Steht als SHALL NOT in
> `openspec/specs/design-system/spec.md`.

**Worktree:** `fbc-platform.donald-age-642-capacitor-huelle`, Branch
`donald/age-642-capacitor-huelle`. Heute auf `origin/main` rebased (sauber),
danach **9 Commits voraus** — davon acht Doku, **einer mit Code**.

Den Rückstand selbst messen, nicht hier ablesen:
`git fetch origin main && git rev-list --left-right --count origin/main...HEAD`.

Change `capacitor-huelle`: **39 offen, 79 erledigt** (Einstieg heute: 40/76).

## Accomplished

**Der erste Code der Phase D steht** (`eaedcdd`): Bucket `ota-buendel` und
Manifest-Tabelle `public.ota_buendel`, beide per Migration, 20 pgTAP-Zusagen,
Eintrag in der CI-Dateiliste. Lokal 20/20 grün, in einer Transaktion mit
Rollback gefahren — der geteilte lokale Stack blieb unberührt. Der
Golden-Master über die Tabellenrechte ist nachweislich unberührt (die Tabelle
trägt keine Grants, wie `activation_tokens`).

## ⚠ DER WICHTIGSTE BEFUND: der hinterlegte OTA-Schlüssel ist unbrauchbar

`CAPGO_PRIVATE_KEY` in Infisical `prod` hat **4096 Bit**. Das Plugin bricht ab,
wenn das Chiffrat der Prüfsumme **nicht genau 256 Byte** lang ist — hart, auf
beiden Plattformen (`CryptoCipher.java:254`, `CryptoCipher.swift:74`). 256 Byte
heisst **RSA-2048**; 4096 liefert gemessen 512.

**Der Fehlschlag wäre still gewesen:** das Bündel lädt, die Prüfung scheitert,
das Gerät bleibt auf der alten Fassung, kein Log auf unserer Seite erklärt es.
Entdeckt worden wäre es frühestens beim ersten Gerätetest.

Am Vormittag desselben Tages galt derselbe Schlüssel als **dreifach belegt**.
Die drei Belege prüften Format, Übertragung und einen Rundlauf — **ein Rundlauf
gelingt mit jeder Länge.** Wer Schlüsselmaterial belegt, muss die Grösse als
eigene Frage stellen.

**Zu tun, Donalds Hand** (Infisical braucht ein echtes Terminal):

```
openssl genrsa -traditional -out ~/Documents/capgo_privat.pem 2048
openssl rsa -in ~/Documents/capgo_privat.pem -RSAPublicKey_out -out ~/Documents/capgo_oeffentlich.pem
```

Danach `CAPGO_PRIVATE_KEY` in Infisical `prod` **ersetzen** und die alten
4096-Bit-Dateien löschen, damit nicht später die falsche gegriffen wird. PKCS#1
und die Regel „mehrzeiliges PEM nur über die Umgebung setzen" gelten unverändert.

## Decisions

- **Vertragsnummer der Schale ist semver-förmig** (`1.0.0` → `2.0.0`, nicht
  `1` → `2`). Gemessen: derselbe Config-Wert wird auf dem Gerät als Semver
  geparst; eine blanke Zahl liesse `currentVersionNative` auf iOS still auf
  `0.0.0`. Der Vergleich im Endpunkt läuft zahlenweise über
  `string_to_array(…, '.')::int[]`.
- **Bucket öffentlich, 8 MiB, `application/octet-stream`, keine Policy.** Die
  Begründung für „öffentlich" ist **nicht** die Verschlüsselung — die trägt
  Echtheit, nicht Vertraulichkeit (öffentlicher Schlüssel und `sessionKey` sind
  beide öffentlich erreichbar). Sie ist: im Bündel steht dasselbe `dist/`, das
  Pages ohnehin ausliefert. An vier Stellen korrigiert.
- **Keine Policy ist richtig**, weil `service_role` `rolbypassrls = true` trägt
  **und** alle Rechte auf `storage.objects` hält — beides gemessen, beides als
  eigene Zusage im Test.
- **Tabelle ohne Grants und ohne Policy**, Muster `activation_tokens`. Der
  Schreibweg wird eine SECURITY-DEFINER-Funktion, kein `.from(…)`.

## Files modified

`eaedcdd`: `supabase/migrations/20260831100000_ota_buendel.sql` **neu** ·
`supabase/tests/ota_buendel_test.sql` **neu** · `.github/workflows/ci.yml`
(eine Zeile in der pgTAP-Dateiliste) · `tasks.md` D1 (zwei Punkte erledigt, der
Schlüssel-Punkt wieder offen mit Begründung) · `design.md` §8 (Längenfalle,
Prüfsumme gilt dem Klartext, Form der Vertragsnummer, Vertraulichkeit
korrigiert) · `docs/decisions/0005-…md` · `REVIEWS.md` (Runde 3).

## Next session: start here

**Erst den Schlüssel, dann den Veröffentlichungs-Schritt.** Der dritte Punkt
von D1 (`deploy.yml`) ist der nächste Code, aber er läuft bei jedem Merge auf
`main` — mit dem falschen Schlüssel bricht er dort. Solange der Schlüssel nicht
ersetzt ist, entweder warten oder den Schritt schreiben und **nicht** mergen.

Die vier Einzelheiten, die der Schritt treffen muss, stehen ausgeschrieben in
`tasks.md` unter dem dritten D1-Punkt. Kurz: Prüfsumme über das **Klartext**-Zip,
verschlüsselt werden die **32 rohen** Digest-Bytes, `checksum` als Hex,
`sessionKey` als `<iv>:<sessionKey>` mit den Längen 24 und 344. Die Bedingungen
an den Spalten weisen jede Abweichung beim Schreiben ab.

**Vorher lesen, sonst wird es teuer:**

1. **`service_role` hält in `public` keine Tabellenrechte.** Ein
   `.from("ota_buendel").insert(…)` scheitert erst zur Laufzeit. Der Schreibweg
   ist eine SECURITY-DEFINER-Funktion mit `grant execute … to service_role`,
   Muster `issue_activation_token`. Für den **Bucket** gilt das nicht.
2. **Postgres-Regex: `{n}` höchstens 255.** `{512}` läuft beim Anlegen durch und
   fällt erst beim ersten INSERT mit `2201B`. Längen über 255 als
   `length(…) = n` schreiben.
3. **Der Drift-Gate blockt den Frontend-Deploy**, solange diese Migration nicht
   auf PROD/DEV angewendet ist. Nach dem Merge also `migrate-prod` dispatchen —
   und das wendet ohne Rückfrage an.
4. **Nach JEDEM `pnpm build`, vor jedem `git add`:**
   `git checkout -- src/content/release-entries.generated.ts`. Jeder Build
   schreibt sie unformatiert neu. In diesem Branch bislang unberührt.

**Migration + RLS heisst Fremdreviewer** (Donalds Regel vom 26.08.). Für diesen
Diff lief codex: zehn Befunde, sieben übernommen, zwei teilweise, einer
entkräftet — Einzelheiten in `REVIEWS.md` Runde 3. Der teuerste widerlegte die
Begründung für den öffentlichen Bucket.

## Open questions — alle innerhalb AGE-642

- **Der 2048-Bit-Schlüssel** (siehe oben). Blockiert den Veröffentlichungs-Schritt.
- **Vier Gerätebelege stehen aus:** C3 auf beiden Plattformen · C2 auf Android ·
  C1 auf iOS · B5 der Startbildschirm. **Für B5 muss die App gelöscht werden**
  (Launch-Screen-Zwischenspeicher), **und das kostet Donald die Anmeldung** —
  vorher ansagen.
- **B3 Signaturmaterial (4 offen):** Zertifikat, Provisioning Profile, Keystore.
  Donalds Hand. Vom OTA-Schlüsselpaar unabhängig.
- **`publicKey` in `capacitor.config.ts`** gehört zu D3, wo das Plugin dazukommt.
- **capgo-Version `8.51.15`, nicht `9.x`/`10.x`.** Reihenfolge beim Hinzufügen:
  `pnpm add` → `deno install --frozen=false` → **zwingend** `pnpm install`. Das
  macht `edge-functions` rot, obwohl die Functions capgo nie importieren.
  **Vorher mit f4 abstimmen** — einzige Stelle, an der wir dieselben Sperrdateien
  anfassen wie ihre Dependabot-PRs.
- **C3 ändert an zwei Stellen die Optik** (`WillkommenPage`, Bearbeiten-Formular
  im Feed) — gemergt, aber nie im Browser angesehen.
- **AGE-642 springt beim Merge selbst auf Done**, und die Automation geht auch
  zurück. Ein Status sagt hier weder „fertig" noch „unfertig" verlässlich.
- **Nebenbefund, nicht angefasst:** `ADR-0037` wird dreimal zitiert, existiert
  aber nicht (`docs/decisions/` führt 0001–0005).
