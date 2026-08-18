export function EvidenceReferences({
  references,
  label = "Evidence records",
}: {
  references: string[]
  label?: string
}) {
  const uniqueReferences = Array.from(new Set(references.filter(Boolean)))

  return (
    <details className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium md:min-h-0">
        {label} ({uniqueReferences.length})
      </summary>
      {uniqueReferences.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          No source records are available for this item.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1" aria-label={label}>
          {uniqueReferences.map((reference) => (
            <li
              key={reference}
              className="break-all font-mono text-[10px] text-muted-foreground"
            >
              {reference}
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}
