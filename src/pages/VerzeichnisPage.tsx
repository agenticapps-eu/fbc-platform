import MemberDirectory from "../components/community/MemberDirectory";

/**
 * Eigenständige Route des Mitgliederverzeichnisses (ab Prime, RequireTier in App.tsx).
 * Dient als Deep-Link; die primäre Oberfläche ist der „Verzeichnis"-Tab in /community.
 * Beide mounten dieselbe MemberDirectory-Komponente.
 */
export default function VerzeichnisPage() {
  return <MemberDirectory />;
}
