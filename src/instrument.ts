// Sentry-Initialisierung. Muss als ALLERERSTER Import in main.tsx geladen
// werden, damit Fehler ab dem frühesten Zeitpunkt erfasst werden.
import { init, reactRouterV7BrowserTracingIntegration, replayIntegration } from "@sentry/react";
import { useEffect } from "react";
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router-dom";

import { entnimmAktivierungsFragment } from "./lib/activation-fragment";

// VOR init(): Sentry erfasst `location.href` samt Fragment, und der
// Replay-Puffer läuft bei jedem Fehler mit. Stünde das Aktivierungs-Token hier
// noch in der Adresszeile, landete es im Replay. Siehe activation-fragment.ts.
// Unabhängig vom DSN, damit die Adresszeile in jeder Umgebung gleich aussieht.
entnimmAktivierungsFragment();

const dsn = import.meta.env.VITE_SENTRY_DSN;

// Nur aktiv, wenn ein DSN gesetzt ist (lokal optional). Ohne DSN passiert nichts.
if (dsn) {
  init({
    dsn,
    environment: import.meta.env.VITE_ENVIRONMENT,
    release: import.meta.env.VITE_SENTRY_RELEASE,
    integrations: [
      // Browser-Tracing inkl. React-Router-v7-Navigations-Spans.
      reactRouterV7BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
      replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    tracesSampleRate: 0.2,
    // Session Replay nur im Fehlerfall — keine anlasslose Aufzeichnung.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
  });
}
