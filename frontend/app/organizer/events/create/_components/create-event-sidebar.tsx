import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CreateEventSidebarProps {
  isSubmitting: boolean;
  isSubmitDisabled: boolean;
  onCancel: () => void;
}

export function CreateEventSidebar({
  isSubmitting,
  isSubmitDisabled,
  onCancel,
}: CreateEventSidebarProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div className="flex flex-col gap-3">
          <Button
            type="submit"
            disabled={isSubmitting || isSubmitDisabled}
            className="h-12 rounded-2xl bg-sky-600 text-base font-semibold text-white hover:bg-sky-700"
          >
            {isSubmitting ? "Creating Event..." : "Create Event"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="h-11 rounded-2xl border-slate-200 dark:border-slate-800"
          >
            Cancel
          </Button>
          <div className="flex items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="mr-2 h-4 w-4" />
            Ready to publish
          </div>
        </div>
      </div>
    </div>
  );
}
