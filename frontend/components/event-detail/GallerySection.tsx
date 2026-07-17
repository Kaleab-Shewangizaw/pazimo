"use client";

import Image from "next/image";

type GalleryImage = { url: string; caption?: string };

type GallerySectionProps = {
  images: GalleryImage[];
  heading?: string;
};

export default function GallerySection({
  images,
  heading = "Event Images",
}: GallerySectionProps) {
  if (!images.length) return null;

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        {heading}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {images.map((image, index) => (
          <div
            key={index}
            className="relative aspect-video rounded-xl overflow-hidden"
          >
            <Image
              src={image.url}
              alt={image.caption || `Event image ${index + 1}`}
              fill
              className="object-cover hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
            {image.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/40 backdrop-blur-md text-white p-2 text-sm">
                {image.caption}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
