import type { ReactNode } from "react";

interface CreateEventPageShellProps {
  sidebar: ReactNode;
  children: ReactNode;
}

export function CreateEventPageShell({
  sidebar,
  children,
}: CreateEventPageShellProps) {
  return (
    <div className="min-h-full bg-white">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px] xl:grid-cols-[minmax(0,1fr)_240px]">
          <div className="min-w-0">{children}</div>
          <aside className="lg:sticky lg:top-6 lg:self-start">{sidebar}</aside>
        </div>
      </div>
    </div>
  );
}
