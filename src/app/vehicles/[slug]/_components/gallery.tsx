"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GalleryProps {
  images: string[];
  /** Vehicle headline — used to build a meaningful alt for every frame. */
  title: string;
}

/**
 * The stage is a 4:3 box rather than full-bleed. Today's library tops out at
 * 1600px on the long edge, so full-bleed would show the compression — but the
 * `sizes` hints below are declared against the layout, not that ceiling, so
 * higher-resolution reshoots will be served at their full width automatically
 * (Next's default deviceSizes run to 3840px). Nothing here needs changing when
 * better files land.
 */
export function Gallery({ images, title }: GalleryProps) {
  const [index, setIndex] = React.useState(0);
  const count = images.length;

  const go = React.useCallback(
    (next: number) => setIndex((next + count) % count),
    [count],
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (count < 2) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      go(index + 1);
    }
  };

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label={`${title} photos`}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-3"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-line bg-surface-sunken">
        {images.map((src, i) => (
          <Image
            key={src}
            src={src}
            alt={`${title} — photo ${i + 1} of ${count}`}
            fill
            priority={i === 0}
            sizes="(max-width: 1024px) 100vw, 60vw"
            className={cn(
              "object-cover transition-opacity duration-300 ease-[var(--ease-out-quick)]",
              i === index ? "opacity-100" : "opacity-0",
            )}
            aria-hidden={i !== index}
          />
        ))}

        {count > 1 && (
          <>
            <GalleryArrow side="left" onClick={() => go(index - 1)} />
            <GalleryArrow side="right" onClick={() => go(index + 1)} />
            <p className="tabular absolute bottom-3 right-3 rounded-sm bg-graphite-950/75 px-2 py-1 text-xs font-semibold text-graphite-0 backdrop-blur-sm">
              {index + 1} / {count}
            </p>
          </>
        )}
      </div>

      {count > 1 && (
        <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6">
          {images.map((src, i) => (
            <li key={src}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-current={i === index}
                aria-label={`Show photo ${i + 1}`}
                className={cn(
                  "relative block aspect-[4/3] w-full overflow-hidden rounded-md border bg-surface-sunken transition-[border-color,opacity] duration-150",
                  i === index
                    ? "border-brand"
                    : "border-line opacity-70 hover:opacity-100",
                )}
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 25vw, 12vw"
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GalleryArrow({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous photo" : "Next photo"}
      className={cn(
        "absolute top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full",
        "bg-graphite-950/70 text-graphite-0 backdrop-blur-sm transition-colors hover:bg-graphite-950",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      <Icon aria-hidden className="size-5" />
    </button>
  );
}
