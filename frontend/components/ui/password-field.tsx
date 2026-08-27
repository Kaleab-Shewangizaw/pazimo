"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";

/**
 * A password input with its own show/hide toggle.
 *
 * Each instance owns its own visibility state, so a form with several of
 * these (current/new/confirm) never reveals more than the one field someone
 * actually clicked — checking a new password for typos shouldn't also
 * expose the current one sitting above it.
 */
export function PasswordField({
  label,
  value,
  onChange,
  autoComplete = "off",
  placeholder,
  className,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  /**
   * "current-password" invites the browser to autofill a saved credential —
   * deliberately never the default, so a field meant to be typed and proven
   * (e.g. "confirm your current password") isn't silently satisfied by one.
   */
  autoComplete?: "off" | "new-password" | "current-password";
  placeholder?: string;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={className}>
      {label && <Label className="text-xs">{label}</Label>}
      <div className="relative">
        <Input
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="pr-9"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label={visible ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
