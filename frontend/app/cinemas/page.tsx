import Link from "next/link";
import { Ticket } from "lucide-react";
import { CinemaPicker } from "@/components/cinemas/cinema-picker";
import type { PublicCinema } from "@/components/cinemas/public-cinema-types";

export const metadata = {
  title: "Cinema | Pazimo",
  description: "What's on at cinemas across Ethiopia — book your seat with Pazimo.",
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const withBase = (path: string) => (API_URL ? `${API_URL}${path}` : path);

// no-store, matching how the home page reads categories and events: a cinema
// can go inactive at any time and a cached page would keep listing it.
async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(withBase(path), { cache: "no-store" });
    if (!res.ok) return fallback;
    const data = await res.json();
    return (data?.data ?? fallback) as T;
  } catch (error) {
    console.error(`Cinema page: failed to load ${path}`, error);
    return fallback;
  }
}

// The directory, nothing else. What is showing — a banner and a hottest-movies
// row — lives on each cinema's own page now, built from that cinema's own
// films rather than pooled across every cinema on one shared shelf.
export default async function CinemasPage() {
  const cinemas = await getJson<PublicCinema[]>("/api/cinemas/public/cinemas", []);

  return (
    <section id="cinemas" className="scroll-mt-24 py-10">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="mb-10 text-center sm:mb-14">
          <p
            className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-500"
            style={{ fontFamily: "var(--font-inter)" }}
          >
            Now booking
          </p>
          <h1 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl">
            Choose a cinema
          </h1>
        </div>

        {cinemas.length === 0 ? (
          <div className="mx-auto max-w-2xl py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950/40">
              <Ticket className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">No cinemas yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Cinema booking is rolling out on Pazimo.{" "}
              <Link href="/" className="text-primary hover:underline">
                Browse events instead
              </Link>
              .
            </p>
          </div>
        ) : (
          <CinemaPicker cinemas={cinemas} />
        )}
      </div>
    </section>
  );
}
