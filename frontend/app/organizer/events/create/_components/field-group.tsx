import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface FieldGroupProps {
  children: ReactNode;
  className?: string;
}

export function FieldGroup({ children, className }: FieldGroupProps) {
  return <div className={cn("grid gap-2.5", className)}>{children}</div>;
}

interface FieldHintProps {
  children: ReactNode;
  className?: string;
}

export function FieldHint({ children, className }: FieldHintProps) {
  return (
    <p className={cn("text-xs leading-5 text-slate-500 dark:text-slate-400", className)}>
      {children}
    </p>
  );
}
