"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

type AboutSectionProps = {
  description: string;
  organizerName?: string;
};

export default function AboutSection({
  description,
  organizerName,
}: AboutSectionProps) {
  const [showFull, setShowFull] = useState(false);
  const paragraphs = description.split("\n\n").filter(Boolean);
  const shortDescription = paragraphs[0] || description;

  return (
    <div className="space-y-8">
      <div className="rounded-3xl p-6 md:p-8 bg-white/55 dark:bg-white/[0.05] backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-[0_8px_32px_rgba(31,38,135,0.1)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          About This Event
        </h2>
        <div className="text-gray-600 dark:text-gray-300 leading-relaxed space-y-4">
          {showFull ? (
            paragraphs.map((p, i) => (
              <p key={i} className="whitespace-pre-line">
                {p}
              </p>
            ))
          ) : (
            <p className="whitespace-pre-line">{shortDescription}</p>
          )}
        </div>
        {paragraphs.length > 1 && (
          <button
            onClick={() => setShowFull(!showFull)}
            className="mt-4 text-[#0D47A1] dark:text-yellow-400 text-sm font-medium flex items-center gap-1 hover:underline"
          >
            {showFull ? "Show less" : "Read more"}
            {showFull ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {organizerName && (
        <div className="rounded-3xl p-6 bg-white/55 dark:bg-white/[0.05] backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-[0_8px_32px_rgba(31,38,135,0.1)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#0D47A1] to-blue-500 dark:from-yellow-400 dark:to-amber-500 flex items-center justify-center text-white dark:text-black font-bold text-xl shrink-0 shadow-lg">
            {organizerName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">
              {organizerName}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Event Organizer
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
