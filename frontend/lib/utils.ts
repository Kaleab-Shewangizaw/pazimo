import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeEthiopianPhone(phone: string): string | null {
  if (!phone) return null;
  // Remove all non-digit characters except leading +
  let clean = phone.replace(/[^\d+]/g, "");

  // Handle 09/07 format (e.g. 0911223344 -> +251911223344)
  if (clean.startsWith("09") || clean.startsWith("07")) {
    if (clean.length === 10) {
      return "+251" + clean.substring(1);
    }
  }

  // Handle 251 format without + (e.g. 251911223344 -> +251911223344)
  if (clean.startsWith("251")) {
    if (clean.length === 12) {
      return "+" + clean;
    }
  }

  // Handle +251 format (e.g. +251911223344)
  if (clean.startsWith("+251")) {
    if (clean.length === 13) {
      return clean;
    }
  }

  return null; // Invalid format
}
