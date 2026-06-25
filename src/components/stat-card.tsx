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
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            accent
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground truncate text-sm">{title}</p>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
          {hint ? (
            <p className="text-muted-foreground truncate text-xs">{hint}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
