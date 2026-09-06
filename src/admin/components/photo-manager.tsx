"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";
import { ArrowDown, ArrowUp, Star, Trash2, Upload } from "lucide-react";
import { deletePhoto, movePhoto, setCoverPhoto, uploadPhotos } from "@/admin/actions/media";
import type { FormState } from "@/admin/schemas/vehicle";
import { Button } from "@/components/ui/button";

/**
 * Photo management for one listing.
 *
 * The reorder and cover controls are plain `<form action={serverAction}>`
 * submissions rather than drag-and-drop. Drag ordering is nicer with a mouse and
 * unusable without one; explicit up/down buttons work with a keyboard, a screen
 * reader and a phone, and the gallery here is rarely more than six images.
 */

interface Photo {
  id: string;
  url: string;
  alt: string | null;
  position: number;
  isCover: boolean;
  width: number | null;
  height: number | null;
  tier: "a" | "b" | "c" | null;
}

function UploadButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Upload aria-hidden className="size-4" />
      {pending ? "Uploading…" : "Upload"}
    </Button>
  );
}

/** A small icon-only submit that posts one hidden-field form. */
function IconAction({
  action,
  vehicleId,
  mediaId,
  extra,
  title,
  disabled,
  children,
  destructive,
}: {
  action: (formData: FormData) => Promise<void>;
  vehicleId: string;
  mediaId: string;
  extra?: Record<string, string>;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <input type="hidden" name="mediaId" value={mediaId} />
      {extra
        ? Object.entries(extra).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))
        : null}
      <button
        type="submit"
        title={title}
        aria-label={title}
        disabled={disabled}
        className={
          "rounded-md border border-line-strong bg-surface p-1.5 transition-colors disabled:opacity-30 " +
          (destructive
            ? "text-text-muted hover:border-brand hover:text-brand"
            : "text-text-muted hover:border-graphite-400 hover:text-text")
        }
      >
        {children}
      </button>
    </form>
  );
}

export function PhotoManager({
  vehicleId,
  photos,
}: {
  vehicleId: string;
  photos: Photo[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(uploadPhotos, {});
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-4">
      <form
        action={(formData) => {
          formAction(formData);
          // Clear the picker so the same files aren't re-submitted if the
          // operator hits Upload twice.
          if (fileInput.current) fileInput.current.value = "";
        }}
        className="rounded-lg border border-dashed border-line-strong bg-surface p-5"
      >
        <input type="hidden" name="vehicleId" value={vehicleId} />

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-60">
            <label htmlFor="photos" className="eyebrow text-text-muted">
              Add photos
            </label>
            <input
              ref={fileInput}
              id="photos"
              name="photos"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              multiple
              required
              className="mt-1.5 block w-full text-sm text-text-muted file:mr-3 file:rounded-md file:border file:border-line-strong file:bg-surface-sunken file:px-3 file:py-1.5 file:text-sm file:text-text hover:file:bg-surface"
            />
          </div>
          <UploadButton />
        </div>

        <p className="mt-2 text-xs text-text-subtle">
          JPEG, PNG, WebP or AVIF, up to 12 MB each. Shoot at 1600px wide or more — the
          catalogue already carries low-resolution photos and they are visibly soft on a
          detail page.
        </p>

        {state.message ? (
          <p
            role="alert"
            className={
              "mt-3 text-sm " + (state.ok ? "text-emerald-600 dark:text-emerald-400" : "text-brand")
            }
          >
            {state.message}
          </p>
        ) : null}
      </form>

      {photos.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface px-4 py-8 text-center text-sm text-text-subtle">
          No photos yet. The first one uploaded becomes the cover.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo, index) => (
            <li
              key={photo.id}
              className="overflow-hidden rounded-lg border border-line bg-surface"
            >
              <div className="relative aspect-4/3 bg-surface-sunken">
                <Image
                  src={photo.url}
                  alt={photo.alt ?? ""}
                  fill
                  sizes="(min-width: 1024px) 20rem, (min-width: 640px) 45vw, 90vw"
                  className="object-cover"
                />
                {photo.isCover ? (
                  <span className="absolute left-2 top-2 rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Cover
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-1.5 p-2">
                <span className="mr-auto text-xs text-text-subtle">
                  {photo.width && photo.height
                    ? `${photo.width}×${photo.height}`
                    : `#${index + 1}`}
                </span>

                <IconAction
                  action={setCoverPhoto}
                  vehicleId={vehicleId}
                  mediaId={photo.id}
                  title={photo.isCover ? "Already the cover" : "Make this the cover"}
                  disabled={photo.isCover}
                >
                  <Star aria-hidden className="size-3.5" />
                </IconAction>

                <IconAction
                  action={movePhoto}
                  vehicleId={vehicleId}
                  mediaId={photo.id}
                  extra={{ direction: "up" }}
                  title="Move earlier"
                  disabled={index === 0}
                >
                  <ArrowUp aria-hidden className="size-3.5" />
                </IconAction>

                <IconAction
                  action={movePhoto}
                  vehicleId={vehicleId}
                  mediaId={photo.id}
                  extra={{ direction: "down" }}
                  title="Move later"
                  disabled={index === photos.length - 1}
                >
                  <ArrowDown aria-hidden className="size-3.5" />
                </IconAction>

                <IconAction
                  action={deletePhoto}
                  vehicleId={vehicleId}
                  mediaId={photo.id}
                  title="Remove this photo"
                  destructive
                >
                  <Trash2 aria-hidden className="size-3.5" />
                </IconAction>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
