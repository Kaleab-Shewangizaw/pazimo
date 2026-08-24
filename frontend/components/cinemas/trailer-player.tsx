"use client";

import { useState } from "react";
import { Play } from "lucide-react";

/**
 * A trailer, shown as an invitation rather than an embed dropped on the page.
 *
 * YouTube's own iframe is a grey box until it decides to load its player
 * chrome, and it pulls in YouTube's tracking scripts the moment it's on the
 * page whether or not anyone plays anything. Neither is "beautiful", so this
 * starts as the video's own thumbnail — the frame the film's marketing chose
 * — under a play button, and only becomes a live iframe on a real click. The
 * embed is nocookie and autoplays only because a click just asked it to.
 */
export default function TrailerPlayer({
  videoId,
  title,
}: {
  videoId: string;
  title: string;
}) {
  const [playing, setPlaying] = useState(false);
  // YouTube doesn't always have a maxres thumbnail (older or low-res
  // uploads); hqdefault always exists, so a failed maxres load falls back to
  // it rather than showing a broken image.
  const [thumbnail, setThumbnail] = useState(
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
  );

  return (
    <div className="group relative aspect-video overflow-hidden rounded-2xl border border-gray-200 bg-black shadow-md dark:border-white/10">
      {playing ? (
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
          title={`${title} — trailer`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="absolute inset-0 h-full w-full"
          aria-label={`Play the trailer for ${title}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnail}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            onError={() => {
              if (thumbnail.includes("maxresdefault")) {
                setThumbnail(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`);
              }
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30 transition-colors group-hover:from-black/60" />

          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0D47A1]/90 shadow-lg backdrop-blur transition-transform duration-300 ease-out group-hover:scale-110 dark:bg-yellow-400/95 sm:h-20 sm:w-20">
              <Play
                className="ml-1 h-7 w-7 fill-white text-white dark:fill-black dark:text-black sm:h-8 sm:w-8"
              />
            </span>
          </span>

          <span className="absolute bottom-4 left-4 right-4 flex items-center gap-2 text-left text-sm font-medium text-white drop-shadow sm:bottom-5 sm:left-5">
            Watch the trailer
          </span>
        </button>
      )}
    </div>
  );
}
