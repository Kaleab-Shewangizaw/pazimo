import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  loading?: boolean;
  action?: React.ReactNode;
  className?: string;
}

/**
 * The single metric-card treatment for the organizer dashboard. Every stat on the
 * page should render through this component rather than a one-off Card — that's
 * what keeps KPI cards looking like members of the same family instead of each
 * being individually designed.
 */
function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  loading,
  action,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("gap-0 py-4", className)}>
      <CardContent className="px-4">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground truncate">
            {label}
          </span>
          {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
        </div>

        {loading ? (
          <div className="mt-2 space-y-2">
            <Skeleton className="h-7 w-24" />
          </div>
        ) : (
          <div className="mt-1 flex items-end justify-between gap-2">
            <p className="text-2xl font-semibold tabular-nums text-foreground truncate">
              {value}
            </p>
            {action}
          </div>
        )}

        {hint && !loading && (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}

export { StatCard };
