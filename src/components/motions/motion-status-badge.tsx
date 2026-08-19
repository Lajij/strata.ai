import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { statusTone, type MotionOutcome, type MotionStatus } from "@/lib/strata-data"

const toneDot: Record<string, string> = {
  amber: "bg-warning",
  blue: "bg-primary",
  green: "bg-success",
  red: "bg-destructive",
  slate: "bg-muted-foreground",
  violet: "bg-violet-500",
}

export function MotionStatusBadge({
  status,
  outcome,
  className,
}: {
  status: MotionStatus
  outcome?: MotionOutcome
  className?: string
}) {
  const tone = statusTone[status] ?? "slate"
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", className)}>
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", toneDot[tone] ?? "bg-muted-foreground")}
      />
      {status}
      {outcome ? (
        <span
          aria-label={`Outcome: ${outcome}`}
          className={cn(
            "ml-1 rounded px-1.5 py-0.5 text-xs font-medium",
            outcome === "Passed" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
          )}
        >
          {outcome}
        </span>
      ) : null}
    </Badge>
  )
}
