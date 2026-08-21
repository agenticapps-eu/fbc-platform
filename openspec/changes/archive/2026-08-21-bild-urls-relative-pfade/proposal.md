## Why

Linear: **AGE-580**.

`profiles.avatar_url` und `profiles.cover_url` tragen keine Pfade, sondern
**absolute URLs mit der Supabase-Projektkennung darin**. Gemessen: **56** Zeilen
mit absoluter `avatar_url`, **53** mit absoluter `cover_url`, **keine einzige
relativ**.

Solange PROD die Kennung `viwntbodrtqxgmqyxluh` behält (Weg A des
Neuaufbau-Plans), ist das folgenlos. **Unter einer neuen Kennung zeigen alle 109
Bild-URLs ins Leere**, obwohl die Objekte korrekt mitgezogen wären. Das sieht
kein Grant-Test und keine Zeilenzählung; es fällt erst im Browser auf, als leeres
Profilbild.

`docs/prod-neuaufbau-plan.md` trägt dafür Schritt 3b — ein `update`, das den Host
austauscht. Das ist eine Notlösung, die bei **jedem** Projektwechsel erneut
fällig wird und die niemand erzwingt. Dies hier ist die dauerhafte Form.

**Das Muster existiert im Repo bereits.** `event-covers` und `post-media` legen
Pfade ab und lösen beim Lesen auf (`src/lib/event-cover.ts`,
`src/lib/post-media.ts`). Diese Change zieht die zwei Profilspalten nach, statt
etwas Neues zu erfinden — mit dem Unterschied, dass `avatars` und `covers`
**öffentliche** Buckets sind und deshalb keine Signatur brauchen. Der Auflöser
ist eine reine Funktion, kein `async`.

## What Changes

- **Zwei Erzeuger schreiben künftig Pfade statt URLs:** `src/lib/profile.ts`
  (`uploadBild`, heute `getPublicUrl`) und der WordPress-Import
  (`supabase/seed/wp_bilder.ts:466`, der die URL von Hand zusammensetzt).
  Ein **dritter** Erzeuger bleibt bewusst wie er ist: der Demo-Seed schreibt
  `https://i.pravatar.cc/…` (`demo_personas.sql:88`,
  `demo_legacy_profile.sql:60`) — das ist gar kein Supabase-Storage, und die
  Anforderung ist deshalb auf Supabase-verwaltete Bilder begrenzt.
- **Ein Auflöser beim Anzeigen.** Er reicht durch, was **schon absolut** ist, und
  ergänzt nur nackte Pfade. Das ist keine Vorsichtsmaßnahme für einen
  hypothetischen Fall, sondern für zwei reale — siehe unten.
- **Drei Anzeigestellen**, nicht neunzehn: `<Avatar>` (der einzige Trichter für
  Profilbilder), `ProfileHero` (Hintergrundbild) und die Cover-Vorschau im
  Editor (`ProfilPage`), die den gespeicherten Wert an `ProfileHero` vorbei
  selbst rendert.
- **Eine Migration** schneidet die Bestandszeilen auf Pfade zurück — ohne die
  Projektkennung hart zu schreiben.
- **Spec:** `member-profiles` sagt heute „ein nicht aktiviertes Konto SHALL keine
  Bild-**URL** erhalten". Die Aussage muss auf den Pfad gezogen werden, sonst
  beschreibt sie eine Spalte, die es so nicht mehr gibt.

## Warum der Auflöser durchreichen MUSS

Zwei Gründe, beide gemessen, keiner hypothetisch:

1. **Die Editor-Vorschauen reichen `blob:`-URLs durch dieselben Trichter.**
   `ProfilPage:262` rendert `<Avatar src={preview ?? values.avatar_url}>` und
   `ProfilPage:287` ein `<img src={coverPreview ?? values.cover_url}>`. Ein
   Auflöser, der stur den Bucket-Host voranstellt, zerlegt die Vorschau beim
   Hochladen — **und kein jsdom-Test sähe das**, weil jsdom kein Bild lädt.
2. **Das Fenster zwischen Migration und Deploy.** In beiden Richtungen: eine
   ältere ausgelieferte Fassung schreibt nach der Migration weiter absolute
   URLs, und die neue Fassung muss sie anzeigen können.

## Der Plan-Review hat den Zuschnitt verdoppelt

gemini APPROVE (drei Befunde), codex REQUEST-CHANGES (sieben, zwei HIGH).
**Alle zehn geprüft, alle zehn übernommen** — Einzelheiten in `REVIEWS.md`. Der
schwerste betrifft nicht den Code, sondern die **Reihenfolge**:

Ein altes Bundle, das einen nackten Pfad bekommt, rendert
`<img src="uid/123.webp">` relativ zum Anwendungs-Origin — ein totes Bild auf
der **ganzen Fläche**. Das Durchreichen deckt nur „neuer Leser, alter Wert",
nicht die Gegenrichtung.

**Folge: zwei PRs mit einem Deploy dazwischen.** Stufe 1 ist nur der Leser und
für sich folgenlos; Stufe 2 bringt Erzeuger und Migration, erst wenn Stufe 1 am
ausgelieferten Bundle nachweislich live ist. Als ein Merge ginge es nicht:
`migrate-dev` wendet Migrationen auf `main` automatisch an, der Frontend-Deploy
läuft daneben — die Reihenfolge wäre dem Zufall überlassen.

Zwei weitere Befunde haben Entwurfsentscheidungen **gedreht**: die Migration
schneidet nur um, wenn das Objekt lokal nachweislich existiert (statt „Kennung
nicht hart schreiben", was eine fremde Supabase-URL mit zerschnitten hätte), und
„absolut" wird am vorhandenen URI-Schema erkannt statt an einer Liste — die
Liste hatte `http:` übersehen, unter dem der lokale Stack läuft.

## Impact

- `src/lib/profile.ts`, ein neuer Auflöser in `src/lib/`, `src/components/ui/Avatar.tsx`,
  `src/components/profile/ProfileHero.tsx`, `src/pages/ProfilPage.tsx`
- `supabase/seed/wp_bilder.ts`
- eine Migration unter `supabase/migrations/`
- Spec `member-profiles`

**Nicht betroffen:** `event-covers` und `post-media` (laufen schon über Pfade),
`WillkommenPage:600` (reine Blob-Vorschau, liest die Spalte nie).
