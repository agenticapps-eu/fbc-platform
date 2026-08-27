import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "../components/ui/Button";
import { Card, CardTitle } from "../components/ui/Card";
import { useToast } from "../components/ui/toast-context";
import { RELEASE_EINTRAEGE } from "../content/release-entries.generated";
import {
  ausLetzterWoche,
  fetchAngekuendigt,
  fetchEntwuerfe,
  fetchUebersprungene,
  holeZurueck,
  markiereUebersprungen,
  releaseNotesQueryKey,
  speichereEntwurf,
  stelleZu,
  teileAuf,
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
 *
 * **Das Archiv (AGE-636) ist die fünfte Zusage.** Ein Eintrag steht in genau
 * einem von zwei Zuständen: offen — er steht in der Liste — oder archiviert.
 * Archiviert wird er durch **Zustellung** (endgültig, die Hinweise stehen dann
 * schon in den Postfächern) oder durch die Markierung **„nicht relevant"**
 * (geteilt zwischen allen Admins, rücknehmbar). Ohne diesen zweiten Weg
 * stünden dauerhaft 22 ältere Einträge ungehakt in der Liste, die niemand je
 * ankündigen wird — und jemand müsste sie nach jedem Neuladen erneut übergehen.
 */
export default function AdminNeuigkeitenPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const entwuerfe = useQuery({
    queryKey: releaseNotesQueryKey("draft"),
    queryFn: fetchEntwuerfe,
  });
  // Ungeseitet, und das ist hier keine Nachlässigkeit: diese Fläche RECHNET
  // mit der Menge, statt sie anzuzeigen. Eine Seite wäre von „nicht
  // angekündigt" nicht zu unterscheiden und holte Einträge stillschweigend
  // zurück in die Auswahlliste (AGE-636).
  const zugestellte = useQuery({
    queryKey: releaseNotesQueryKey("alle-zugestellten"),
    queryFn: fetchAngekuendigt,
  });
  const uebersprungene = useQuery({
    queryKey: releaseNotesQueryKey("uebersprungen"),
    queryFn: fetchUebersprungene,
  });

  // `null` heisst „noch nicht angefasst" und ist nicht dasselbe wie „nichts
  // gewählt": nur solange es null ist, gilt die Vorauswahl. Ein leeres Array
  // nach dem Zustellen bleibt leer — sonst kämen die Häkchen zurück.
  //
  // Abgeleitet statt in den Zustand gelegt: die Liste steht erst, wenn beide
  // Abfragen da sind. Ein `useState(vorauswahl)` nähme den Wert nie an, weil er
  // beim Mount noch leer ist — grüner Test, leere Fläche.
  const [gewaehlt, setGewaehlt] = useState<string[] | null>(null);
  const [titel, setTitel] = useState("");
  const [text, setText] = useState("");
  // Der gespeicherte Stand, nicht nur seine Kennung. Zugestellt wird nur, was
  // hier steht — siehe `unveraendert` weiter unten.
  const [gespeichert, setGespeichert] = useState<{
    id: string;
    titel: string;
    text: string;
    slugs: string[];
  } | null>(null);
  // Der zuletzt ERZEUGTE Vorschlag samt der Auswahl, aus der er entstand.
  // Nur damit lässt sich sagen, ob der Text im Feld noch zur Auswahl passt.
  const [vorschlag, setVorschlag] = useState<{ text: string; slugs: string[] } | null>(null);

  // Fail-closed, an EINER Stelle gerechnet und von beiden Karten gelesen.
  // Solange eine der drei Abfragen fehlt, ist keine Aussage darüber möglich, was
  // offen ist und was archiviert — und eine gekürzte Liste sieht aus wie eine
  // vollständige, ganz gleich in welcher Karte sie steht.
  const unvollstaendig =
    entwuerfe.isError ||
    zugestellte.isError ||
    uebersprungene.isError ||
    entwuerfe.isLoading ||
    zugestellte.isLoading ||
    uebersprungene.isLoading;

  const notes = [...(entwuerfe.data ?? []), ...(zugestellte.data ?? [])];
  const { offen, archiv } = teileAuf(RELEASE_EINTRAEGE, notes, uebersprungene.data ?? []);

  // Die Auswahl ist auf das OFFENE beschränkt, und das ist keine Zierde: was
  // archiviert ist, kann nicht angekündigt werden. Ohne diesen Schnitt bliebe
  // ein gerade als „nicht relevant" markierter Slug in `gewaehlt` stehen und
  // ginge über `speichereEntwurf` doch noch in die Mitteilung — bei zwei
  // schnellen Klicks hintereinander sogar dann, wenn jede Mutation für sich
  // aufräumte, weil beide `onSuccess` denselben alten Stand sähen.
  const vorauswahl = gewaehlt ?? ausLetzterWoche(offen, new Date()).map((e) => e.slug);
  const auswahl = vorauswahl.filter((slug) => offen.some((e) => e.slug === slug));

  /**
   * Entspricht der Bildschirm noch dem, was in der Datenbank steht?
   *
   * `stelleZu(id)` verschickt die gespeicherte ZEILE, nicht den Bildschirm.
   * Ohne diesen Abgleich schickte „speichern → etwas ändern → zustellen" den
   * alten Stand los — auch den Eintrag, den der Admin gerade als nicht relevant
   * markiert hat.
   *
   * Bewusst ein Vergleich und keine vier `setGespeichert(null)`-Aufrufe an den
   * mutierenden Stellen: die fünfte, die jemand später hinzufügt, vergisst es.
   */
  const unveraendert =
    gespeichert !== null &&
    gespeichert.titel === titel &&
    gespeichert.text === text &&
    gespeichert.slugs.length === auswahl.length &&
    gespeichert.slugs.every((s) => auswahl.includes(s));

  /** Ein Eintrag wird an- oder abgehakt. */
  function umschalten(slug: string) {
    // Aus `auswahl` gerechnet, nicht aus dem bisherigen Zustand: der ist beim
    // ersten Klick noch `null` und trüge die Vorauswahl nicht.
    setGewaehlt(
      auswahl.includes(slug) ? auswahl.filter((s) => s !== slug) : [...auswahl, slug],
    );
  }

  /** Aus der Auswahl wird EIN Vorschlag — überschreibbar, und er soll
   *  überschrieben werden. */
  function vorschlagen() {
    const entwurf = entwurfAus(offen.filter((e) => auswahl.includes(e.slug)));
    setTitel(entwurf.titel);
    setText(entwurf.text);
    setVorschlag({ text: entwurf.text, slugs: auswahl });
  }

  /**
   * Steht im Textfeld noch ein Vorschlag, der zu einer ANDEREN Auswahl gehört?
   *
   * `unveraendert` bewacht die Slug-Liste, nicht den Fliesstext. Der Ablauf
   * „Entwurf machen → einen Eintrag als nicht relevant markieren → erneut
   * speichern → zustellen" käme sonst durch: `entry_slugs` wären richtig, der
   * Text nennte die Änderung aber weiterhin — und die Mitglieder läsen von
   * etwas, das ausdrücklich aussortiert wurde. (Fremd-Review auf dem Diff,
   * opencode, MEDIUM.)
   *
   * Kein automatisches Neuerzeugen: das überschriebe die Redaktion, und die
   * Redaktion ist der Kern dieser Fläche (AGE-631). Der Hinweis nennt stattdessen
   * den Knopf, der schon da ist.
   */
  const textVeraltet =
    vorschlag !== null &&
    vorschlag.text === text &&
    !(
      vorschlag.slugs.length === auswahl.length &&
      vorschlag.slugs.every((s) => auswahl.includes(s))
    );

  /**
   * „Nicht relevant" — das zweite Kästchen (AGE-636).
   *
   * Aus der Auswahl fällt der Eintrag von selbst — `auswahl` ist auf `offen`
   * beschränkt (siehe oben). Hier steht deshalb bewusst kein zweiter
   * Aufräumschritt: zwei Mechanismen für dieselbe Zusage laufen auseinander,
   * sobald einer von beiden vergessen wird.
   *
   * Kein optimistisches Umschalten: der Zustand kommt erst aus der Antwort.
   * Eine Zeile, die verschwindet und beim nächsten Laden wiederkommt, wäre
   * schlimmer als eine, die stehen bleibt.
   */
  const markieren = useMutation({
    mutationFn: (slug: string) => markiereUebersprungen(slug),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: releaseNotesQueryKey("uebersprungen") }),
    onError: (fehler) =>
      toast({ title: "Nicht markiert", description: String(fehler), variant: "error" }),
  });

  const zurueckholen = useMutation({
    mutationFn: (slug: string) => holeZurueck(slug),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: releaseNotesQueryKey("uebersprungen") }),
    onError: (fehler) =>
      toast({ title: "Nicht zurückgeholt", description: String(fehler), variant: "error" }),
  });

  /**
   * Der Stand, der WIRKLICH abgeschickt wurde — als Variable der Mutation, nicht
   * aus dem Abschluss gelesen.
   *
   * `onSuccess` sieht sonst den Bildschirm zum Zeitpunkt der Antwort. Wer
   * während des laufenden Speicherns weitertippt, bekäme seinen neuen Stand als
   * „gespeichert" quittiert, während in der Datenbank der alte steht — und der
   * Zustellknopf gäbe frei, was niemand gespeichert hat. (Fremd-Review auf dem
   * Diff, codex, HIGH.)
   */
  const speichern = useMutation({
    mutationFn: (stand: { titel: string; text: string; slugs: string[] }) =>
      speichereEntwurf({
        ...(gespeichert ? { id: gespeichert.id } : {}),
        title: stand.titel,
        body: stand.text,
        entrySlugs: stand.slugs,
        createdBy: user?.id ?? null,
      }),
    onSuccess: (note, stand) => {
      setGespeichert({ id: note.id, ...stand });
      void queryClient.invalidateQueries({ queryKey: releaseNotesQueryKey("draft") });
      toast({ title: "Entwurf gespeichert", variant: "success" });
    },
    onError: (fehler) =>
      toast({ title: "Nicht gespeichert", description: String(fehler), variant: "error" }),
  });

  const zustellen = useMutation({
    mutationFn: (id: string) => stelleZu(id),
    onSuccess: (anzahl) => {
      setGespeichert(null);
      setVorschlag(null);
      setGewaehlt([]);
      setTitel("");
      setText("");
      void queryClient.invalidateQueries({ queryKey: releaseNotesQueryKey("draft") });
      // BEIDE Sichten auf dieselbe Tabelle: die eigene Rechnung und die von
      // `/neues` gelesene, geseitete Liste. Sie haben seit dem Diff eigene
      // Schlüssel und werden deshalb einzeln entwertet.
      void queryClient.invalidateQueries({ queryKey: releaseNotesQueryKey("alle-zugestellten") });
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
        {/* Fail-closed, und die Markierungen gehören dazu: ginge ihr Ausfall
            als „nichts markiert" durch, stünden gerade die abgeräumten
            Einträge wieder zur Wahl — die jüngeren davon vorangehakt. */}
        {/* Dieselbe Grundlage wie beim Archiv weiter unten — siehe
            `unvollstaendig`. Der Unterschied ist nur der Satz. */}
        {entwuerfe.isError || zugestellte.isError || uebersprungene.isError ? (
          <p className="text-sm text-muted">
            Die bisherigen Mitteilungen konnten nicht geladen werden — solange das so ist, lässt
            sich nicht sagen, was noch offen ist.
          </p>
        ) : entwuerfe.isLoading || zugestellte.isLoading || uebersprungene.isLoading ? (
          <p className="text-sm text-muted">Wird geladen…</p>
        ) : offen.length === 0 ? (
          <p className="text-sm text-muted">Alles angekündigt. Es gibt gerade nichts zu melden.</p>
        ) : (
          <>
            {/* Beide Kästchen stehen in DERSELBEN Zeile, direkt
                hintereinander. Eine eigene Spalte am rechten Rand der Karte
                riss bei 900 px Breite eine Lücke von siebenhundert Pixeln
                zwischen Eintrag und Kästchen auf — gemessen im Browser, und
                jsdom sieht so etwas nie. */}
            <ul className="space-y-1.5">
              {offen.map((e) => (
                <li key={e.slug} className="flex flex-wrap items-start gap-x-3">
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={auswahl.includes(e.slug)}
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
                  {/* Der eigene Name ist Pflicht: ohne ihn trügen beide
                      Kästchen einer Zeile denselben und wären weder für
                      Vorlesesoftware noch für einen Test zu unterscheiden. */}
                  <label className="mt-0.5 flex shrink-0 cursor-pointer items-start gap-1.5 text-xs text-muted hover:text-ink">
                    <input
                      type="checkbox"
                      aria-label={`Nicht relevant: ${e.titel}`}
                      checked={false}
                      onChange={() => markieren.mutate(e.slug)}
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-line text-accent focus-visible:ring-2 focus-visible:ring-accent"
                    />
                    <span aria-hidden="true">nicht relevant</span>
                  </label>
                </li>
              ))}
            </ul>
            <Button variant="secondary" size="sm" onClick={vorschlagen} disabled={!auswahl.length}>
              Aus {auswahl.length} Änderungen einen Entwurf machen
            </Button>
          </>
        )}
      </Card>

      {/* Das Archiv (AGE-636). `<details>` statt eines Zustands im React-Baum:
          Aufklappen ist Browserverhalten, es bringt Tastaturbedienung und die
          Ansage an Vorlesesoftware mit und überlebt jeden Re-Render. */}
      <Card className="space-y-2">
        <details>
          <summary className="cursor-pointer text-sm font-medium text-ink marker:text-muted">
            Archiv {unvollstaendig ? "" : `(${archiv.length})`}
            <span className="ml-2 text-xs font-normal text-muted">
              zugestellt oder als nicht relevant markiert
            </span>
          </summary>
          {/* Ohne diesen Zweig stünde hier eine ZAHL, während die Grundlage
              fehlt — „Archiv (1)" oder, schlimmer, „Noch nichts archiviert."
              als Tatsachenbehauptung, obwohl gerade die abgeräumten Einträge
              nicht geladen werden konnten. */}
          {unvollstaendig ? (
            <p className="mt-3 text-sm text-muted">
              Solange die bisherigen Mitteilungen und Markierungen nicht
              vollständig geladen sind, lässt sich nicht sagen, was archiviert ist.
            </p>
          ) : archiv.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Noch nichts archiviert.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {archiv.map(({ eintrag, grund }) => (
                <li key={eintrag.slug} className="flex items-start justify-between gap-3 text-sm">
                  <span>
                    <span className="text-ink">{eintrag.titel}</span>
                    <span className="ml-2 text-xs text-muted">
                      {grund.art === "zugestellt"
                        ? `zugestellt${grund.am ? ` ${grund.am.slice(0, 10)}` : ""} · „${grund.titel}"`
                        : "nicht relevant"}
                    </span>
                  </span>
                  {/* Zugestelltes hat keinen Weg zurück: die Hinweise dazu
                      stehen dann schon in den Postfächern, und ein wieder
                      offener Eintrag würde ein zweites Mal angekündigt. */}
                  {grund.art === "nicht-relevant" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => zurueckholen.mutate(eintrag.slug)}
                      disabled={zurueckholen.isPending}
                    >
                      Zurück in die Liste
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </details>
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
        {textVeraltet && (
          <p className="text-xs text-warning">
            Der Text stammt noch von einer anderen Auswahl und nennt Änderungen, die
            nicht mehr dabei sind. „Aus {auswahl.length} Änderungen einen Entwurf machen"
            erzeugt ihn neu — oder korrigiere ihn von Hand.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => speichern.mutate({ titel, text, slugs: auswahl })}
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
            onClick={() =>
              unveraendert && !textVeraltet && gespeichert && zustellen.mutate(gespeichert.id)
            }
            disabled={!unveraendert || textVeraltet || zustellen.isPending}
          >
            An alle aktivierten Mitglieder zustellen
          </Button>
          <span className="text-xs text-muted">
            {textVeraltet
              ? "Der Text passt nicht zur Auswahl."
              : unveraendert
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
