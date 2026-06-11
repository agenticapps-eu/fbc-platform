import { Link } from "react-router-dom";
import PagePlaceholder from "../components/PagePlaceholder";

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <PagePlaceholder title="Login" description="Anmeldung folgt in einem späteren Issue." />
      <Link to="/" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
        ← Zurück zum Feed
      </Link>
    </main>
  );
}
