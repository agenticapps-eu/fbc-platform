import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form";
import { CategoryIcon } from "../components/matching/CategoryIcon";
import { TagInput } from "../components/profile/TagInput";
import { Button } from "../components/ui/Button";
import { Card, CardDescription, CardTitle } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Textarea } from "../components/ui/Textarea";
import { useToast } from "../components/ui/toast-context";
import {
  MATCHING_THEMES,
  NEED_CATEGORIES,
  OFFER_CATEGORIES,
  VOLUME_BANDS,
  findCategory,
  routingForBand,
} from "../config/matching";
import { dashboardQueryKey } from "../lib/dashboard";
import {
  EMPTY_NEED,
  EMPTY_OFFER,
  fetchMatchingProfile,
  matchingProfileQueryKey,
  matchingProfileSchema,
  saveMatchingProfile,
  type MatchingProfileValues,
} from "../lib/matching-profile";
import { useAuth } from "../providers/auth-context";

const EMPTY_VALUES: MatchingProfileValues = { offers: [], needs: [] };

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Unbekannter Fehler.";
}

/**
 * Such-/Bieteprofil-Editor (AGE-244). Seit AGE-314 lebt er als Tab in /compass
 * (Spec §3: „Biete & Suche wird Teil von Compass") und nicht mehr als eigene
 * Seite — Hero und Tab-Leiste stellt CompassPage.
 */
export function AngeboteGesucheEditor() {
  const { user } = useAuth();
  // Der Compass-Tab ist requiresAuth — user ist hier vorhanden; defensiver Fallback.
  if (!user) return null;
  return <MatchingProfileEditor uid={user.id} />;
}

function MatchingProfileEditor({ uid }: { uid: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const queryKey = matchingProfileQueryKey(uid);
  // Formular nur EINMAL aus den Serverdaten befüllen (vgl. ProfilPage).
  const initialized = useRef(false);

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => fetchMatchingProfile(uid),
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<MatchingProfileValues>({
    resolver: zodResolver(matchingProfileSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (data && !initialized.current) {
      reset(data);
      initialized.current = true;
    }
  }, [data, reset]);

  const offers = useFieldArray({ control, name: "offers" });
  const needs = useFieldArray({ control, name: "needs" });

  const mutation = useMutation({
    mutationFn: () => saveMatchingProfile(uid, getValues()),
    onError: (error) => {
      toast({
        variant: "error",
        title: "Speichern fehlgeschlagen",
        description: errorMessage(error),
      });
    },
    onSuccess: () => {
      toast({
        variant: "success",
        title: "Such- & Bieteprofil gespeichert",
        description: "Deine Angebote und Gesuche fließen ins Matching ein.",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      // Das Dashboard-Matching-Grid liest dieselben offers/needs.
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey(uid) });
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted">Such- &amp; Bieteprofil wird geladen…</p>;
  }
  if (isError) {
    return (
      <p className="text-sm text-danger">
        Such- &amp; Bieteprofil konnte nicht geladen werden. Bitte neu laden.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(() => mutation.mutate())}
      className="flex flex-col gap-6"
      noValidate
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Pflege, was du anbietest und wonach du suchst. Daraus entstehen deine Matches — es ist
            eine Chancen-Datenbank, kein Kontaktverzeichnis.
          </p>
        </div>
        <Button type="submit" variant="primary" disabled={mutation.isPending}>
          {mutation.isPending ? "Speichern…" : "Speichern"}
        </Button>
      </header>

      {/* Meine Angebote (offers) */}
      <Card id="angebote" className="flex scroll-mt-24 flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Meine Angebote</CardTitle>
            <CardDescription>Was du in die Community einbringst.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => offers.append(EMPTY_OFFER)}>
            + Angebot
          </Button>
        </div>
        {offers.fields.length === 0 ? (
          <CardDescription>Noch keine Angebote hinterlegt.</CardDescription>
        ) : (
          <ul className="flex flex-col gap-4">
            {offers.fields.map((row, index) => (
              <OfferRow
                key={row.id}
                index={index}
                register={register}
                control={control}
                errors={errors}
                setValue={setValue}
                onRemove={() => offers.remove(index)}
              />
            ))}
          </ul>
        )}
      </Card>

      {/* Meine Gesuche (needs) */}
      <Card id="gesuche" className="flex scroll-mt-24 flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Meine Gesuche</CardTitle>
            <CardDescription>Wonach du suchst — inkl. Volumen fürs Routing.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => needs.append(EMPTY_NEED)}>
            + Gesuch
          </Button>
        </div>
        {needs.fields.length === 0 ? (
          <CardDescription>Noch keine Gesuche hinterlegt.</CardDescription>
        ) : (
          <ul className="flex flex-col gap-4">
            {needs.fields.map((row, index) => (
              <NeedRow
                key={row.id}
                index={index}
                register={register}
                control={control}
                errors={errors}
                setValue={setValue}
                onRemove={() => needs.remove(index)}
              />
            ))}
          </ul>
        )}
      </Card>

      <div className="flex items-center justify-end gap-4">
        <Button type="submit" variant="primary" disabled={mutation.isPending}>
          {mutation.isPending ? "Speichern…" : "Speichern"}
        </Button>
      </div>
    </form>
  );
}

// ── Zeilen-Komponenten ─────────────────────────────────────────────────────────
interface RowProps {
  index: number;
  register: UseFormRegister<MatchingProfileValues>;
  control: Control<MatchingProfileValues>;
  errors: FieldErrors<MatchingProfileValues>;
  setValue: UseFormSetValue<MatchingProfileValues>;
  onRemove: () => void;
}

function ItemPanel({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line bg-soft p-4">
      <div className="flex flex-col gap-3">{children}</div>
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onRemove} aria-label="Eintrag entfernen">
          Entfernen
        </Button>
      </div>
    </li>
  );
}

function CategoryGlyph({ side, categoryKey }: { side: "offer" | "need"; categoryKey: string }) {
  const cat = findCategory(side, categoryKey);
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gold-soft text-gold-strong">
      {cat ? (
        <CategoryIcon icon={cat.icon} className="h-5 w-5" />
      ) : (
        <span className="text-sm font-semibold">?</span>
      )}
    </span>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-medium text-muted">{children}</span>;
}

function OfferRow({ index, register, control, errors, setValue, onRemove }: RowProps) {
  const categoryKey = useWatch({ control, name: `offers.${index}.category` }) ?? "";
  const categoryReg = register(`offers.${index}.category`);
  const err = errors.offers?.[index];

  return (
    <ItemPanel onRemove={onRemove}>
      <div className="flex items-center gap-3">
        <CategoryGlyph side="offer" categoryKey={categoryKey} />
        <div className="grid flex-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <FieldLabel>Kategorie</FieldLabel>
            <Select
              {...categoryReg}
              invalid={!!err?.category}
              onChange={(e) => {
                categoryReg.onChange(e);
                // Thema aus der Kategorie vorbelegen (überschreibbar).
                setValue(
                  `offers.${index}.theme`,
                  findCategory("offer", e.target.value)?.theme ?? "",
                  {
                    shouldDirty: true,
                  },
                );
              }}
            >
              <option value="">Kategorie wählen…</option>
              {OFFER_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <FieldLabel>Thema</FieldLabel>
            <Select {...register(`offers.${index}.theme`)} aria-label="Thema">
              <option value="">Ohne Thema</option>
              {MATCHING_THEMES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </div>
      {err?.category && <p className="text-xs text-danger">{err.category.message}</p>}

      <label className="flex flex-col gap-1">
        <FieldLabel>Titel</FieldLabel>
        <Input
          placeholder="z. B. „Beteiligungskapital für Immobilienprojekte“"
          invalid={!!err?.title}
          {...register(`offers.${index}.title`)}
        />
        {err?.title && <p className="text-xs text-danger">{err.title.message}</p>}
      </label>

      <label className="flex flex-col gap-1">
        <FieldLabel>Beschreibung</FieldLabel>
        <Textarea
          rows={2}
          placeholder="Worum geht es konkret? (optional)"
          {...register(`offers.${index}.description`)}
        />
      </label>

      <div className="flex flex-col gap-1">
        <FieldLabel>Tags</FieldLabel>
        <Controller
          control={control}
          name={`offers.${index}.tags`}
          render={({ field }) => (
            <TagInput value={field.value} onChange={field.onChange} placeholder="Tag hinzufügen…" />
          )}
        />
      </div>
    </ItemPanel>
  );
}

function NeedRow({ index, register, control, errors, setValue, onRemove }: RowProps) {
  const categoryKey = useWatch({ control, name: `needs.${index}.category` }) ?? "";
  const band = useWatch({ control, name: `needs.${index}.tx_volume_band` });
  const categoryReg = register(`needs.${index}.category`);
  const err = errors.needs?.[index];
  const routing = routingForBand(band);

  return (
    <ItemPanel onRemove={onRemove}>
      <div className="flex items-center gap-3">
        <CategoryGlyph side="need" categoryKey={categoryKey} />
        <div className="grid flex-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <FieldLabel>Kategorie</FieldLabel>
            <Select
              {...categoryReg}
              invalid={!!err?.category}
              onChange={(e) => {
                categoryReg.onChange(e);
                setValue(
                  `needs.${index}.theme`,
                  findCategory("need", e.target.value)?.theme ?? "",
                  {
                    shouldDirty: true,
                  },
                );
              }}
            >
              <option value="">Kategorie wählen…</option>
              {NEED_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <FieldLabel>Thema</FieldLabel>
            <Select {...register(`needs.${index}.theme`)} aria-label="Thema">
              <option value="">Ohne Thema</option>
              {MATCHING_THEMES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </div>
      {err?.category && <p className="text-xs text-danger">{err.category.message}</p>}

      <label className="flex flex-col gap-1">
        <FieldLabel>Titel</FieldLabel>
        <Input
          placeholder="z. B. „Co-Investor für Quartiersentwicklung“"
          invalid={!!err?.title}
          {...register(`needs.${index}.title`)}
        />
        {err?.title && <p className="text-xs text-danger">{err.title.message}</p>}
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <FieldLabel>Volumen</FieldLabel>
          <Select invalid={!!err?.tx_volume_band} {...register(`needs.${index}.tx_volume_band`)}>
            {VOLUME_BANDS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </Select>
          {err?.tx_volume_band ? (
            <p className="text-xs text-danger">{err.tx_volume_band.message}</p>
          ) : (
            <span className="text-xs text-muted">
              Routing:{" "}
              <span className="font-medium text-ink">
                {routing === "dkri" ? "DKRI Deal-Keeping" : "FBC Matching"}
              </span>
            </span>
          )}
        </label>
        <label className="flex flex-col gap-1">
          <FieldLabel>Beschreibung</FieldLabel>
          <Textarea
            rows={2}
            placeholder="Worum geht es konkret? (optional)"
            {...register(`needs.${index}.description`)}
          />
        </label>
      </div>

      <div className="flex flex-col gap-1">
        <FieldLabel>Tags</FieldLabel>
        <Controller
          control={control}
          name={`needs.${index}.tags`}
          render={({ field }) => (
            <TagInput value={field.value} onChange={field.onChange} placeholder="Tag hinzufügen…" />
          )}
        />
      </div>
    </ItemPanel>
  );
}
