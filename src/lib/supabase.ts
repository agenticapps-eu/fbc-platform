import { Capacitor } from "@capacitor/core";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import { nativerSitzungsspeicher, sitzungsSchluessel } from "./session-storage";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase-Konfiguration fehlt: VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY müssen " +
      "gesetzt sein. Siehe .env.example und docs/secrets.md.",
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Festgenagelt statt geerbt — warum, steht bei `sitzungsSchluessel`.
    storageKey: sitzungsSchluessel(supabaseUrl),
    // AGE-642: Nur nativ wird der Speicher getauscht. Im Web steht hier
    // ABSICHTLICH nichts — kein Wrapper, kein Präfix, keine eigene
    // Implementierung. `supabase-js` nimmt dann `localStorage`, wie bisher,
    // und eine bestehende Sitzung läuft über den Umbau hinweg weiter. Jede
    // Zeile mehr an dieser Stelle wäre ein Risiko ohne Gegenwert.
    ...(Capacitor.isNativePlatform() ? { storage: nativerSitzungsspeicher } : {}),
  },
});
