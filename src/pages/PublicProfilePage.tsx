import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ProfileHero, HeroImpactBadge } from "../components/profile/ProfileHero";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardTitle } from "../components/ui/Card";
import { PageSkeleton } from "../components/ui/Skeleton";
import { Textarea } from "../components/ui/Textarea";
import { VideoEmbed } from "../components/ui/VideoEmbed";
import { useToast } from "../components/ui/toast-context";
import {
  contactRelationQueryKey,
  fetchContactRelation,
  sendContactRequest,
  type ContactRelation,
} from "../lib/contact-requests";
import { dashboardQueryKey } from "../lib/dashboard";
import { matchingHubQueryKey } from "../lib/matching-hub";
import {
  fetchPublicProfile,
  publicProfileQueryKey,
  type ExtendedProfile,
  type PublicProfile,
} from "../lib/public-profile";
import { fetchPlatformSettings, platformSettingsQueryKey } from "../lib/platform-settings";
import { LEVELS, LEVEL_RANK } from "../config/levels";
import { useAuth } from "../providers/auth-context";

// Themen-Reihenfolge & Labels für Erfolgsradar/Interessen (Sein·Tun·Haben·Wirken).
const THEME_ORDER = ["sein", "tun", "haben", "wirken"] as const;
const THEME_LABEL: Record<string, string> = {
  sein: "Sein",
  tun: "Tun",
  haben: "Haben",
  wirken: "Wirken",
};

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user, levelRank, staffRole } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: publicProfileQueryKey(id ?? ""),
    queryFn: () => fetchPublicProfile(id ?? ""),
    enabled: !!id,
  });

  const { data: platform } = useQuery({
    queryKey: platformSettingsQueryKey,
    queryFn: fetchPlatformSettings,
  });

  if (isLoading) {
    return <PageSkeleton label="Profil wird geladen…" />;
  }
  if (isError) {
    return (
      <p className="text-sm text-danger">Profil konnte nicht geladen werden. Bitte neu laden.</p>
    );
  }
  if (!data?.publicProfile) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold text-ink">Profil nicht gefunden</h1>
        <p className="text-sm text-muted">
          Dieses Profil existiert nicht oder ist nicht öffentlich sichtbar.
        </p>
      </div>
    );
  }

  const profile = data.publicProfile;
  const extended = data.extended;
  const isOwn = !!user && user.id === profile.id;
  // Komfort, nicht die Grenze: die ist `is_admin()` im Rumpf der RPCs (AGE-498).
  // Der Weg erscheint nur bei Profilen, die HIER sichtbar sind — unbestätigte
  // erreicht der Admin über die Suche auf /admin, weil profiles_public sie für
  // niemanden führt.
  const istAdmin = staffRole === "admin" && !isOwn;
  // Bis AGE-311 war beides dieselbe Schwelle (Prime). §2 trennt sie: die
  // erweiterten Felder gehören zum „vollständigen Verzeichnis" (ab `discover`),
  // eine Kontaktanfrage ist eine Stufe teurer (ab `exchange`) — das ist der
  // Welpenschutz-Kern: Sichtbarkeit ≠ Kontaktrecht.
  // §2: Kontaktrecht ab `exchange`. Der Admin-Flag open_contact (AGE-455) öffnet es
  // fürs Event für alle — die RLS (cr_insert_self) erzwingt dieselbe Regel.
  const canRequestContact =
    (platform?.openContact ?? false) || (levelRank ?? 0) >= LEVEL_RANK.exchange;

  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader
        profile={profile}
        impactScore={extended?.potential_score ?? null}
        adminEditPath={istAdmin ? `/admin/mitglied/${profile.id}` : null}
      />

      {extended ? (
        <ExtendedSections extended={extended} profile={profile} />
      ) : (
        <Card className="border-dashed">
          <CardTitle className="text-base">Erweiterte Profilangaben</CardTitle>
          <p className="mt-1 text-sm text-muted">
            Erfolgsradar, Interessen, Kompetenzen und das Such-/Bieteprofil sind ab der
            Mitgliedsstufe <span className="font-medium text-ink">{LEVELS.discover.label}</span>{" "}
            sichtbar.
          </p>
        </Card>
      )}

      <ContactArea
        viewerId={user?.id ?? null}
        profileId={profile.id}
        isOwn={isOwn}
        canRequestContact={canRequestContact}
        name={profile.name}
      />
    </div>
  );
}

function ProfileHeader({
  profile,
  impactScore,
  adminEditPath,
}: {
  profile: PublicProfile;
  impactScore: number | null;
  adminEditPath: string | null;
}) {
  return (
    <ProfileHero
      name={profile.name}
      avatarUrl={profile.avatar_url}
      coverUrl={profile.cover_url}
      tier={profile.tier}
      roles={profile.roles}
      region={profile.region}
      company={profile.company}
      action={
        // Die Kurzbeschreibung steht NICHT mehr hier, sondern im Abschnitt
        // „Über mich" (AGE-498). Zweimal derselbe Satz auf einer Seite ist kein
        // Aufbau, sondern ein Versehen.
        <div className="flex flex-col items-end gap-2">
          {impactScore !== null && <HeroImpactBadge score={impactScore} />}
          {adminEditPath && (
            <Link to={adminEditPath}>
              <Button variant="ghost" size="sm">
                Als Admin bearbeiten
              </Button>
            </Link>
          )}
        </div>
      }
    />
  );
}

/**
 * Die Abschnitte nach dem Mockup vom 29.07. (AGE-498), in dieser Reihenfolge:
 * Über mich · Beruf · Hobbys · Ich biete · Ich suche · Aktivitäten · Eckdaten.
 * Erfolgsradar, Kompetenzen und Videos bleiben dazwischen erhalten — sie waren
 * schon da, und das Mockup verbietet sie nicht.
 *
 * Jeder Abschnitt hat GENAU EINE Quelle (siehe Spec-Delta), und ein leerer
 * Abschnitt entfällt, statt einen Platzhalter zu zeigen: dieselbe Regel, die
 * AGE-494 auf der eigenen Profilseite gesetzt hat.
 */
function ExtendedSections({
  extended,
  profile,
}: {
  extended: ExtendedProfile;
  profile: PublicProfile;
}) {
  const interestsByTheme = THEME_ORDER.map((theme) => ({
    theme,
    items: extended.interests.filter((i) => i.theme === theme),
  })).filter((g) => g.items.length > 0);
  const untheured = extended.interests.filter((i) => !i.theme);
  const hasRadar = extended.themeScores.length > 0;
  const hatHobbys = interestsByTheme.length > 0 || untheured.length > 0;
  const beruf = [profile.company, extended.branche, extended.headline].filter(Boolean);

  return (
    <>
      {profile.short_bio && (
        <Card className="flex flex-col gap-3">
          <CardTitle className="text-base">Über mich</CardTitle>
          <p className="max-w-2xl text-sm leading-relaxed text-ink/80">{profile.short_bio}</p>
        </Card>
      )}

      {(beruf.length > 0 || extended.competencies.length > 0) && (
        <Card className="flex flex-col gap-3">
          <CardTitle className="text-base">Beruf</CardTitle>
          {beruf.length > 0 && <p className="text-sm text-ink/80">{beruf.join(" · ")}</p>}
          {extended.competencies.length > 0 && <ChipList items={extended.competencies} />}
        </Card>
      )}

      {hatHobbys && (
        <Card className="flex flex-col gap-4">
          <CardTitle className="text-base">Hobbys</CardTitle>
          <div className="flex flex-col gap-3">
            {interestsByTheme.map((group) => (
              <div key={group.theme}>
                <div className="text-xs font-semibold tracking-wide text-muted uppercase">
                  {THEME_LABEL[group.theme]}
                </div>
                <ChipList items={group.items.map((i) => i.label)} />
              </div>
            ))}
            {untheured.length > 0 && <ChipList items={untheured.map((i) => i.label)} />}
          </div>
        </Card>
      )}

      {/* Kompass-Kategorien aus C2 — KEINE zweite Kategorienliste. */}
      {extended.offers.length > 0 && (
        <Card className="flex flex-col gap-4">
          <CardTitle className="text-base">Ich biete</CardTitle>
          <MatchingList items={extended.offers} />
        </Card>
      )}

      {extended.needs.length > 0 && (
        <Card className="flex flex-col gap-4">
          <CardTitle className="text-base">Ich suche</CardTitle>
          <MatchingList items={extended.needs} />
        </Card>
      )}

      {extended.posts.length > 0 && (
        <Card className="flex flex-col gap-4">
          <CardTitle className="text-base">Aktivitäten</CardTitle>
          <ul className="flex flex-col divide-y divide-line">
            {extended.posts.map((post) => (
              <li key={post.id} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm text-ink/80">{post.body}</p>
                <p className="mt-1 text-xs text-muted">
                  {new Date(post.created_at).toLocaleDateString("de-DE")}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="flex flex-col gap-2">
        <CardTitle className="text-base">Eckdaten</CardTitle>
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {extended.member_since && (
            <div className="flex gap-2">
              <dt className="text-muted">Mitglied seit</dt>
              <dd className="text-ink">
                {new Date(extended.member_since).toLocaleDateString("de-DE", {
                  month: "long",
                  year: "numeric",
                })}
              </dd>
            </div>
          )}
          {profile.tier && (
            <div className="flex gap-2">
              <dt className="text-muted">Stufe</dt>
              <dd className="text-ink">{profile.tier}</dd>
            </div>
          )}
          {profile.region && (
            <div className="flex gap-2">
              <dt className="text-muted">Standort</dt>
              <dd className="text-ink">{profile.region}</dd>
            </div>
          )}
        </dl>
      </Card>

      {hasRadar && (
        <Card className="flex flex-col gap-4">
          <CardTitle className="text-base">Erfolgsradar</CardTitle>
          <ul className="flex flex-col gap-3">
            {THEME_ORDER.map((theme) => {
              const score = extended.themeScores.find((s) => s.theme === theme)?.score;
              if (score == null) return null;
              return (
                <li key={theme} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-sm text-muted">{THEME_LABEL[theme]}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-soft">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${(score / 10) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-sm font-medium text-ink">
                    {score.toFixed(1)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {extended.videos.length > 0 && (
        <Card className="flex flex-col gap-4">
          <CardTitle className="text-base">Videos</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            {extended.videos.map((url, i) => (
              <VideoEmbed key={url} url={url} title={`Video ${i + 1}`} />
            ))}
          </div>
        </Card>
      )}

    </>
  );
}

function ChipList({ items }: { items: string[] }) {
  return (
    <ul className="mt-1.5 flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item}>
          <Badge variant="neutral">{item}</Badge>
        </li>
      ))}
    </ul>
  );
}

/** Angebote oder Gesuche als Liste — dieselbe Darstellung für beide Seiten. */
function MatchingList({
  items,
}: {
  items: { id: string; title: string; description: string | null; category: string | null }[];
}) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id} className="rounded-[var(--radius-card)] border border-line bg-soft p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-ink">{item.title}</span>
            {item.category && <Badge variant="soft">{item.category}</Badge>}
          </div>
          {item.description && <p className="mt-1 text-sm text-muted">{item.description}</p>}
        </li>
      ))}
    </ul>
  );
}

function ContactArea({
  viewerId,
  profileId,
  isOwn,
  canRequestContact,
  name,
}: {
  viewerId: string | null;
  profileId: string;
  isOwn: boolean;
  canRequestContact: boolean;
  name: string;
}) {
  const { data: relation } = useQuery({
    queryKey: contactRelationQueryKey(viewerId ?? "", profileId),
    queryFn: () => fetchContactRelation(viewerId!, profileId),
    enabled: !!viewerId && !isOwn,
  });

  if (isOwn) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Das ist dein öffentliches Profil.</p>
        <Link to="/profil">
          <Button variant="secondary" size="sm">
            Profil bearbeiten
          </Button>
        </Link>
      </Card>
    );
  }

  // Freigegeben: Kontaktdaten anzeigen (RLS gibt `contact` nur bei accepted zurück).
  if (relation?.request?.status === "accepted") {
    return <ReleasedContact name={name} contact={relation.contact} />;
  }

  return (
    <Card className="flex flex-col gap-3">
      <CardTitle className="text-base">Kontakt</CardTitle>
      <ContactBody
        viewerId={viewerId}
        profileId={profileId}
        canRequestContact={canRequestContact}
        name={name}
        relation={relation ?? null}
      />
      {/* Zählt auf, was verschlossen bleibt — seit AGE-537 gehört die Anschrift
          dazu, und eine unvollständige Aufzählung liest sich wie eine Zusage. */}
      <p className="text-xs text-muted">
        E-Mail, Telefon und Anschrift werden nie automatisch angezeigt.
      </p>
    </Card>
  );
}

function ContactBody({
  viewerId,
  profileId,
  canRequestContact,
  name,
  relation,
}: {
  viewerId: string | null;
  profileId: string;
  canRequestContact: boolean;
  name: string;
  relation: ContactRelation | null;
}) {
  const request = relation?.request ?? null;

  if (request) {
    if (request.status === "pending") {
      return request.outgoing ? (
        <div className="flex items-center gap-2">
          <Badge variant="soft">Anfrage gesendet</Badge>
          <span className="text-sm text-muted">Wartet auf Antwort von {name}.</span>
        </div>
      ) : (
        <p className="text-sm text-muted">
          {name} hat dir eine Kontaktanfrage gesendet. Beantworte sie unter{" "}
          <Link to="/kontakte" className="font-medium text-accent-strong hover:text-accent">
            Meine Anfragen
          </Link>
          .
        </p>
      );
    }
    // declined
    return (
      <p className="text-sm text-muted">
        {request.outgoing
          ? `${name} hat deine Anfrage abgelehnt.`
          : "Du hast diese Anfrage abgelehnt."}
      </p>
    );
  }

  if (!canRequestContact) {
    return (
      <p className="text-sm text-muted">
        Kontaktanfragen sind ab der Mitgliedsstufe{" "}
        <span className="font-medium text-ink">{LEVELS.exchange.label}</span> möglich.
      </p>
    );
  }

  return (
    <ContactRequestComposer
      viewerId={viewerId}
      profileId={profileId}
      matchId={relation?.matchId ?? null}
      name={name}
    />
  );
}

function ContactRequestComposer({
  viewerId,
  profileId,
  matchId,
  name,
}: {
  viewerId: string | null;
  profileId: string;
  matchId: string | null;
  name: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  const mutation = useMutation({
    mutationFn: () => sendContactRequest({ fromId: viewerId!, toId: profileId, matchId, message }),
    onSuccess: () => {
      setOpen(false);
      setMessage("");
      toast({
        variant: "success",
        title: "Kontaktanfrage gesendet",
        description: `${name} entscheidet über deine Anfrage. Kontaktdaten werden erst nach Annahme sichtbar.`,
      });
      if (viewerId) {
        queryClient.invalidateQueries({ queryKey: contactRelationQueryKey(viewerId, profileId) });
        queryClient.invalidateQueries({ queryKey: matchingHubQueryKey(viewerId) });
        queryClient.invalidateQueries({ queryKey: dashboardQueryKey(viewerId) });
      }
    },
    onError: (error) => {
      // Anfrage besteht bereits (23505) → freundlich melden und Relation neu laden.
      const code =
        error && typeof error === "object" && "code" in error
          ? (error as { code: unknown }).code
          : undefined;
      if (code === "23505") {
        setOpen(false);
        setMessage("");
        toast({
          variant: "success",
          title: "Anfrage besteht bereits",
          description: `Es gibt schon eine Kontaktanfrage mit ${name}.`,
        });
        if (viewerId) {
          queryClient.invalidateQueries({ queryKey: contactRelationQueryKey(viewerId, profileId) });
        }
        return;
      }
      // RLS-Ablehnung (42501): der Insert scheitert an is_contactable/Welpenschutz/
      // Level-Gate. Nie den rohen Postgres-String zeigen (AGE-455).
      if (code === "42501") {
        toast({
          variant: "error",
          title: "Anfrage nicht möglich",
          description: `Eine Kontaktanfrage an ${name} ist gerade nicht möglich. An neue Mitglieder ist eine Anfrage nur über ein gemeinsames Match möglich.`,
        });
        return;
      }
      const description =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: unknown }).message)
          : "Unbekannter Fehler.";
      toast({ variant: "error", title: "Anfrage fehlgeschlagen", description });
    },
  });

  // Doppelklick-Schutz: das disabled-Prop greift erst nach dem Re-Render.
  const submit = () => {
    if (mutation.isPending) return;
    mutation.mutate();
  };

  if (!open) {
    return (
      <>
        <p className="text-sm text-muted">
          Sende {name} eine Kontaktanfrage. Erst nach Annahme werden Kontaktdaten geteilt.
        </p>
        <div>
          <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
            Kontaktanfrage senden
          </Button>
        </div>
      </>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <Textarea
        rows={3}
        autoFocus
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={`Kurze Nachricht an ${name} (optional)…`}
      />
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={submit} disabled={mutation.isPending}>
          {mutation.isPending ? "Senden…" : "Anfrage senden"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
          disabled={mutation.isPending}
        >
          Abbrechen
        </Button>
      </div>
    </div>
  );
}

/**
 * Die freigegebene Kontaktzeile. Exportiert, damit die Anschrift-Fälle (AGE-537)
 * ohne die halbe Seite drumherum geprüft werden können — die Sperre selbst
 * liegt in der RLS und ist dort belegt, nicht hier.
 */
export function ReleasedContact({
  name,
  contact,
}: {
  name: string;
  contact: ContactRelation["contact"];
}) {
  // Die Anschrift zeilenweise, leere Teile fallen weg: „70173 Stuttgart" ohne
  // Straße ist eine Angabe, „, 70173 " wäre ein Darstellungsfehler.
  const ortszeile = [contact?.postal_code, contact?.city].filter(Boolean).join(" ");
  const landzeile = [contact?.state, contact?.country].filter(Boolean).join(" · ");
  const adresse = [contact?.street, ortszeile, landzeile].filter((t) => t && t !== "");
  const hasData = !!(contact && (contact.email || contact.phone || adresse.length > 0));
  return (
    <Card className="flex flex-col gap-3 border-accent/30 bg-accent-soft/30">
      <div className="flex items-center gap-2">
        <CardTitle className="text-base">Kontakt freigegeben</CardTitle>
        <Badge variant="strong">Angenommen</Badge>
      </div>
      <p className="text-sm text-muted">
        {name} hat deine Kontaktanfrage angenommen. Ihr könnt euch jetzt direkt austauschen.
      </p>
      {hasData ? (
        <dl className="flex flex-col gap-2 text-sm">
          {contact?.email && (
            <div className="flex items-center gap-2">
              <dt className="w-16 shrink-0 text-muted">E-Mail</dt>
              <dd>
                <a
                  href={`mailto:${contact.email}`}
                  className="font-medium text-accent-strong hover:text-accent"
                >
                  {contact.email}
                </a>
              </dd>
            </div>
          )}
          {contact?.phone && (
            <div className="flex items-center gap-2">
              <dt className="w-16 shrink-0 text-muted">Telefon</dt>
              <dd>
                <a
                  href={`tel:${contact.phone}`}
                  className="font-medium text-accent-strong hover:text-accent"
                >
                  {contact.phone}
                </a>
              </dd>
            </div>
          )}
          {adresse.length > 0 && (
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-muted">Anschrift</dt>
              <dd className="font-medium not-italic">
                <address className="not-italic">
                  {adresse.map((zeile) => (
                    <span key={zeile} className="block">
                      {zeile}
                    </span>
                  ))}
                </address>
              </dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="text-sm text-muted">{name} hat noch keine Kontaktdaten hinterlegt.</p>
      )}
    </Card>
  );
}
