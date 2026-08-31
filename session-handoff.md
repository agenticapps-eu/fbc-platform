# Session Handoff — 2026-08-31 (AGE-642: Phase D entschieden, OTA zieht nach Supabase)

> ## ⚠ ZUERST: Diese Sitzung macht NUR die mobile Hülle
>
> Donald hat am 31.08. abgegrenzt: **AGE-642 (Capacitor-Hülle) gehört hierher,
> alles andere nicht.** Frühere Fassungen dieser Datei schleppten fremde Punkte
> mit — das war der Grund für drei Rebase-Konflikte auf `session-handoff.md` in
> zwei Tagen.
>
> **Neu am 31.08.:** die Sitzung **`fbc-platform-f4`** schreibt ihre Übergabe
> bewusst **nicht mehr ins Repo**. Sie liegt als reine Arbeitsbaum-Änderung in
> `fbc-platform.neuigkeiten-archiv`. Wer den Stand ausserhalb AGE-642 braucht,
> **fragt jene Sitzung** — in der Historie steht er nicht mehr. Damit ist der
> Rebase-Konflikt auf dieser Datei strukturell erledigt.
>
> ### ⛔ Eine Anweisung aus ÄLTEREN Übergaben ist WIDERLEGT
>
> Für **AGE-599** stand dort „erst die acht Objekte in `event-covers` auf DEV
> löschen, dann seeden". **Nicht tun — das macht DEV kaputt.** Die Objekte
> stammen aus dem Spiegel DEV ← PROD (AGE-576), kein Skript stellt sie wieder
> her. Ausgeschrieben in `openspec/specs/design-system/spec.md` (#294), samt
> SHALL NOT. DEV bleibt, PROD wird nicht angefasst.

**Worktree:** `fbc-platform.donald-age-642-capacitor-huelle`, Branch
`donald/age-642-capacitor-huelle` — **2 Commits über `origin/main`**, sauber:
`8fbc49b` (Übergabe der Vorsitzung) und `9fd3a00` (diese Sitzung). Beide sind
reine Doku; **kein Code liegt an.** Sie gehen mit dem nächsten PR mit; wer den
Worktree vorher entfernt, verliert sie.

Change `capacitor-huelle`: **40 offen, 75 erledigt** (Einstieg: 43/69).

## Accomplished

Diese Sitzung hat **keine Zeile Code** geschrieben — sie hat Phase D
entscheidungsreif gemacht und dabei den Entwurf an einer Stelle widerlegt.

**Der Kernbefund: R2 stand nie.** `design.md` §8 legte den OTA-Dienst auf
Cloudflare Pages Functions plus R2 und begründete das mit einem Satz — „Beides
steht bereits." Nachgemessen stimmt er zur Hälfte. **Pages steht** (`wrangler
pages deploy ./dist`, Token über Infisical, `functions/` fährt mit). **R2 nicht:**
kein `wrangler.toml`, keine Bucket-Bindung, kein Treffer. Die scheinbaren
R2-Fundstellen sind eine **Risiko-Kennung `R2`** in `docs/w2-acceptance.md` —
Namensgleichheit. Damit trug die Wahl kein Argument mehr.

Ausgelöst hat das Donalds Rückfrage: „Wofür brauchen wir R2? Ist das Storage?
Wir haben bisher Supabase Storage genutzt."

| | |
| --- | --- |
| Geprüft | `openspec validate --all` 31/31 · Zählung 43→40 offen, 69→75 erledigt |
| Neu | `docs/decisions/0005-ota-auf-supabase-statt-cloudflare-r2.md` |
| Gemessen | Bündelgrösse **2,71 MB** (ohne Sourcemaps; 4,43 MB mit) |

## Decisions

- **Heimat: alles auf Supabase** (Donald, 31.08.). Bündel im Storage-Bucket,
  Manifest als Tabelle, drei Edge Functions mit `verify_jwt = false`. Die
  Entscheidung vom 27.08. bleibt unberührt — **„selbst gehostet" war die Wahl
  gegen den bezahlten Ionic-Dienst, nicht für einen Anbieter.**
- **Anlass: jeder Deploy auf `main`** (Donald, 31.08.), im bestehenden
  `deploy.yml`-Job, der `dist/` ohnehin baut.
- **Fassungsschema: `<Semver>+<kurzer SHA>`**, z. B. `1.4.0+8fbc49b` (Donald,
  31.08.). Beantwortet zugleich, was gilt, wenn Store-Bau und `main`-Deploy sich
  überholen: verschiedene SHAs.
- **D2 gemessen statt geraten.** Die Vertragsnummer fährt in **`version_build`** —
  das einzige Feld im POST an `updateUrl`, das auf beiden Plattformen aus
  `plugins.CapacitorUpdater.version` kommt (`…Plugin.java:725`,
  `…Plugin.swift:268`). Der Beleg: **`capacitor.config.json` liegt NEBEN
  `public/`, nicht darin** — OTA tauscht `public/`, die Nummer bleibt der Schale.
  `custom_id` scheidet aus: aus JavaScript gesetzt.
- **Das Spec-Delta blieb unberührt** — es sagt „selbst gehostet" und nennt keinen
  Anbieter. Dass die Korrektur keine Zeile Spec kostete, belegt die richtige
  Flughöhe. Deshalb wurde **2b nicht neu fällig**.

## Zwei Fallen, festgehalten

- **capgo `9.0.0` und `10.0.0` sind Fallen**: höhere Zahl, aber peer
  `@capacitor/core: ^5.0.0`. `latest` ist bewusst **`8.51.15`**.
- **Fehlt der `config.toml`-Block, gilt `verify_jwt = true`** — 401 **vor** dem
  Handler, ohne Spur im Log der Function. Ein Gerät hat kein JWT.

Neue Memory: `capgo-version-build-ist-das-einzige-schalen-feld`. Aktualisiert:
`format-statt-format-check` (139 → **286** unformatierte Bestandsdateien).

## Files modified

Alles in Commit `9fd3a00`:

- `openspec/changes/capacitor-huelle/design.md` — §8 neu: der widerlegte Satz
  sichtbar widerrufen, Vertragsnummer-Tabelle beantwortet, Anlass und
  Fassungsschema, Fassungsfalle; neue Zeile in „Verworfene Alternativen"
- `openspec/changes/capacitor-huelle/proposal.md` — §8 und die Liste des von Hand
  Bereitzustellenden (der R2-Bucket entfällt, das Schlüsselpaar bleibt)
- `openspec/changes/capacitor-huelle/tasks.md` — Phase D neu (D1–D3), sechs
  Aufgaben abgehakt
- `docs/decisions/0005-ota-auf-supabase-statt-cloudflare-r2.md` — **neu**

## Next session: start here

**Der erste Schritt ist Donalds, nicht der Sitzung:** das
**Signaturschlüsselpaar** erzeugen, den privaten Teil nach Infisical. Der
Infisical-Login braucht ein echtes Terminal und geht nicht aus Claude Code
heraus. Ohne den `publicKey` ist D3 nicht abschliessbar — und ohne Signatur wäre
der Endpunkt ein Weg, beliebigen Code auf jedes Gerät zu bringen.

**Parallel dazu baubar, ohne Schlüssel und ohne Gerät:** D1s erste beiden
Aufgaben — Bucket und Manifest-Tabelle, beide **per Migration**, nach dem Muster
der vier bestehenden Buckets. Das ist der erste Code dieser Phase. **Achtung:
Migration + RLS heisst Fremdreviewer** (Donalds Regel vom 26.08.).

Danach der Veröffentlichungs-Schritt in `deploy.yml`, dann D3.

## Open questions — alle innerhalb AGE-642

- **Vier Gerätebelege stehen weiter aus:** C3 auf beiden Plattformen · C2 auf
  Android · C1 auf iOS · B5 der Startbildschirm. **Für B5 muss die App gelöscht
  werden** (Launch-Screen-Zwischenspeicher), **und das kostet Donald die
  Anmeldung** — vorher ansagen.
- **B3 Signaturmaterial (4 offen)** hängt an Zertifikat, Provisioning Profile und
  Keystore — ebenfalls Donalds Hand, ebenfalls nach Infisical.
- **C3 ändert an zwei Stellen die Optik** (`WillkommenPage`, Bearbeiten-Formular
  im Feed): das sichtbare Dateifeld liegt jetzt hinter einem Knopf. Ist gemergt,
  aber noch nie im Browser angesehen worden.
- **`push-fundament` (13 offen)** hängt am selben Gerät.
- **AGE-642 springt beim Merge selbst auf Done** — vorbeugen geht nicht, nur
  nachsehen. Beim letzten Merge zum vierten Mal passiert.
- **Nebenbefund, ausserhalb des Scopes, nicht angefasst:** `ADR-0037` wird an
  drei Stellen zitiert (`.env.example:23`, `docs/foundation-acceptance.md`),
  existiert aber nicht — `docs/decisions/` führt nur 0001–0005.

## Berührungspunkt mit `fbc-platform-f4` — geklärt

f4 nimmt sich `CommunityFeed.tsx` vor (Composer bekommt „Abbrechen"). **Wir haben
dort nichts Offenes.** Ihre Zeilennummern stammten aus einem Worktree ohne #295;
gegen `main` gemessen: `setOffen(false)` in **779**, `URL.revokeObjectURL` in
**775 und 860** (die 860 ist der „×"-Knopf an der Bildkachel und gehört **nicht**
in ihr `zuruecksetzen()`), `useBildauswahl` in 715. Ihre Quellen-Rückfrage
rendert **innerhalb** des Composers (1029) — steht bei ihnen als Browser-Prüfschritt.
Beides gegenseitig bestätigt.
