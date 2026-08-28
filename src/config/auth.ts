/**
 * Mindestlänge eines Passworts, gemeinsam für jede Oberfläche, die eines
 * entgegennimmt (AGE-656).
 *
 * Muss zu `minimum_password_length` (`supabase/config.toml:230`) und
 * `MIN_PASSWORT` in `supabase/functions/redeem-activation/index.ts` passen. Die
 * beiden liegen ausserhalb des Frontend-Bündels und können diesen Wert nicht
 * importieren; sie halten je eine eigene Kopie. Wer hier ändert, ändert dort mit.
 *
 * Eine Oberfläche, die weniger annimmt, verwandelt eine Feldmeldung in einen
 * Serverfehler und lässt das Passwort unverändert
 * (`openspec/specs/access-control/spec.md`).
 */
export const MIN_PASSWORT_LAENGE = 10;
