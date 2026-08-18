import { cn } from "@/lib/utils"

export type StatusState = "idle" | "loading" | "success" | "error"

export interface StatusValue {
  state: StatusState
  message: string
}

export function StatusMessage({ status }: { status: StatusValue }) {
  return (
    <p
      role={status.state === "error" ? "alert" : "status"}
      aria-live="polite"
      className={cn(
        "text-sm text-muted-foreground",
        status.state === "error" && "text-destructive",
        status.state === "success" && "text-success",
      )}
    >
      {status.message}
    </p>
  )
}
