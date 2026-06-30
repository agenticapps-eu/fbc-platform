import { Card, CardDescription, CardTitle } from "../components/ui/Card";
import { FormatHero } from "../components/ui/FormatHero";
import { VideoEmbed } from "../components/ui/VideoEmbed";
import { FORMAT_HERO } from "../config/formatHero";

/**
 * Academy (AGE-252): kuratierte Lerninhalte als Video. Nutzt die wiederverwendbare
 * <VideoEmbed>-Komponente (YouTube/Vimeo, kein eigenes Hosting). Die Inhalte sind
 * für den Prototyp kuratiert und werden mit dem Demo-Seed (AGE-254) ausgebaut;
 * eine datengetriebene Academy ist ein eigenes Issue.
 */
interface Lesson {
  title: string;
  description: string;
  url: string;
}

const ACADEMY_LESSONS: Lesson[] = [
  {
    title: "Mit dem „Warum“ beginnen",
    description: "Wie herausragende Führung Vertrauen und Wirkung aufbaut.",
    url: "https://www.youtube.com/watch?v=qp0HIF3SfI4",
  },
  {
    title: "Warum Start-ups erfolgreich sind",
    description: "Der wichtigste Faktor hinter erfolgreichen Gründungen.",
    url: "https://www.youtube.com/watch?v=bNpx7gpSqbY",
  },
  {
    title: "Fokus & Beständigkeit",
    description: "Eine ruhige Einstimmung auf das Leitprinzip „Qualität vor Reichweite“.",
    url: "https://vimeo.com/76979871",
  },
];

export default function AcademyPage() {
  return (
    <div className="flex flex-col gap-6">
      <FormatHero meta={FORMAT_HERO["/academy"]} />

      <div className="grid gap-6 sm:grid-cols-2">
        {ACADEMY_LESSONS.map((lesson) => (
          <Card key={lesson.url} className="flex flex-col gap-3">
            <VideoEmbed url={lesson.url} title={lesson.title} />
            <div>
              <CardTitle className="text-base">{lesson.title}</CardTitle>
              <CardDescription>{lesson.description}</CardDescription>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
