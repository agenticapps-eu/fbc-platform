#!/usr/bin/env bash
# Migrations-Drift-Gate (AGE-496 Task 4.2, schliesst AGE-257).
#
# Vergleicht die Migrationshistorie des Repos mit der eines Zielprojekts —
# IN BEIDE RICHTUNGEN. Drift ist:
#   * lokal vorhanden, remote fehlend   (die neue Migration ist nicht angewendet)
#   * remote vorhanden, lokal fehlend   (jemand hat von Hand geschrieben)
#   * gleiche Menge, abweichende Zuordnung (umsortierte Historie)
#
# Nur die erste Richtung zu pruefen ginge an dem Fall vorbei, den AGE-257 im
# Juni tatsaechlich von Hand reparieren musste
# (20260613081749_avatars_drop_public_listing_policy).
#
# DAS GATE SCHWEIGT NICHT BEI NICHTWISSEN. Fehlt die URL, ist die Datenbank
# nicht erreichbar oder aendert die CLI ihr Ausgabeformat, schlaegt es fehl.
# Ein Gate, das bei Nichtwissen gruen wird, baut die Juni-Havarie eine Ebene
# hoeher nach.
#
# Aufruf:  scripts/migration-drift-gate.sh "$SUPABASE_DB_URL_PROD"

set -euo pipefail

DB_URL="${1:-${SUPABASE_DB_URL_PROD:-}}"

if [ -z "$DB_URL" ]; then
  echo "::error::Keine Verbindungs-URL. Das Gate kann nicht messen und wird deshalb rot."
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION_DIR="$REPO_ROOT/supabase/migrations"

# Wie viele Migrationen liegen im Repo? Der Gegenwert, an dem sich der Parser
# messen lassen muss.
file_count="$(find "$MIGRATION_DIR" -maxdepth 1 -name '*.sql' | wc -l | tr -d ' ')"
if [ "$file_count" -eq 0 ]; then
  echo "::error::Keine Migrationsdateien in $MIGRATION_DIR gefunden. Falsches Verzeichnis?"
  exit 1
fi

listing="$(supabase migration list --db-url "$DB_URL")" || {
  echo "::error::'supabase migration list' ist fehlgeschlagen. Das Gate kann nicht messen."
  exit 1
}

echo "$listing"
echo

# Tabellenzeilen: "  <local> | <remote> | <zeit>". Beide Spalten koennen leer sein,
# deshalb bleibt das Trennzeichen erhalten — bei Aufteilung nach Leerraum
# rutschte ein remote-only-Eintrag sonst in die local-Spalte und das Gate
# meldete den falschen Grund.
rows="$(printf '%s\n' "$listing" |
  sed -n 's/^[[:space:]]*\([0-9]*\)[[:space:]]*|[[:space:]]*\([0-9]*\)[[:space:]]*|.*$/\1|\2/p')"

row_count="$(printf '%s\n' "$rows" | grep -c '[0-9]' || true)"
if [ "$row_count" -eq 0 ]; then
  echo "::error::Aus der Ausgabe liess sich keine einzige Zeile lesen. Hat die CLI ihr Format geaendert?"
  exit 1
fi

# Kreuzprobe gegen die Dateien im Repo: liest der Parser eine andere Zahl
# lokaler Eintraege als es Dateien gibt, misst er nicht, was er zu messen
# vorgibt — etwa weil die CLI ihr Ausgabeformat geaendert hat.
parsed_local="$(printf '%s\n' "$rows" | grep -c '^[0-9]' || true)"
if [ "$parsed_local" -ne "$file_count" ]; then
  echo "::error::Parser liest $parsed_local lokale Migrationen, im Repo liegen $file_count Dateien. Das Gate misst nicht verlaesslich."
  exit 1
fi

drift=0
while IFS='|' read -r local remote; do
  [ -z "$local$remote" ] && continue
  if [ "$local" != "$remote" ]; then
    drift=1
    if [ -z "$remote" ]; then
      echo "::error::DRIFT — lokal vorhanden, auf dem Ziel fehlend: $local"
    elif [ -z "$local" ]; then
      echo "::error::DRIFT — auf dem Ziel vorhanden, lokal fehlend: $remote"
    else
      echo "::error::DRIFT — Reihenfolge weicht ab: lokal $local, remote $remote"
    fi
  fi
done <<<"$rows"

if [ "$drift" -ne 0 ]; then
  echo
  echo "::error::Migrationshistorie weicht ab. Erst 'migrate-prod' freigeben, dann deployen."
  exit 1
fi

echo "OK — $file_count Migrationen, Historie abweichungsfrei."
