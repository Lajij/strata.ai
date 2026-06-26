import type { ReactNode } from "react";

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

export function MessageResponse({ children }: { children: ReactNode }) {
  const text = typeof children === "string" ? children : "";

  if (!text.trim()) {
    return null;
  }

  return (
    <div className="space-y-2 text-sm leading-6 text-slate-700">
      {text.split(/\n{2,}/).map((block) => {
        const trimmed = block.trim();

        if (!trimmed) {
          return null;
        }

        if (trimmed.startsWith("- ")) {
          return (
            <ul key={trimmed} className="list-disc space-y-1 pl-5">
              {trimmed.split(/\n/).map((item) => (
                <li key={item}>{renderInlineMarkdown(item.replace(/^- /, ""))}</li>
              ))}
            </ul>
          );
        }

        if (trimmed.startsWith("#")) {
          return (
            <p key={trimmed} className="font-semibold text-slate-950">
              {trimmed.replace(/^#+\s*/, "")}
            </p>
          );
        }

        return <p key={trimmed}>{renderInlineMarkdown(trimmed)}</p>;
      })}
    </div>
  );
}
