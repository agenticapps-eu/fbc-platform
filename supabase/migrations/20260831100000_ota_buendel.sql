-- OTA, Teil 1: der Speicher (AGE-642, Phase D1). Donald, 2026-08-31.
-- Spec: openspec/changes/capacitor-huelle/, Entwurf §8, ADR-0005.
--
-- Zwei Dinge, ein Schritt: der Bucket, in dem ein Bündel liegt, und die
-- Tabelle, die es benennt. Die drei Endpunkte (D3) und der
-- Veröffentlichungs-Schritt in `deploy.yml` (D1, dritter Punkt) kommen danach;
-- ohne sie ist hier ein Speicher, den nichts befüllt — das ist Absicht und
-- nicht Unfertigkeit, weil beide Hälften ohne diesen Speicher nirgends
-- hinschreiben könnten.
--
-- ══ MESSUNGEN AM PLUGIN, 31.08. ═════════════════════════════════════════════
-- Gelesen wurde `@capgo/capacitor-updater@8.51.15` — dieselbe Fassung, die D3
-- hinzufügt. Nicht die Dokumentation, der Quelltext. Vier Befunde tragen die
-- Entscheidungen unten, und der erste widerlegt eine Zeile, die am Vormittag
-- desselben Tages als belegt galt.
--
-- 1. **RSA-2048, nicht 4096.** `decryptChecksum` bricht ab, wenn das Chiffrat
--    der Prüfsumme NICHT GENAU 256 Byte lang ist — hart, auf beiden
--    Plattformen (`CryptoCipher.java:254`, `CryptoCipher.swift:74`), mit der
--    Meldung „Checksum is not RSA encrypted". 256 Byte heißt RSA-2048. Der am
--    31.08. erzeugte und in Infisical hinterlegte Schlüssel hat **4096 Bit**
--    und liefert gemessen **512 Byte**. Er ist damit unbrauchbar, und zwar
--    still: das Bündel lädt, die Prüfung schlägt fehl, das Gerät bleibt auf
--    der alten Fassung. Der Schlüssel muss neu erzeugt werden — Donalds Hand,
--    siehe tasks.md D1.
--
-- 2. **Die Prüfsumme gehört zum ENTSCHLÜSSELTEN Zip.** In `CapgoUpdater.java`
--    (Z. 851–856) wird erst `decryptFile` gerufen, dann `calcChecksum` auf
--    derselben Datei. Verglichen wird also die SHA-256 des KLARTEXT-Zips, nicht
--    die des Chiffrats. Verschlüsselt und übertragen werden die **32 rohen
--    Digest-Bytes**; das Gerät hext sie selbst auf (`decryptChecksum`, Z. 266)
--    und vergleicht mit `calcChecksum`, das Kleinbuchstaben-Hex liefert.
--
-- 3. **`sessionKey` trägt zwei Werte, durch Doppelpunkt getrennt** —
--    `<iv>:<sessionKey>`, beides Base64 (`CryptoCipher.java:151-152`). Der IV
--    ist NICHT verschlüsselt, nur der AES-Schlüssel ist es. Ein Feld ohne
--    Doppelpunkt wird kommentarlos als „Verschlüsselung nicht gesetzt"
--    behandelt (Z. 141) — die Datei bliebe Chiffrat, das Entpacken scheiterte,
--    und niemand erführe warum.
--
-- 4. **`version_build` ist eine unvalidierte Zeichenkette** auf beiden
--    Plattformen (`CapacitorUpdaterPlugin.java:725`,
--    `CapacitorUpdaterPlugin.swift:268`) — ABER derselbe Config-Wert wird eine
--    Zeile später als Semver geparst (`java:730` über
--    `io.github.g00fy2:versioncompare`, `swift:262` über `mrackwitz/Version`).
--    Eine blanke Zahl wie `2` wäre auf iOS ein stiller Fehlschlag:
--    `currentVersionNative` bliebe `0.0.0` und die Verzögerungslogik rechnete
--    mit dem falschen Wert. Deshalb ist die Vertragsnummer der Schale
--    **semver-förmig** und nicht ganzzahlig.
--
-- Forward-only.

-- ── 1. Bucket `ota-buendel` ─────────────────────────────────────────────────
-- Vorlage: 20260811090200_covers_storage.sql (öffentlicher Bucket).
--
-- **Öffentlich, und die Begründung dafür ist NICHT die Verschlüsselung.**
-- Der erste Entwurf dieser Zeile behauptete, im Bucket liege Chiffrat, also sei
-- öffentlich unbedenklich. Das hält nicht: der öffentliche Schlüssel steckt in
-- jeder ausgelieferten App, und der `sessionKey` kommt vom
-- Aktualisierungs-Endpunkt, der ohne JWT antwortet. Wer beides holt,
-- entschlüsselt das Bündel. **Die Verschlüsselung trägt Echtheit, nicht
-- Vertraulichkeit** (Befund aus dem Fremd-Review zu diesem Diff, MEDIUM).
--
-- Was trägt, ist einfacher: **im Bündel steht dasselbe `dist/`, das Cloudflare
-- Pages ohnehin an jeden ausliefert.** Es gibt hier nichts zu verbergen. Zu
-- schützen ist allein, dass niemand ANDEREN Code unterschiebt — und das leistet
-- die Signatur, nicht der Bucket.
--
-- **KEINE Policy, und auch das ist eine Aussage.** Kein Client liest oder
-- schreibt diesen Bucket je: das Gerät lädt über die öffentliche URL, und
-- geschrieben wird allein aus `deploy.yml` mit `SUPABASE_SERVICE_ROLE_KEY`.
-- Am lokalen Katalog gemessen (31.08.): `service_role` trägt `rolbypassrls =
-- true` UND alle sieben Rechte auf `storage.objects`. Eine Policy wäre totes
-- Gewicht, das aussieht wie Zugriffskontrolle.
--
-- **8 MiB.** Ein Bündel misst heute 2,71 MB (gezippt, ohne Sourcemaps). Die
-- Grenze ist der Fangnetz gegen einen entgleisten Upload, NICHT gegen
-- versehentlich mitgelieferte Sourcemaps — die wögen 4,43 MB und kämen durch.
-- Deren Ausschluss gehört in den Veröffentlichungs-Schritt, wo er sich prüfen
-- lässt; eine Grenze knapp unter 4,43 MB gäbe dafür nur 1,5-fachen Spielraum
-- über dem heutigen Stand und fiele bei normalem Wachstum in wenigen Monaten.
--
-- **`application/octet-stream`, nicht `application/zip`.** Es liegt ein
-- AES-Chiffrat im Bucket, kein Zip. Der Downloader des Plugins prüft den
-- Content-Type nicht (kein Treffer in `DownloadService.java`), also entscheidet
-- allein, was ehrlich ist.
--
-- `on conflict (id) do update` und nicht `do nothing`: ein bestehender Bucket
-- mit falschen Einstellungen würde sonst konserviert und der Test liefe grün
-- gegen eine falsche Konfiguration. Übernommen aus dem C6-Review.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ota-buendel', 'ota-buendel', true, 8388608, array['application/octet-stream'])
on conflict (id) do update
  set name               = excluded.name,
      public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
-- `name` steht hier, anders als in den vier älteren Bucket-Migrationen. Deren
-- erklärter Zweck ist, einen bestehenden Bucket mit falschen Einstellungen NICHT
-- zu konservieren; `name` gehört dazu, und die Auslassung war dort ein
-- Versehen, keine Entscheidung (Befund aus dem Fremd-Review, LOW).

-- ── 2. Manifest-Tabelle `ota_buendel` ───────────────────────────────────────
-- Die Spaltennamen `version`, `url`, `checksum` und `session_key` sind die
-- Feldnamen aus der Antwort an `updateUrl` (`CapacitorUpdaterPlugin.java:3865
-- ff.`). Das ist kein Zufall und soll keiner werden: der Endpunkt in D3 bildet
-- die Zeile eins zu eins ab, und jede Umbenennung hier wäre eine
-- Übersetzungsschicht, die jemand pflegen muss.
create table public.ota_buendel (
  -- `<Semver aus package.json>+<kurzer SHA>`, z. B. `1.4.0+8fbc49b`
  -- (Entscheidung Donald, 31.08.). Der Primärschlüssel ist die Fassung selbst:
  -- zwei Bündel derselben Fassung gäbe es nur, wenn derselbe Commit zweimal
  -- ausgeliefert würde, und das ist ein Überschreiben, kein zweiter Eintrag.
  version           text        primary key
                    constraint ota_buendel_version_form
                    -- Keine führenden Nullen: `01.4.0` ist kein gültiges Semver
                    -- und käme sonst durch (Befund Fremd-Review, MEDIUM).
                    -- BEWUSSTE GRENZE: Vorabfassungen wie `1.4.0-rc.1` weist
                    -- diese Bedingung ab. Das Projekt kennt keine; entstünde je
                    -- eine, fällt der Veröffentlichungs-Schritt LAUT aus (rote
                    -- CI), nicht still — deshalb ist die enge Fassung hier die
                    -- sicherere.
                    check (version ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\+[0-9a-f]{7,40}$'),

  -- Die öffentliche URL des Chiffrats im Bucket, wörtlich so, wie das Gerät
  -- sie bekommt.
  --
  -- Gebunden an den Pfad UNSERES Buckets, nicht bloß an `https://` (Befund
  -- Fremd-Review, MEDIUM). Das ist die Bedingung, die verhindert, dass eine
  -- Manifest-Zeile Geräte auf einen fremden Host schickt — genau der Fall, gegen
  -- den die Signatur die letzte und nicht die erste Verteidigung sein soll. Der
  -- Host bleibt offen, weil er sich mit einer eigenen Domain ändern kann; Pfad
  -- und Bucket-Name sind das Tragende.
  url               text        not null
                    constraint ota_buendel_url_zeigt_auf_bucket
                    check (url ~ '^https://[a-z0-9.-]+/storage/v1/object/public/ota-buendel/[^[:space:]]+$'),

  -- Die SHA-256 des KLARTEXT-Zips (32 rohe Bytes), mit dem PRIVATEN
  -- RSA-Schlüssel verschlüsselt, das Chiffrat als Kleinbuchstaben-Hex.
  --
  -- **Die 512 Zeichen sind Befund 1 oben, in die Datenbank geschrieben.**
  -- RSA-2048 liefert 256 Byte Chiffrat = 512 Hex-Zeichen; das Plugin bricht bei
  -- jeder anderen Länge ab. Mit dem 4096-Bit-Schlüssel stünden hier 1024
  -- Zeichen — diese Bedingung weist ihn beim Schreiben ab, statt dass jedes
  -- Gerät das Bündel schweigend verweigert.
  checksum          text        not null
                    constraint ota_buendel_checksum_rsa2048_hex
                    -- `length(...) = 512` und nicht `{512}` im Muster: Postgres
                    -- begrenzt Wiederholungszaehler in regulaeren Ausdruecken auf
                    -- 255 und weist `{512}` zur Laufzeit mit 2201B ab — also erst
                    -- beim ersten INSERT, nicht beim Anlegen der Bedingung.
                    check (checksum ~ '^[0-9a-f]+$' and length(checksum) = 512),

  -- `<iv>:<sessionKey>`, beides Base64 (Befund 3). Fehlt der Doppelpunkt, hält
  -- das Plugin die Verschlüsselung für abgeschaltet und entpackt Chiffrat —
  -- deshalb steht die Form hier als Bedingung und nicht als Kommentar.
  --
  -- Beide Hälften haben eine FESTE Länge, und die steht hier als Bedingung
  -- (Befund Fremd-Review, MEDIUM — die erste Fassung liess `A:A` durch):
  --   * IV: AES/CBC, also 16 Byte -> 24 Base64-Zeichen.
  --   * sessionKey: RSA-2048-Chiffrat, 256 Byte -> 344 Base64-Zeichen. Dieselbe
  --     Zahl wie bei der Prüfsumme, und aus demselben Grund: ein
  --     4096-Bit-Schlüssel ergäbe 684 und wird abgewiesen.
  -- `length(…)` statt `{24}`/`{344}` im Muster, weil Postgres
  -- Wiederholungszähler über 255 zur Laufzeit mit 2201B abweist.
  session_key       text        not null
                    constraint ota_buendel_session_key_form
                    check (session_key ~ '^[A-Za-z0-9+/]+={0,2}:[A-Za-z0-9+/]+={0,2}$'
                       and length(split_part(session_key, ':', 1)) = 24
                       and length(split_part(session_key, ':', 2)) = 344),

  -- Die Vertragsnummer der nativen Schale, die dieses Bündel VORAUSSETZT.
  -- Verglichen wird sie gegen `version_build` aus dem POST des Geräts, und der
  -- Vergleich ist zahlenweise über `string_to_array(…, '.')::int[]` — ein
  -- Zeichenkettenvergleich stellte `10.0.0` vor `9.0.0`.
  --
  -- Semver-förmig wegen Befund 4: derselbe Wert wird auf dem Gerät als Semver
  -- geparst. Die Regel „die Nummer steigt in jedem PR, der ein Plugin
  -- hinzufügt" (design.md §8) heißt hier also: `1.0.0` → `2.0.0`.
  benoetigte_schale text        not null
                    constraint ota_buendel_schale_form
                    -- Höchstens vier Stellen je Zahl und keine führenden
                    -- Nullen: der zahlenweise Vergleich wandelt nach `int[]`, und
                    -- `999999999999.0.0` liefe dort über (Befund Fremd-Review,
                    -- MEDIUM). Eine Vertragsnummer, die 9999 überschreitet, gäbe
                    -- es erst nach zehntausend Schalen-Releases.
                    check (benoetigte_schale ~ '^(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})$'),

  created_at        timestamptz not null default now()
);

comment on table public.ota_buendel is
  'Manifest der per Luftweg auslieferbaren Bündel (AGE-642, Phase D). Eine '
  'Zeile je veröffentlichtem `dist/`. RLS ist an und es gibt ABSICHTLICH keine '
  'Policy und keinen Grant für anon/authenticated — gelesen wird die Tabelle '
  'allein vom Aktualisierungs-Endpunkt, geschrieben allein vom '
  'Veröffentlichungs-Schritt in deploy.yml, beide mit der Service-Rolle über '
  'SECURITY-DEFINER-Funktionen (D3). Wer hier eine "fehlende" Policy '
  'nachreicht, macht den Auslieferungsweg für Clients beschreibbar.';

comment on column public.ota_buendel.version is
  '<Semver aus package.json>+<kurzer SHA>, z. B. 1.4.0+8fbc49b. Eindeutig und '
  'auf genau einen Commit rückführbar.';
comment on column public.ota_buendel.url is
  'Öffentliche URL des AES-Chiffrats im Bucket ota-buendel.';
comment on column public.ota_buendel.checksum is
  'SHA-256 des KLARTEXT-Zips (32 rohe Bytes), mit dem privaten RSA-Schlüssel '
  'verschlüsselt, Chiffrat als Kleinbuchstaben-Hex. Genau 512 Zeichen: das '
  'Plugin verlangt 256 Byte Chiffrat, also RSA-2048.';
comment on column public.ota_buendel.session_key is
  'iv:sessionKey, beides Base64. Der IV ist unverschlüsselt, der AES-Schlüssel '
  'ist mit dem privaten RSA-Schlüssel verschlüsselt.';
comment on column public.ota_buendel.benoetigte_schale is
  'Vertragsnummer der nativen Schale, die dieses Bündel voraussetzt. Wird gegen '
  'version_build aus dem Geräte-POST verglichen, zahlenweise.';

alter table public.ota_buendel enable row level security;

-- KEIN Grant für anon/authenticated. Muster: `activation_tokens`
-- (20260806080000). Die Abwesenheit ist in grants_test.sql §4 als eigene
-- Zusage festgehalten, damit sie von einem Versehen unterscheidbar bleibt;
-- ota_buendel_test.sql tut dasselbe für diese Tabelle.
