/**
 * Verhaltenssonde für AGE-438: führt den ECHTEN Avatar-Upload aus, den
 * `saveProfile()` (src/lib/profile.ts) macht — als frisch angelegtes,
 * angemeldetes Mitglied. Meldet die echte Fehlermeldung samt HTTP-Status,
 * nicht nur "DENIED".
 *
 * Warum eine Sonde und kein pgTAP-Test: der Fehler entsteht NICHT in der
 * Policy, sondern im Upsert-Pfad der Storage-API (INSERT … ON CONFLICT DO
 * UPDATE braucht eine SELECT-Policy, die es auf storage.objects bewusst nicht
 * gibt). Nur ein echter HTTP-Upload über storage-js trifft diesen Pfad.
 *
 * Läuft gegen die lokale Instanz (`supabase start`):
 *   eval "$(supabase status -o env | sed 's/^/export PROBE_/')" \
 *     && PROBE_URL=$PROBE_API_URL pnpm exec tsx supabase/tests/probe_avatar_upload.ts
 *
 * Läuft NICHT in CI (wie die anderen probe_*).
 */
import { createClient } from "@supabase/supabase-js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} fehlt — siehe Kopfkommentar für den Aufruf.`);
  return value;
}

const url = required("PROBE_URL");
const anonKey = required("PROBE_ANON_KEY");
const serviceKey = required("PROBE_SERVICE_ROLE_KEY");

const email = `probe-avatar-${Date.now()}@example.com`;
const password = "probe-password-12345";

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (createErr) throw createErr;
const uid = created.user!.id;
console.log(`Testmitglied angelegt: ${email} (${uid})`);

try {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;

  // Gegenprobe: PostgREST muss dieselbe Session als dieses Mitglied sehen.
  // Schlägt das fehl, liegt es am Token — nicht am Storage-Pfad.
  const { data: me, error: meErr } = await client.from("profiles").select("id").eq("id", uid);
  if (meErr || me?.length !== 1) {
    throw new Error(
      `PostgREST sieht die eigene Profil-Zeile nicht: ${meErr?.message ?? me?.length}`,
    );
  }

  // Exakt der Aufruf aus saveProfile(): Pfad `{uid}/{timestamp}.webp`.
  const blob = new Blob([new Uint8Array([0x52, 0x49, 0x46, 0x46])], { type: "image/webp" });
  const path = `${uid}/${Date.now()}.webp`;
  const { error: uploadErr } = await client.storage
    .from("avatars")
    .upload(path, blob, { contentType: "image/webp" });

  if (uploadErr) {
    console.error(`\n❌ UPLOAD FEHLGESCHLAGEN für ${path}`);
    console.error(JSON.stringify(uploadErr, Object.getOwnPropertyNames(uploadErr), 2));
    process.exitCode = 1;
  } else {
    console.log(`\n✅ Upload OK: ${path}`);
    await admin.storage.from("avatars").remove([path]);
  }
} finally {
  await admin.auth.admin.deleteUser(uid);
  console.log("Testmitglied entfernt.");
}
