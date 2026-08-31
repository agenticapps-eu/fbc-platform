# Session Handoff — 2026-08-31 (AGE-642: Phase D entschieden, Schlüssel steht, D1 ist dran)

> ## ⚠ ZUERST: Diese Sitzung macht NUR die mobile Hülle
>
> **AGE-642 (Capacitor-Hülle) gehört hierher, alles andere nicht** (Donald,
> 31.08.). Frühere Fassungen schleppten fremde Punkte mit — das war der Grund
> für drei Rebase-Konflikte auf dieser Datei in zwei Tagen.
>
> Die Sitzung **`fbc-platform-f4`** schreibt ihre Übergabe **nicht mehr ins
> Repo**; sie liegt als Arbeitsbaum-Änderung in `fbc-platform.neuigkeiten-archiv`.
> Wer den Stand ausserhalb AGE-642 braucht, **fragt jene Sitzung** — in der
> Historie steht er nicht.
>
> ### ⛔ Für AGE-599 gilt weiterhin: NICHT löschen
>
> Ältere Übergaben sagten „erst die acht Objekte in `event-covers` auf DEV
> löschen, dann seeden". **Das macht DEV kaputt.** Die Objekte stammen aus dem
> Spiegel DEV ← PROD (AGE-576), kein Skript stellt sie wieder her. Steht als
> SHALL NOT in `openspec/specs/design-system/spec.md`.

**Worktree:** `fbc-platform.donald-age-642-capacitor-huelle`, Branch
`donald/age-642-capacitor-huelle`. **7 Commits über `origin/main`**, alle reine
Doku — **kein Code liegt an.**

**Den Rückstand selbst messen, nicht hier ablesen:** `main` bewegte sich am
31.08. mehrfach (f4 merget #297 und danach die zwei Dependabot-PRs #287/#296).
Also `git fetch origin main && git rev-list --left-right --count origin/main...HEAD`.
Der Rebase ist trotzdem sauber: unsere sieben Commits fassen nur
`openspec/changes/capacitor-huelle/`, `docs/decisions/` und diese Datei an, f4
nichts davon — gemessen, und von beiden Seiten bestätigt.

Change `capacitor-huelle`: **40 offen, 76 erledigt** (Einstieg heute: 43/69).

## Accomplished

Keine Zeile Code. Phase D ist von „vier offenen Entscheidungen" auf „baubar"
gebracht worden; dabei fielen zwei Irrtümer auf.

**1 · R2 stand nie.** `design.md` §8 begründete Cloudflare Pages plus R2 mit
einem Satz: „Beides steht bereits." Pages steht. R2 nicht — kein
`wrangler.toml`, keine Bindung, kein Treffer; die scheinbaren R2-Fundstellen
sind eine **Risiko-Kennung `R2`** in `docs/w2-acceptance.md`.

**2 · `publicKey` verschlüsselt, er signiert nicht** („end to end live update
encryption Version 2"). Das Zip wird mit einem AES-Schlüssel verschlüsselt,
dieser mit dem **privaten** RSA-Schlüssel; nur der öffentliche in der Schale
öffnet beides. **Im Speicher liegt Chiffrat, kein lesbares `dist/`.** Das
widerlegte eine Begründung, die ich am selben Vormittag selbst geschrieben
hatte — hätte sie gestanden, wäre ein unverschlüsseltes Zip hochgeladen worden.
Zwei Lücken hingen daran: das Manifest braucht **`sessionKey`**
(`iv:sessionKey`), und der Veröffentlichungs-Schritt muss verschlüsseln.

## Decisions (alle Donald, 31.08.)

- **Heimat: alles auf Supabase.** Bündel im Storage-Bucket, Manifest als Tabelle,
  drei Edge Functions mit `verify_jwt = false`. Die Entscheidung vom 27.08.
  bleibt unberührt — **„selbst gehostet" war die Wahl gegen den bezahlten
  Ionic-Dienst, nicht für einen Anbieter.** ADR-0005.
- **Anlass: jeder Deploy auf `main`**, im bestehenden `deploy.yml`-Job.
- **Fassung: `<Semver>+<kurzer SHA>`**, z. B. `1.4.0+8fbc49b`. Beantwortet auch,
  was gilt, wenn Store-Bau und `main`-Deploy sich überholen.
- **Vertragsnummer fährt in `version_build`** — am Plugin gemessen. Einziges
  Feld, das auf beiden Plattformen aus `plugins.CapacitorUpdater.version` kommt;
  Beleg: `capacitor.config.json` liegt **neben** `public/`, nicht darin.
- **Das Spec-Delta blieb unberührt** (es nennt keinen Anbieter) — **2b wurde
  nicht neu fällig**.

## Der Schlüssel steht — und ist belegt

`CAPGO_PRIVATE_KEY` liegt in Infisical `prod`, 4096 Bit, **PKCS#1**. Dreifach
geprüft: Kopfzeilen · SHA-256 des hinterlegten Werts gleich dem der Datei ohne
Schluss-Zeilenumbruch · Rundlauf *privat verschlüsselt → öffentlich
entschlüsselt* byte-gleich, während ein fremder Schlüssel auf demselben
Befehlsweg abgewiesen wird. Dateien in `~/Documents`, `0600`, nicht
iCloud-synchronisiert, nichts im Repo. **Ein Infisical-Login steht NICHT aus.**

## Files modified

`9fd3a00` · `9e59b52` · `c70524a`: `design.md` §8 neu (Vertragsnummer beantwortet,
Anlass, Fassungsschema, Verschlüsselung, Formatfalle) · `proposal.md` und
`tasks.md` Phase D neu · `docs/decisions/0005-ota-auf-supabase-statt-cloudflare-r2.md`
**neu**.

## Next session: start here

**D1, erste zwei Aufgaben: Bucket und Manifest-Tabelle, beide per Migration.**
Das ist der erste Code der Phase. Vorlagen sind die vier bestehenden
Bucket-Migrationen, am nächsten `supabase/migrations/20260812100200_event_covers_storage.sql`.

**Vorher lesen, sonst wird CI rot oder die Tabelle ist zur Laufzeit tot:**

1. **`grants_test.sql` ist ein Golden-Master über ALLE public-Tabellen.** Eine
   neue Tabelle mit `grant select … to authenticated` kippt den
   `migrations`-Job, **obwohl sie im Test nirgends namentlich vorkommt**. Der
   erwartete String muss an alphabetisch richtiger Stelle ergänzt werden.
2. **Grants werden nicht geerbt.** Unsere Migrationen sprechen sie meist nicht
   aus; der Ist-Zustand kam aus Supabases `alter default privileges`, und der
   unterscheidet sich zwischen Prod und frischem CLI-Image. Also **ausdrücklich
   granten**.
3. **`service_role` hält keine Tabellenrechte** — separat aussprechen, sonst
   scheitert der Veröffentlichungs-Schritt erst zur Laufzeit.
4. **Der Mime-Typ ist NICHT `application/zip`** — es liegt Chiffrat im Bucket.
   Erst festlegen, wenn die Verschlüsselung steht.
5. **Die Manifest-Tabelle braucht `sessionKey`** neben Fassung, URL, Prüfsumme
   und Vertragsnummer.

**Migration + RLS heisst Fremdreviewer** (Donalds Regel vom 26.08.) — reines UI
darf direkt gebaut werden, das hier nicht.

Erster Befehl der Sitzung: `pnpm install --frozen-lockfile`. Ein `exit=1` ohne
benannten Fehlschlag sieht aus wie ein Flake und ist eine fehlende Abhängigkeit.

**Nach JEDEM `pnpm build`, vor jedem `git add`:**

```
git checkout -- src/content/release-entries.generated.ts
```

Jeder Build schreibt sie unformatiert neu; sie steht danach als `M` im Status,
ohne dass jemand sie bearbeitet hat, und wer committet, nimmt ein paar hundert
fremde Zeilen mit. Sie war der einzige Konflikt beim Rebase von #290.
**Ausnahme:** wirklich archiviert. Bislang in diesem Branch unberührt.

## Open questions — alle innerhalb AGE-642

- **Vier Gerätebelege stehen aus:** C3 auf beiden Plattformen · C2 auf Android ·
  C1 auf iOS · B5 der Startbildschirm. **Für B5 muss die App gelöscht werden**
  (Launch-Screen-Zwischenspeicher), **und das kostet Donald die Anmeldung** —
  vorher ansagen.
- **B3 Signaturmaterial (4 offen):** Zertifikat, Provisioning Profile, Keystore.
  Donalds Hand. Das OTA-Schlüsselpaar ist davon unabhängig und **erledigt**.
- **`publicKey` in `capacitor.config.ts`** gehört zu D3, wo das Plugin dazukommt
  — vorher wäre es tote Konfiguration. Datei liegt bereit.
- **capgo-Version:** `8.51.15`. **Nicht `9.x`/`10.x`** — höhere Zahl, aber peer
  `@capacitor/core: ^5.0.0`. Reihenfolge beim Hinzufügen: `pnpm add` →
  `deno install --frozen=false` → **zwingend** `pnpm install`. Das macht
  `edge-functions` rot, **obwohl die Edge Functions capgo nie importieren** —
  `deno.lock` hält den Versions**bereich** aus `package.json` fest (f4 hat es am
  31.08. an #287 zeilengenau belegt). Der Fix sind zwei Zeilen im selben Commit.
  **Vorher mit f4 abstimmen:** das ist der einzige Punkt, an dem wir dieselben
  Sperrdateien anfassen wie ihre Dependabot-PRs.
- **C3 ändert an zwei Stellen die Optik** (`WillkommenPage`, Bearbeiten-Formular
  im Feed) — gemergt, aber nie im Browser angesehen.
- **AGE-642 springt beim Merge selbst auf Done.** Vorbeugen geht nicht, nur
  nachsehen. Zuletzt viermal passiert. f4 hat es am 31.08. an AGE-667 hart
  belegt: `completedAt` 08:52:03Z, Merge 08:52:00Z — **drei Sekunden**, kein
  Handgriff. Und die Automation geht auch **zurück**: beim Öffnen eines zweiten
  PR fiel der Vorgang von Done wieder auf In Progress. Ein Status sagt hier also
  weder „fertig" noch „unfertig" verlässlich.
- **Nebenbefund, nicht angefasst:** `ADR-0037` wird dreimal zitiert, existiert
  aber nicht (`docs/decisions/` führt 0001–0005).
