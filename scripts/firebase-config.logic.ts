/**
 * Die Regeln hinter `pnpm android:firebase` (AGE-642).
 *
 * ══ WAS DIESE DATEI IST ════════════════════════════════════════════════════
 * `android/app/google-services.json` bindet die Schale an ein Firebase-Projekt.
 * Ohne sie initialisiert Firebase nicht, `PushNotifications.register()` wirft
 * auf Capacitors nativem Plugin-Thread, und der Prozess stirbt — gemessen am
 * 03.09. am Pixel 11 Pro. Das `try/catch` in `src/lib/push.ts` kann das
 * prinzipiell nicht fangen; die Ausnahme fliegt ausserhalb des JS-Kontexts.
 *
 * Im Repo liegen darf sie nicht: `.gitignore` fuehrt sie, und der
 * `native-secrets-guard` meldet sie. Sie kommt deshalb aus Infisical.
 *
 * ══ WARUM HIER NUR EINE SACHE GEPRUEFT WIRD ════════════════════════════════
 * Ein falscher PAKETNAME braucht keinen Waechter — das google-services-Plugin
 * bricht den Gradle-Lauf von selbst ab („No matching client found for package
 * name"). Doppelt zu pruefen, was schon laut scheitert, waere Ballast.
 *
 * Was NICHT auffaellt, ist die Konfiguration eines FREMDEN Firebase-Projekts
 * mit demselben Paketnamen. Die baut sauber durch. Erst auf dem Geraet loest
 * die App dann ein Token bei einem Projekt ein, dessen Dienstkonto wir nicht
 * halten; FCM antwortet `SenderId mismatch`, und `send-push` stuft das als
 * dauerhaft ein und LOESCHT das Geraetetoken. Der Fehler entstuende beim Bauen
 * und faellt erst beim Zustellen auf, in einer Tabelle, die niemand ansieht.
 *
 * Deshalb: die Projektkennung der Datei muss die des Dienstkontos sein, das
 * `send-push` benutzt. Das ist die eine Naht, die beide Haelften verbindet.
 */
export interface GoogleServicesPruefung {
  /** `null`, wenn die Konfiguration benutzbar ist — sonst der Grund. */
  fehler: string | null;
  /** Der zu schreibende Inhalt, eingerueckt. Leer, wenn `fehler` steht. */
  datei: string;
}

export function pruefeGoogleServices(
  roh: string | undefined,
  erwartetesProjekt: string,
): GoogleServicesPruefung {
  if (roh === undefined || roh.trim() === "") {
    return {
      fehler:
        "GOOGLE_SERVICES_JSON fehlt (Herkunft: Infisical, Umgebung dev bzw. prod). " +
        "Aufruf: `infisical run --env=dev -- pnpm android:firebase`.",
      datei: "",
    };
  }

  let inhalt: unknown;
  try {
    inhalt = JSON.parse(roh);
  } catch (e) {
    return { fehler: `GOOGLE_SERVICES_JSON ist kein JSON: ${(e as Error).message}`, datei: "" };
  }

  const projekt = (inhalt as { project_info?: { project_id?: unknown } })?.project_info?.project_id;
  if (typeof projekt !== "string" || projekt === "") {
    return { fehler: "GOOGLE_SERVICES_JSON traegt keine `project_info.project_id`.", datei: "" };
  }
  if (projekt !== erwartetesProjekt) {
    return {
      fehler:
        `GOOGLE_SERVICES_JSON gehoert zum Firebase-Projekt \`${projekt}\`, ` +
        `das Dienstkonto von send-push aber zu \`${erwartetesProjekt}\`. ` +
        "Ein Geraetetoken aus dem einen Projekt ist im anderen ungueltig.",
      datei: "",
    };
  }

  return { fehler: null, datei: `${JSON.stringify(inhalt, null, 2)}\n` };
}
