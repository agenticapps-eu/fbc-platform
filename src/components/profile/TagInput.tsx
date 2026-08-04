import { useState, type KeyboardEvent } from "react";
import { cn } from "../../lib/cn";

export interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  id?: string;
  placeholder?: string;
  invalid?: boolean;
}

/**
 * Chip-Eingabe für String-Listen (Rollen, Kompetenzen). Enter oder Komma fügt
 * hinzu, „×“ oder Backspace (bei leerem Feld) entfernt. Duplikate werden ignoriert.
 */
export function TagInput({ value, onChange, id, placeholder, invalid }: TagInputProps) {
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const tag = raw.trim();
    if (tag === "") return;
    if (!value.includes(tag)) onChange([...value, tag]);
    setDraft("");
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit(draft);
    } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
      remove(value.length - 1);
    }
  }

  return (
    <div
      className={cn(
        "flex min-h-11 flex-wrap items-center gap-1.5 rounded-md border bg-canvas px-2 py-1.5 transition-colors focus-within:ring-2 focus-within:ring-offset-1 focus-within:ring-offset-soft",
        invalid
          ? "border-danger focus-within:ring-danger"
          : "border-line focus-within:border-accent focus-within:ring-accent",
      )}
    >
      {value.map((tag, index) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-strong"
        >
          {tag}
          <button
            type="button"
            onClick={() => remove(index)}
            className="text-accent-strong/70 transition-colors hover:text-accent-strong"
            aria-label={`${tag} entfernen`}
          >
            &times;
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => commit(draft)}
        placeholder={value.length === 0 ? placeholder : undefined}
        className="h-7 min-w-[8rem] flex-1 bg-transparent px-1 text-sm text-ink outline-none placeholder:text-muted/60"
      />
    </div>
  );
}
