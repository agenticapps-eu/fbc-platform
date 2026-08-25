#!/usr/bin/env tsx
/**
 * Zwei verbundene Wegwerf-Konten für den Chat-Test von Hand (AGE-583).
 *
 *   npx tsx scripts/chat-testkonten.ts            # anlegen
 *   npx tsx scripts/chat-testkonten.ts --entfernen # wieder wegräumen
 *
 * WOZU. Nachrichten setzen eine angenommene Kontaktanfrage voraus (`messages_insert`).
 * Auf DEV ist derzeit kein Konto anmeldefähig — seit dem Spiegel DEV ← PROD
 * (AGE-576) sind alle übernommenen Hashes neutralisiert, und die Demo-Welt ist
 * weg. Zwei Menschen, die sich gegenseitig schreiben dürfen, muss man sich
 * deshalb bauen.
 *
 * WARUM GEGEN DEN LOKALEN STACK. Es wird geschrieben — zwei Konten samt Profil,
 * Kontaktanfrage und Unterhaltung. DEV bedient die Live-Seite. Die Adresse ist
 * deshalb fest verdrahtet und wird NICHT aus der Umgebung gelesen: ein Wächter,
 * der nur einen Variablennamen prüft, hält nichts, wenn jemand die Variable
 * anders setzt. Gleiche Begründung wie in scripts/probe-c11-onboarding-merker.ts.
 *
 * DIE UNTERHALTUNG ENTSTEHT NICHT VON HAND. Die Kontaktanfrage wird als
 * `pending` eingefügt und danach auf `accepted` gesetzt. Erst dieser Übergang
 * lässt `contact_requests_lifecycle` laufen, und der Trigger legt den Thread an.
 * Ein direkt als `accepted` eingefügter Datensatz würde zwar auch feuern, aber
 * am echten Weg vorbei — und genau den wollen wir testen.
 */
import pg from "pg";

/** Fest verdrahtet, nicht aus der Umgebung: siehe Kopf. */
const LOKAL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/** Bcrypt-Hash zu „Testchat2026!" — im lokalen Stack, nie anderswo. */
const PASSWORT = "Testchat2026!";

const ANNA = "0aae5830-0000-4000-8000-00000000a11a";
const BERND = "0aae5830-0000-4000-8000-00000000b22b";

const KONTEN = [
  { id: ANNA, mail: "anna@chattest.invalid", name: "Anna Testfall" },
  { id: BERND, mail: "bernd@chattest.invalid", name: "Bernd Testfall" },
];

async function main(): Promise<void> {
  const entfernen = process.argv.includes("--entfernen");
  const c = new pg.Client({ connectionString: LOKAL });
  await c.connect();

  // Wächter: niemals gegen etwas anderes als den lokalen Stack schreiben.
  //
  // Der lokale Stack läuft in Docker; der Server meldet deshalb seine
  // Container-Adresse aus dem Bridge-Netz (172.16.0.0/12), nicht 127.0.0.1.
  // Geprüft wird darum auf private Bereiche — dieselbe Liste wie in
  // scripts/probe-c11-onboarding-merker.ts. Das trennt sauber, worauf es
  // ankommt: DEV und PROD liegen in der Supabase-Cloud hinter öffentlichen
  // Adressen und fallen damit durch.
  const wo = await c.query<{ host: string | null }>("select inet_server_addr()::text as host");
  const host = wo.rows[0].host ?? "unix-socket";
  const privat = /^(127\.|::1|unix-socket|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  if (!privat) {
    throw new Error(`Nicht der lokale Stack (${host}) — Abbruch vor dem ersten Schreiben.`);
  }
  console.log(`Lokaler Stack, Serveradresse ${host}.`);

  try {
    await c.query("begin");

    if (entfernen) {
      await c.query("delete from auth.users where id = any($1::uuid[])", [[ANNA, BERND]]);
      await c.query("commit");
      console.log("Beide Testkonten entfernt (Profile, Anfrage und Unterhaltung hängen per Cascade daran).");
      return;
    }

    // pgcrypto liefert crypt() für einen echten, anmeldefähigen Bcrypt-Hash.
    await c.query("create extension if not exists pgcrypto with schema extensions");

    for (const k of KONTEN) {
      await c.query(
        // Die vier Token-Spalten müssen '' sein, nicht NULL. GoTrue liest sie
        // beim Anmelden in Go-Strings; ein NULL bricht dort ab und erscheint im
        // Browser als „Database error querying schema". Gleiches Muster wie
        // supabase/seed/demo_personas.sql — die probe-*-Skripte brauchen es
        // nicht, weil sie sich nie anmelden, sondern nur JWT-Claims setzen.
        `insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
           email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
           confirmation_token, recovery_token, email_change_token_new, email_change)
         values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
           $2, extensions.crypt($3, extensions.gen_salt('bf')),
           now(), now(), now(),
           '{"provider":"email","providers":["email"]}'::jsonb,
           jsonb_build_object('name', $4::text),
           '', '', '', '')
         on conflict (id) do update
           set encrypted_password = excluded.encrypted_password,
               email_confirmed_at = excluded.email_confirmed_at,
               raw_app_meta_data  = excluded.raw_app_meta_data,
               confirmation_token = '', recovery_token = '',
               email_change_token_new = '', email_change = ''`,
        [k.id, k.mail, PASSWORT, k.name],
      );

      // Ein Trigger auf auth.users kann das Profil schon angelegt haben.
      // activated_at ist Pflicht — ohne es sperrt das Gate aus C3 alles.
      await c.query(
        `insert into public.profiles (id, name, tier, is_public, activated_at, headline)
         values ($1, $2, 'impact', true, now(), $3)
         on conflict (id) do update
           set name = excluded.name, tier = excluded.tier, is_public = excluded.is_public,
               activated_at = excluded.activated_at, headline = excluded.headline`,
        [k.id, k.name, "Zum Testen von Nachrichten"],
      );

      // Die Willkommensstrecke aus C11 würde sonst vor dem Chat stehen.
      await c.query(
        `insert into public.member_settings (profile_id, onboarded_at)
         values ($1, now())
         on conflict (profile_id) do update set onboarded_at = excluded.onboarded_at`,
        [k.id],
      );
    }

    // Der echte Weg: erst anfragen, dann annehmen. Der Übergang legt den Thread an.
    await c.query(
      `insert into public.contact_requests (from_id, to_id, message, status)
       values ($1, $2, 'Testanfrage für den Chat', 'pending')
       on conflict (from_id, to_id) do update set status = 'pending'`,
      [ANNA, BERND],
    );
    await c.query(
      "update public.contact_requests set status = 'accepted' where from_id = $1 and to_id = $2",
      [ANNA, BERND],
    );

    const thread = await c.query<{ id: string }>(
      `select id from public.message_threads
        where (a_profile_id = $1 and b_profile_id = $2)
           or (a_profile_id = $2 and b_profile_id = $1)`,
      [ANNA, BERND],
    );
    if (thread.rows.length === 0) {
      throw new Error("Kein Thread entstanden — der Trigger hat nicht gegriffen. Nichts geschrieben.");
    }

    await c.query("commit");

    console.log(`
Fertig. Zwei verbundene Konten stehen im lokalen Stack.

  ${KONTEN[0].mail}   Passwort: ${PASSWORT}
  ${KONTEN[1].mail}   Passwort: ${PASSWORT}

  Unterhaltung: ${thread.rows[0].id}

Beide sind aktiviert, auf Stufe impact, die Willkommensstrecke ist übersprungen
und die Kontaktanfrage ist angenommen — Schreiben ist also erlaubt.

Wegräumen: npx tsx scripts/chat-testkonten.ts --entfernen
`);
  } catch (fehler) {
    await c.query("rollback");
    throw fehler;
  } finally {
    await c.end();
  }
}

main().catch((fehler: unknown) => {
  console.error(fehler);
  process.exit(1);
});
