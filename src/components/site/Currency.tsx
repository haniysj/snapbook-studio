import { cn } from "@/lib/utils";

/**
 * Currency mark shown next to every price. Omani Rial uses the official symbol
 * (drawn as an inline icon so it inherits text color/size); other codes show as text.
 */
export function Currency({ code, className }: { code?: string | null; className?: string }) {
  const c = (code || "OMR").toUpperCase();
  if (c === "OMR") return <OmrSign className={className} />;
  return <span className={className}>{c}</span>;
}

/** Omani Rial symbol — placeholder until the official artwork is added. */
export function OmrSign({ className }: { className?: string }) {
  return (
    <span className={cn("inline-block whitespace-nowrap", className)} aria-label="ريال عماني" title="ريال عماني">
      OMR
    </span>
  );
}
