import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../ui/Button";
import { Card, CardDescription, CardTitle } from "../ui/Card";
import { Input } from "../ui/Input";
import { findProfiles, type AdminSearchHit } from "../../lib/admin-profile";

/**
 * Der Einstieg in die Admin-Bearbeitung eines einzelnen Mitglieds (AGE-498).
 *
 * WARUM ES DAS ÜBERHAUPT GIBT: `/p/:id` liest `profiles_public`, und die Sicht
 * verlangt ein bestätigtes ZIELPROFIL. Ein importiertes, noch unbestätigtes
 * Mitglied — der Anlassfall — ist dort für niemanden auffindbar. Ohne diese
 * Suche müsste der Admin die Kennung aus der Datenbank holen, also genau das
 * tun, was C6 abschaffen soll.
 *
 * WAS ES BEWUSST NICHT IST: eine Mitgliederliste. Kein Blättern, kein Filtern,
 * keine Gesamtansicht — `admin_find_profile` verlangt drei Zeichen und gibt
 * höchstens 20 Treffer. Die Liste ist AGE-304.
 */
export function MemberLookup() {
  const [needle, setNeedle] = useState("");
  const [treffer, setTreffer] = useState<AdminSearchHit[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function suchen() {
    setFehler(null);
    setLaeuft(true);
    try {
      setTreffer(await findProfiles(needle.trim()));
    } catch (e) {
      setTreffer(null);
      setFehler(e instanceof Error ? e.message : "Suche fehlgeschlagen.");
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <CardTitle>Mitglied suchen</CardTitle>
        <CardDescription>
          Login-Adresse oder Name, mindestens drei Zeichen. Findet auch Konten, die noch
          nicht bestätigt sind — die stehen in keinem Verzeichnis.
        </CardDescription>
      </div>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void suchen();
        }}
      >
        <div className="min-w-64 flex-1">
          <Input
            value={needle}
            onChange={(e) => setNeedle(e.target.value)}
            placeholder="name@beispiel.de oder Nachname"
            aria-label="Suchbegriff"
          />
        </div>
        <Button type="submit" variant="ghost" disabled={laeuft || needle.trim().length < 3}>
          {laeuft ? "Suche…" : "Suchen"}
        </Button>
      </form>

      {fehler && <p className="text-sm text-danger">{fehler}</p>}

      {treffer && treffer.length === 0 && (
        <p className="text-sm text-muted">Kein Mitglied gefunden.</p>
      )}

      {treffer && treffer.length > 0 && (
        <ul className="flex flex-col divide-y divide-line">
          {treffer.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="truncate font-medium text-ink">{t.name ?? "Ohne Namen"}</div>
                <div className="truncate text-sm text-muted">
                  {t.login_email}
                  {t.tier && <> · {t.tier}</>}
                  {!t.bestaetigt && <> · nicht bestätigt</>}
                </div>
              </div>
              <Link to={`/admin/mitglied/${t.id}`}>
                <Button variant="ghost" size="sm">
                  Bearbeiten
                </Button>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
