"use client";
import EventSearchPage from "@/components/EventSearchPage";
import { Suspense } from "react";

export default function Page() {
  return (
    <Suspense fallback={<div>...</div>}>
      <EventSearchPage />
    </Suspense>
  );
}
