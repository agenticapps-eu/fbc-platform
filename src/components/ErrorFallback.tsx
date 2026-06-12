import { Button } from "./ui/Button";
import { Card, CardDescription, CardTitle } from "./ui/Card";
import { Logo } from "./ui/Logo";

interface ErrorFallbackProps {
  resetError: () => void;
  eventId?: string;
}

/** Freundlicher Fallback im FBC-Look, wenn die App-ErrorBoundary greift. */
export function ErrorFallback({ resetError, eventId }: ErrorFallbackProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-warm px-6">
      <Card className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <CardTitle>Da ist etwas schiefgelaufen</CardTitle>
        <CardDescription>
          Ein unerwarteter Fehler ist aufgetreten. Unser Team wurde automatisch informiert. Bitte
          versuche es erneut.
        </CardDescription>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="primary" onClick={resetError}>
            Erneut versuchen
          </Button>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Seite neu laden
          </Button>
        </div>
        {eventId && <p className="mt-6 text-xs text-grey/70">Referenz: {eventId}</p>}
      </Card>
    </div>
  );
}
