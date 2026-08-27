import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "../components/ui/Button";
import { Card, CardTitle } from "../components/ui/Card";
import { useToast } from "../components/ui/toast-context";
import { RELEASE_EINTRAEGE } from "../content/release-entries.generated";
import {
  fetchEntwuerfe,
  fetchZugestellte,
  nochNichtAngekuendigt,
  releaseNotesQueryKey,
  speichereEntwurf,
  stelleZu,
} from "../lib/release-notes";
import { entwurfAus } from "../lib/release-entwurf";
import { useAuth } from "../providers/auth-context";

/**
 * Release-Notes zusammenstellen und zustellen (AGE-631).
 *
 * **Die vier Schritte sind die Anforderung**, nicht die Zutat: sehen, was neu
 * ist — mehrere zu EINER Nachricht zusammenfassen — den Text prüfen und
 * korrigieren — erst dann zustellen. Ein Automatismus, der Proposal-Text
 * ungeprüft verschickt, wäre schlechter als gar nichts: „notify-contact-request
 * liest über eine DEFINER-RPC statt als service_role" ist ein wahrer Satz, der
 * einem Mitglied nichts sagt.
 *
 * **Keine Empfängerauswahl, und das ist eine Zusage.** `specs/admin` verbietet
 * seit AGE-304 eine Fläche, aus der ein Admin Empfänger zusammenstellt. Diese
 * hier hat keine: der Kreis ist „alle aktivierten Mitglieder" und steht in
 * `send_release_note()`, nicht in dieser Datei.
 *
 * Kein eigenes Rollen-Gate: die Seite hängt hinter `RequireAdmin`, und die
 * echte Grenze ist `is_admin()` im Rumpf von `send_release_note`.
 */
export default function AdminNeuigkeitenPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const entwuerfe = useQuery({
    queryKey: releaseNotesQueryKey("draft"),
    queryFn: fetchEntwuerfe,
  });
  const zugestellte = useQuery({
    queryKey: releaseNotesQueryKey("sent"),
    queryFn: () => fetchZugestellte(),
  });

  const [gewaehlt, setGewaehlt] = useState<string[]>([]);
  const [titel, setTitel] = useState("");
  const [text, setText] = useState("");
  const [entwurfId, setEntwurfId] = useState<string | null>(null);

  const notes = [...(entwuerfe.data ?? []), ...(zugestellte.data ?? [])];
  const offen = nochNichtAngekuendigt(RELEASE_EINTRAEGE, notes);

  /** Ein Eintrag wird an- oder abgehakt. */
  function umschalten(slug: string) {
    setGewaehlt((bisher) =>
      bisher.includes(slug) ? bisher.filter((s) => s !== slug) : [...bisher, slug],
    );
  }

  /** Aus der Auswahl wird EIN Vorschlag — überschreibbar, und er soll
   *  überschrieben werden. */
  function vorschlagen() {
    const entwurf = entwurfAus(offen.filter((e) => gewaehlt.includes(e.slug)));
    setTitel(entwurf.titel);
    setText(entwurf.text);
  }

  const speichern = useMutation({
    mutationFn: () =>
      speichereEntwurf({
        ...(entwurfId ? { id: entwurfId } : {}),
        title: titel,
        body: text,
        entrySlugs: gewaehlt,
        createdBy: user?.id ?? null,
      }),
    onSuccess: (note) => {
      setEntwurfId(note.id);
      void queryClient.invalidateQueries({ queryKey: releaseNotesQueryKey("draft") });
      toast({ title: "Entwurf gespeichert", variant: "success" });
    },
    onError: (fehler) =>
      toast({ title: "Nicht gespeichert", description: String(fehler), variant: "error" }),
  });

  const zustellen = useMutation({
    mutationFn: (id: string) => stelleZu(id),
    onSuccess: (anzahl) => {
      setEntwurfId(null);
      setGewaehlt([]);
      setTitel("");
      setText("");
      void queryClient.invalidateQueries({ queryKey: releaseNotesQueryKey("draft") });
      void queryClient.invalidateQueries({ queryKey: releaseNotesQueryKey("sent") });
      toast({ title: `An ${anzahl} Mitglieder zugestellt`, variant: "success" });
    },
    // Der Riegel gegen die Doppelzustellung sitzt in der Datenbank und meldet
    // sich als Fehler. Ihn zu verschlucken hiesse, dem Admin zu sagen, es habe
    // geklappt — beim zweiten Mal genauso wie beim ersten.
    onError: (fehler) =>
      toast({ title: "Nicht zugestellt", description: String(fehler), variant: "error" }),
  });

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-semibold text-ink">Neuigkeiten</h1>
        <p className="mt-1 text-sm text-muted">
          Aus den ausgelieferten Änderungen eine Mitteilung zusammenstellen, prüfen und an alle
          aktivierten Mitglieder zustellen.
        </p>
      </header>

      <Card className="space-y-3">
        <CardTitle>Noch nicht angekündigt</CardTitle>
        {entwuerfe.isError || zugestellte.isError ? (
          <p className="text-sm text-muted">
            Die bisherigen Mitteilungen konnten nicht geladen werden — solange das so ist, lässt
            sich nicht sagen, was noch offen ist.
          </p>
        ) : entwuerfe.isLoading || zugestellte.isLoading ? (
          <p className="text-sm text-muted">Wird geladen…</p>
        ) : offen.length === 0 ? (
          <p className="text-sm text-muted">Alles angekündigt. Es gibt gerade nichts zu melden.</p>
        ) : (
          <>
            <ul className="space-y-1.5">
              {offen.map((e) => (
                <li key={e.slug}>
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={gewaehlt.includes(e.slug)}
                      onChange={() => umschalten(e.slug)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-line text-accent focus-visible:ring-2 focus-visible:ring-accent"
                    />
                    <span>
                      <span className="font-medium">{e.titel}</span>
                      <span className="ml-2 text-xs text-muted">
                        {e.datum}
                        {e.linear ? ` · ${e.linear}` : ""}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <Button variant="secondary" size="sm" onClick={vorschlagen} disabled={!gewaehlt.length}>
              Aus {gewaehlt.length} Änderungen einen Entwurf machen
            </Button>
          </>
        )}
      </Card>

      <Card className="space-y-3">
        <CardTitle>Entwurf</CardTitle>
        <label className="block text-sm">
          <span className="text-muted">Titel</span>
          <input
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
            className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Text — so, wie ein Mitglied ihn lesen soll</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2 font-mono text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => speichern.mutate()}
            disabled={!titel.trim() || !text.trim() || speichern.isPending}
          >
            Entwurf speichern
          </Button>
          {/* Zustellen geht NUR über einen gespeicherten Entwurf. Sonst gäbe es
              einen Weg, an dem `entry_slugs` nie in der Datenbank landen — und
              dieselbe Änderung erschiene beim nächsten Mal wieder als offen. */}
          <Button
            variant="primary"
            size="sm"
            onClick={() => entwurfId && zustellen.mutate(entwurfId)}
            disabled={!entwurfId || zustellen.isPending}
          >
            An alle aktivierten Mitglieder zustellen
          </Button>
          <span className="text-xs text-muted">
            {entwurfId
              ? "Gespeichert. Zustellen geht genau einmal."
              : "Erst speichern, dann zustellen."}
          </span>
        </div>
      </Card>

      <Card className="space-y-2">
        <CardTitle>Bereits zugestellt</CardTitle>
        {(zugestellte.data ?? []).length === 0 ? (
          <p className="text-sm text-muted">Noch nichts zugestellt.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {(zugestellte.data ?? []).map((n) => (
              <li key={n.id} className="flex items-baseline justify-between gap-3">
                <span className="text-ink">{n.title}</span>
                <span className="shrink-0 text-xs text-muted">
                  {n.sent_at?.slice(0, 10)} · {n.recipient_count ?? "?"} Mitglieder
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
