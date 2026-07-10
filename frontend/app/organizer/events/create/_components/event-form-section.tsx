import type { ReactNode } from "react";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EventFormSectionProps {
  id: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function EventFormSection({
  id,
  actions,
  children,
  className,
  contentClassName,
}: EventFormSectionProps) {
  return (
    <Card
      id={id}
      className={cn(
        "rounded-[28px] border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm",
        className,
      )}
    >
      <CardContent className={cn("space-y-6 p-5 sm:p-6 lg:p-8", contentClassName)}>
        {actions ? <div className="flex justify-end">{actions}</div> : null}
        {children}
      </CardContent>
    </Card>
  );
}
