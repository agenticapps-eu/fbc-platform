#!/usr/bin/env tsx
/**
 * AGE-581, Aufgabe 1.2 — Nimmt GoTrue ein weit entferntes `banned_until` an,
 * und sperrt es die Anmeldung wirklich? NUR gegen den LOKALEN Stack.
 */
import { createClient } from "@supabase/supabase-js";

const API = "http://127.0.0.1:54321";
if (!API.startsWith("http://127.0.0.1")) throw new Error("nur lokal");
const SERVICE = process.env.LOCAL_SERVICE_ROLE_KEY!;
const ANON = process.env.LOCAL_ANON_KEY!;

const admin = createClient(API, SERVICE, { auth: { persistSession: false } });
const anon = () => createClient(API, ANON, { auth: { persistSession: false } });

const email = `age581-ban-probe@local.host`;
const passwort = "ProbePasswort!2026";

// Aufräumen, falls ein Vorlauf hängengeblieben ist.
const { data: liste } = await admin.auth.admin.listUsers();
for (const u of liste?.users ?? []) if (u.email === email) await admin.auth.admin.deleteUser(u.id);

// `email_confirm: true` ist Pflicht — ohne sie scheitert die Anmeldung schon
// an der fehlenden Bestätigung und die Probe misst den falschen Fehler.
const { data: neu, error: anlegen } = await admin.auth.admin.createUser({
  email, password: passwort, email_confirm: true,
});
if (anlegen) throw anlegen;
const id = neu.user.id;
console.log(`Konto angelegt: ${id}`);

// 1. Anmeldung VOR dem Bann — muss klappen, sonst misst der Rest nichts.
const vorher = await anon().auth.signInWithPassword({ email, password: passwort });
console.log(`1. Anmeldung vor dem Bann: ${vorher.error ? "FEHLER " + vorher.error.message : "erfolgreich"}`);

// 2. Bann setzen. GoTrue nimmt eine DAUER (`ban_duration`), keinen Zeitpunkt.
for (const dauer of ["876000h", "100y", "8760h"]) {
  const { data, error } = await admin.auth.admin.updateUserById(id, { ban_duration: dauer } as never);
  const bis = (data?.user as { banned_until?: string } | undefined)?.banned_until;
  console.log(`2. ban_duration=${dauer.padEnd(8)} -> ${error ? "ABGELEHNT: " + error.message : "angenommen, banned_until=" + bis}`);
  if (!error) break;
}

// 3. Anmeldung NACH dem Bann — muss scheitern.
const nachher = await anon().auth.signInWithPassword({ email, password: passwort });
console.log(`3. Anmeldung nach dem Bann: ${nachher.error ? "abgewiesen (" + nachher.error.status + ") " + nachher.error.message : "ERFOLGREICH — DER BANN WIRKT NICHT"}`);

// 4. Bann aufheben und erneut anmelden — die Umkehrbarkeit ist zugesagt.
const { error: auf } = await admin.auth.admin.updateUserById(id, { ban_duration: "none" } as never);
console.log(`4. Bann aufheben: ${auf ? "FEHLER " + auf.message : "ok"}`);
const wieder = await anon().auth.signInWithPassword({ email, password: passwort });
console.log(`5. Anmeldung nach dem Aufheben: ${wieder.error ? "FEHLER " + wieder.error.message : "erfolgreich"}`);

await admin.auth.admin.deleteUser(id);
console.log("Probekonto entfernt.");
