import "./instrument"; // ← MUSS der erste Import bleiben (Sentry vor allem anderen).

import * as Sentry from "@sentry/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ErrorFallback } from "./components/ErrorFallback";
import { ToastProvider } from "./components/ui/Toast";
import { AuthProvider } from "./providers/AuthProvider";
import "./index.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!, {
  // React 19: Fehler an Sentry weiterreichen, die ErrorBoundaries nicht abfangen.
  onUncaughtError: Sentry.reactErrorHandler(),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
}).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={({ resetError, eventId }) => (
        <ErrorFallback resetError={resetError} eventId={eventId} />
      )}
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
