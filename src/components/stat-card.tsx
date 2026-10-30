import type { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function StatCard({
  title,
  value,
  icon: Icon,
  hint,
  accent = "bg-muted text-foreground",
}: {
  title: string
  value: string | number
  icon: LucideIcon
  hint?: string
  accent?: string
}) {
  return (
    <Card className="max-sm:py-0">
      {/* Phones show these two to a row, so the icon sits above the figures. */}
      <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg sm:size-10",
            accent
          )}
        >
          <Icon className="size-4 sm:size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs sm:truncate sm:text-sm">
            {title}
          </p>
          <p className="text-lg font-semibold tracking-tight break-words sm:text-2xl">
            {value}
          </p>
          {hint ? (
            <p className="text-muted-foreground text-xs sm:truncate">{hint}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
