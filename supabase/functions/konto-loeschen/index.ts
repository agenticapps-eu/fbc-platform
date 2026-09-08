// konto-loeschen — ein Mitglied löscht sein eigenes Konto (AGE-708).
// Spec: openspec/changes/kontoloeschung/.
//
// ══ WOFÜR ══════════════════════════════════════════════════════════════════
// Apple verlangt seit 2022: wer ein Konto in der App anlegen kann, muss es in
// der App löschen können. In AGE-644 ist das eine harte Abnahmezeile.
//
// ══ WARUM EINE EDGE FUNCTION ═══════════════════════════════════════════════
// Zwei Dinge kann die Datenbank nicht: `auth.users` löschen (das gehört
// GoTrue) und Objekte aus dem Storage räumen. Beides braucht `service_role`
// über die Admin-API. Die Anonymisierung selbst macht die Datenbank —
// `konto_anonymisieren`, deren EXECUTE ausschliesslich bei `service_role`
// liegt, damit niemand über die Datenbank-API einen Halbzustand erzeugen kann.
//
// ══ DIE REIHENFOLGE, UND WARUM SIE SO HERUM IST ════════════════════════════
//
//   1. Dateien        2. anonymisieren        3. auth.users
//
// Der erste Entwurf hatte `auth.users` VOR den Dateien. Der Plan-Review hat
// das mit HIGH verworfen (codex), und die Begründung, die er dafür angab —
// Objekteigentum verhindere die Nutzerlöschung — misst sich auf DIESEM Schema
// zwar nicht (`storage.objects` trägt keinen Fremdschlüssel auf `auth.users`,
// gemessen am 08.09.). Der Befund trägt trotzdem, nur aus dem zweiten Grund:
//
//   Ist `auth.users` erst fort, kann bei einem Abbruch NIEMAND mehr die
//   Dateipfade nachschlagen — der Aufrufer hat keine Sitzung mehr, und ohne
//   Sitzung gibt es keinen zweiten Versuch.
//
// Ein Abbruch hinterlässt deshalb immer einen Zustand, der ZU WENIG gelöscht
// hat, nie einen, der zu viel gelöscht hat. Der erste ist heilbar, der zweite
// nicht.
//
// Schritt 2 sperrt das Konto nebenbei serverseitig: `konto_anonymisieren`
// setzt `deleted_at`, `is_activated()` liest es, und 34 von 34 schreibenden
// Policies prüfen `is_activated()`. Ein noch gültiges Zugriffstoken — das ein
// `deleteUser()` nämlich NICHT entwertet — kann ab diesem Punkt nichts mehr
// schreiben.
//
// ══ WARUM DIE KENNUNG AUS DEM TOKEN KOMMT ══════════════════════════════════
// `verify_jwt = true` (siehe config.toml): das Gateway prüft das ES256-Token
// vollständig, BEVOR dieser Handler läuft. Das ist der Verifikationsort, und
// er ist bewusst nicht der Handler — unter den asymmetrischen
// Signaturschlüsseln der Produktion liefert `getUser()` null und `getClaims()`
// scheitert am JWKS-Abruf (gemessen in AGE-259). `jwtSub` liest den `sub`
// deshalb aus einem bereits geprüften Token; es ist ein Auslesen, keine
// Prüfung, und genau deshalb hängt alles daran, dass der config-Block steht.
// Bewacht von `scripts/functions-config.test.ts`.
//
// ══ WAS SIE NICHT TUT ══════════════════════════════════════════════════════
// Freitext umschreiben. Eine Nachricht, in der jemand seine Nummer nennt, und
// eine @-Erwähnung im Beitrag eines anderen bleiben stehen — sie sind die
// Aussage eines anderen Menschen (design.md D9).
//
// Secrets: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (plattform-injiziert).
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";
import { jwtSub } from "../create-checkout-session/checkout.ts";
import {
  antwortFuer,
  BUCKETS,
  objektPfade,
  pruefeAuftrag,
  type Schritt,
  unterordner,
} from "./loeschen.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const JSON_CORS = { ...CORS, "content-type": "application/json" };

const log = (level: "info" | "warn" | "error", event: string, f: Record<string, unknown> = {}) =>
  console[level === "info" ? "log" : level](JSON.stringify({ fn: "konto-loeschen", event, ...f }));

/**
 * Räumt einen Bucket unterhalb von `<uid>/` leer, Unterordner eingeschlossen.
 *
 * Ein fehlendes Objekt ist kein Fehler: im Objektspeicher dieses Projekts
 * liegen nachweislich Waisen, und ein Konto ohne Bilder ist der Normalfall,
 * nicht die Ausnahme.
 */
async function raeumeBucket(
  client: SupabaseClient,
  bucket: string,
  uid: string,
): Promise<void> {
  // Breitensuche statt Rekursion: die Tiefe ist unbekannt (post-media legt je
  // Beitrag einen Unterordner an), und eine Warteschlange kommt ohne
  // Tiefenbegrenzung aus, die man falsch raten könnte.
  const offen = [uid];
  while (offen.length > 0) {
    const praefix = offen.shift()!;
    const { data, error } = await client.storage.from(bucket).list(praefix, { limit: 1000 });
    if (error) throw error;
    const eintraege = (data ?? []).map((e) => ({ name: e.name, id: e.id }));

    const pfade = objektPfade(praefix, eintraege);
    if (pfade.length > 0) {
      const { error: delErr } = await client.storage.from(bucket).remove(pfade);
      if (delErr) throw delErr;
    }
    offen.push(...unterordner(praefix, eintraege));
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: JSON_CORS,
    });
  }

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const sub = token ? jwtSub(token) : undefined;
  const rumpf = await req.json().catch(() => null);

  const pruefung = pruefeAuftrag(sub, rumpf);
  if (!pruefung.ok) {
    log("warn", "abgelehnt", { status: pruefung.status, grund: pruefung.grund });
    return new Response(JSON.stringify({ error: pruefung.grund }), {
      status: pruefung.status,
      headers: JSON_CORS,
    });
  }
  const uid = sub!;

  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const erledigt: Record<Schritt, boolean> = {
    dateien: false,
    anonymisieren: false,
    auth: false,
  };

  // ── 1. Dateien ────────────────────────────────────────────────────────────
  try {
    for (const bucket of BUCKETS) await raeumeBucket(client, bucket, uid);
    erledigt.dateien = true;
  } catch (e) {
    log("error", "dateien_fehlgeschlagen", { fehler: String(e) });
  }

  // ── 2. Anonymisieren ──────────────────────────────────────────────────────
  // Auch wenn Schritt 1 scheiterte: die Anonymisierung ist der Schritt, der den
  // Personenbezug nimmt UND das Konto sperrt. Ihn wegen liegengebliebener
  // Bilder auszulassen hiesse, das Wichtigere dem Unwichtigeren zu opfern.
  try {
    const { error } = await client.rpc("konto_anonymisieren", { p_profile_id: uid });
    if (error) throw error;
    erledigt.anonymisieren = true;
  } catch (e) {
    log("error", "anonymisieren_fehlgeschlagen", { fehler: String(e) });
  }

  // ── 3. auth.users ─────────────────────────────────────────────────────────
  // ZULETZT, und nur wenn anonymisiert wurde: waere die Identitaet fort und die
  // Profilzeile noch gefuellt, gaebe es niemanden mehr, der den Rest nachholen
  // koennte — der Aufrufer haette keine Sitzung mehr.
  if (erledigt.anonymisieren) {
    try {
      const { error } = await client.auth.admin.deleteUser(uid);
      if (error) throw error;
      erledigt.auth = true;
    } catch (e) {
      log("error", "auth_loeschen_fehlgeschlagen", { fehler: String(e) });
    }
  }

  const { status, rumpf: antwort } = antwortFuer(erledigt);
  log(status === 200 ? "info" : "warn", "abgeschlossen", { status, ...erledigt });
  return new Response(JSON.stringify(antwort), { status, headers: JSON_CORS });
});
