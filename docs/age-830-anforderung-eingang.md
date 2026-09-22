# AGE-830 — Anforderungen aus ChatGPT direkt nach Linear

Arbeitsauftrag für Claude Code. Start in einer frischen Sitzung mit:

> Lies `docs/age-830-anforderung-eingang.md` und arbeite den Auftrag darin ab.

Zugehörig: `docs/decisions/0006-anforderungen-direkt-nach-linear.md`,
`docs/custom-gpt-anforderungen.md`, Linear AGE-830.

**Von Hand erledigt (22.09.):** Triage im Team AgenticApps an · Labels
`von-detlev` und `Idee` angelegt · `LINEAR_API_KEY` und
`ANFORDERUNG_SCHLUESSEL` in Infisical `fbc-platform` (dev + prod).

---

## Auftrag

Lies zuerst AGE-830 über das Linear-MCP. Das Issue trägt die Zusagen und die
Abgrenzung. Es ist die Anforderung, nicht dieser Prompt. Lies dann
`docs/decisions/0006-anforderungen-direkt-nach-linear.md` (warum, und was
am 22.09. gemessen wurde) und `docs/custom-gpt-anforderungen.md` (der
Vertrag mit dem GPT, Teil 4 ist das OpenAPI-Schema).

Ziel: Edge Function `anforderung-eingang`, die von einem Custom GPT
(ChatGPT-Action) Titel, Beschreibung, Art, Einreicher, optional Route und
bis zu 10 Dateien entgegennimmt und daraus direkt ein Linear-Issue mit
eingebetteten Bildern anlegt.

Beginne mit /opsx:propose für einen Change namens `anforderung-eingang`.

## Vorwissen, das nicht im Issue steht

**Durch einen Test belegt (22.09.):**
- Der Supabase-Gateway nimmt bei `verify_jwt = false` Aufrufe mit NUR dem
  Header `x-anforderung-schluessel` an. Kein `apikey`-Header nötig. Edge
  Function ist der richtige Wirt.
- ChatGPT schickt Dateien im Body-Feld `openaiFileIdRefs` als Array von
  Objekten `{ name, id, mime_type, download_link }`, auch für Bilder, die
  der GPT selbst erzeugt hat. Die `download_link` gelten 5 MINUTEN. Die
  Function muss sie sofort im selben Aufruf laden, nicht asynchron.
  Im OpenAPI-Schema ist das Feld als `array` von `string` deklariert — das
  ist die von OpenAI dokumentierte Form, trotzdem kommen Objekte. Defensiv
  parsen: Strings ohne Link als „nicht übertragen“ vermerken, nicht werfen.

**Linear-Datei-Upload (neu gegenüber AGE-781):**
1. GraphQL `fileUpload(contentType, filename, size)` → `uploadFile { uploadUrl,
   assetUrl, headers { key value } }`
2. `PUT uploadUrl` mit dem Dateiinhalt, `Content-Type`, allen gelieferten
   `headers` und `Cache-Control: public, max-age=31536000`
3. `assetUrl` in die Beschreibung: Bilder als `![name](assetUrl)`, Videos
   als `[name](assetUrl)`.
Prüfe die aktuelle Form gegen die Linear-Doku (Context7), rate nicht.

**Vorbild:** callbot-Repo, `apps/test-page/functions` aus AGE-781 (PR #114,
#116) für `issueCreate` und den Umgang mit dem Token. Im eigenen Repo:
`stripe-webhook` und `send-activation` für `verify_jwt = false`,
`notify-contact-request` für den Fremdaufruf, `send-activation/emails.ts`
für reine Logik in einer eigenen, unter Deno testbaren Datei.

**Konstanten, nicht vom Aufrufer wählbar:** Team-ID
`edf1f698-4f91-4caf-b87e-d129419a90c5` (AgenticApps), Projekt-ID
`b815c05b-f6ed-413c-95a2-755cde30e916` (eff.bee.zee — Backlog), Labels
`von-detlev` `ec4878f0-7a29-42e1-b294-8ab40ef9d1d6`, `Idee`
`1eceb218-58a8-4739-a643-7eeca6583eff`, `Bug`
`c7e397f3-ae8e-4cb0-8ac3-3fcd471af0e7`, `Improvement`
`dd58d928-d4ec-4b45-b092-39d2f7a51edd`, `Feature`
`53ebd9d4-5ed8-44b4-851e-5818336af38c`. Zustand Triage
`ee8d6b49-8806-4e92-9878-7238f5421632`.

**Beschreibung im Issue**, in dieser Reihenfolge: der Text vom GPT
unverändert · Abschnitt „Bilder“ mit den eingebetteten Dateien · Fußzeile
„Eingereicht von {einreicher} über ChatGPT · {Datum Europe/Berlin} ·
Route: {route|unklar}“. Fehlgeschlagene Dateien mit Namen und Grund
vermerken. Das Issue wird trotzdem angelegt.

**Grenzen:** höchstens 10 Dateien, erlaubte Typen image/png, image/jpeg,
image/webp, image/gif, video/mp4, video/quicktime. Größengrenze je Datei:
schlag mir einen Wert vor, begründet mit dem Speicherlimit der Edge
Function.

**Antworten** (Schema in `docs/custom-gpt-anforderungen.md`, Teil 4):
- 201 `{ nummer: "AGE-…", hinweis }`, keine URL
- 400 `{ fehler }` in ganzen deutschen Sätzen, zum Vorlesen
- 401, 429

**Secrets.** Liegen bereits in Infisical, Projekt `fbc-platform`, in den
Umgebungen `dev` und `prod`: `LINEAR_API_KEY` (in beiden gleich) und
`ANFORDERUNG_SCHLUESSEL` (je Umgebung verschieden). Die Function liest sie
aus dem **Supabase-Functions-Secret-Store**, nicht aus Infisical. Übernimm
den Weg aus `docs/secrets.md`, Abschnitt „Supabase Edge Function secrets“
(`infisical run --env=<env> -- supabase secrets set --project-ref <ref> …`),
und trag beide Secrets dort in die Tabelle und den Befehl ein. Beachte die
dort dokumentierte Falle mit lautlos beschädigten Werten und prüfe nach dem
Setzen per SHA-256 gegen `supabase secrets list`. `.env.example` mit
Platzhaltern.

## Fallstricke in diesem Repo

- Nach JEDEM `pnpm build`, vor jedem `git add`:
  `git checkout -- src/content/release-entries.generated.ts`
- Branch `donald/age-830-anforderung-eingang` steht schon. Darauf liegen
  noch nicht committet: ADR-0006, `docs/custom-gpt-anforderungen.md` und
  dieses Dokument. Committe sie als ERSTEN, eigenen Commit
  (`docs: ... (AGE-830)`), bevor du etwas anderes anfasst.
- `supabase/functions/bildtest/` ist ein Testrest vom 22.09. NICHT
  committen. Am Ende löschen und `supabase functions delete bildtest
  --project-ref foelowldexkcqzewvrcf` als Schritt für mich nennen.
- Conventional Commits: `feat: ... (AGE-830)`, ein Commit je logischer
  Änderung, signiert.
- Ändert sich an Feldern, Grenzen oder Antworten etwas gegenüber
  `docs/custom-gpt-anforderungen.md`, zieh das Dokument im selben PR nach.
- Setz AGE-830 in Linear auf In Progress, wenn du anfängst.
- Keine Secrets ins Repo.
- `openspec validate --all` muss grün bleiben.
- Kein Datenbankzugriff nötig außer für die Rate-Begrenzung (Muster
  `activation_attempts`). Wenn du dafür eine Migration brauchst: neue
  Migration, nie eine bestehende ändern.

## Was ich von dir erwarte, bevor du Code schreibst

1. In welche Capability das Spec-Delta geht (bestehende oder neue
   `anforderungen`), mit Begründung. Ich entscheide.
2. Deinen Vorschlag für die Größengrenze.
3. Wie du testest, ohne bei jedem Lauf ein echtes Issue anzulegen
   (Trockenlauf-Schalter per Secret, Mock des Linear-Aufrufs in den
   Deno-Tests).
4. Stellen, an denen du dir unsicher bist, statt eine Seite zu wählen.

---

## Danach von Hand (Donald)

1. Secrets in beide Supabase-Projekte übertragen (Befehl steht dann in
   `docs/secrets.md`), per Hash prüfen.
2. Eigenen Test-GPT gegen DEV durchspielen: Screenshot + Zielbild → Issue in
   Triage mit beiden Bildern.
3. `bildtest` Function und Test-GPT löschen.
4. PROD-Schlüssel an Detlev übergeben (Telefon, nicht Mail).
5. GPT bei Detlev in **seinem** Konto einrichten nach
   `docs/custom-gpt-anforderungen.md`, Only me.
6. Eine Runde gemeinsam an einem echten Fall üben.
