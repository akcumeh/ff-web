import type { Img } from "@ff/shared";

export function SuitImage({
  img,
  sizes,
  priority = false,
  className,
}: {
  img: Img;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const largest = img.srcset.at(-1);
  if (!largest) return null;
  return (
    <img
      src={largest.url}
      srcSet={img.srcset.map((s) => `${s.url} ${s.w}w`).join(", ")}
      sizes={sizes}
      width={img.width}
      height={img.height}
      alt={img.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      className={className}
      style={img.blur ? { backgroundImage: `url(${img.blur})`, backgroundSize: "cover" } : undefined}
    />
  );
}
