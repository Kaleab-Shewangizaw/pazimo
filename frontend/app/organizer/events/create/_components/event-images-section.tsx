import type React from "react";
import { useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { EventFormSection } from "./event-form-section";
import { FieldHint } from "./field-group";

interface EventImagesSectionProps {
  coverImages: File[];
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (index: number) => void;
  required?: boolean;
}

export function EventImagesSection({
  coverImages,
  onImageChange,
  onRemoveImage,
  required,
}: EventImagesSectionProps) {
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    const urls = coverImages.map((image) => URL.createObjectURL(image));
    setPreviewUrls(urls);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [coverImages]);

  return (
    <EventFormSection id="media">
      <div className="grid gap-4">
        <div className="rounded-[24px] border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 p-5">
          <div className="space-y-3">
            <Label htmlFor="coverImages" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Cover images
            </Label>
            <Input
              id="coverImages"
              type="file"
              accept="image/*"
              onChange={onImageChange}
              multiple
              required={required ?? coverImages.length === 0}
              className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            />
            <FieldHint>
              Recommended format: wide, high-contrast artwork around `1200x600`.
            </FieldHint>
          </div>
        </div>

        {coverImages.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {coverImages.map((image, index) => (
              <div
                key={`${image.name}-${index}`}
                className="group overflow-hidden rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
              >
                <div className="relative aspect-[16/10]">
                  {previewUrls[index] ? (
                    <Image
                      src={previewUrls[index]}
                      alt={`Cover image ${index + 1}`}
                      fill
                      className="object-cover"
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onRemoveImage(index)}
                    className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/80 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="p-3">
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{image.name}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </EventFormSection>
  );
}
