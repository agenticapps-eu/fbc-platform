interface PagePlaceholderProps {
  title: string;
  description?: string;
}

export default function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <section>
      <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="mt-2 text-sm text-muted">
        {description ?? "Inhalt folgt in einem späteren Issue."}
      </p>
    </section>
  );
}
