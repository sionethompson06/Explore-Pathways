import Image from "next/image";

/**
 * Renders an Asset Pack 2 (product/infographic) image at its natural
 * aspect ratio -- never cropped or shrunk to illegibility, per the
 * Phase 2C responsive requirement. Always paired with equivalent
 * semantic HTML content by the section that renders it (see
 * src/content/marketing-infographics.ts), so this is decorative by
 * default (empty alt) unless a specific alt is supplied.
 */
export function InfographicImage({
  src,
  alt = "",
  width,
  height,
  priority = false,
}: {
  src: string;
  alt?: string;
  width: number;
  height: number;
  priority?: boolean;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      sizes="(max-width: 900px) 100vw, 900px"
      style={{ width: "100%", height: "auto", borderRadius: "var(--radius-lg)" }}
    />
  );
}
