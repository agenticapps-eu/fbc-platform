interface PagePlaceholderProps {
  title: string;
  description?: string;
}

export default function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="mt-2 text-sm text-grey">
        {description ?? "Inhalt folgt in einem späteren Issue."}
      </p>
    </section>
  );
}
