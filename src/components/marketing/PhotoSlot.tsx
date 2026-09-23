import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Swaps between a real photograph (once the owner supplies one under
 * public/pathways/marketing/ and its path is filled in in
 * src/content/marketing-photos.ts) and an illustrated fallback, with
 * no layout change required either way. The parent element must be
 * `position: relative` with a defined height (next/image `fill`
 * mode) -- every current call site already is.
 *
 * See docs/pathways/IMAGE_ASSET_MANIFEST.md for the required asset
 * list this slot mechanism exists to serve, and
 * docs/pathways/MEDIA_SOURCE_REGISTER.md for why every slot is still
 * `null` as of this commit.
 */
export function PhotoSlot({
  photoSrc,
  alt,
  fallback,
  priority = false,
  sizes = "100vw",
}: {
  photoSrc: string | null;
  alt: string;
  fallback: ReactNode;
  priority?: boolean;
  sizes?: string;
}) {
  if (!photoSrc) {
    return <>{fallback}</>;
  }

  return (
    <Image
      src={photoSrc}
      alt={alt}
      fill
      priority={priority}
      sizes={sizes}
      style={{ objectFit: "cover" }}
    />
  );
}
