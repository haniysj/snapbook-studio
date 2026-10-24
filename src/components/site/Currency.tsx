import { cn } from "@/lib/utils";

/**
 * Currency mark shown next to every price. Omani Rial uses the official symbol
 * (same artwork as the Jamiya platform), drawn inline so it inherits text color and size.
 */
export function Currency({ code, className }: { code?: string | null; className?: string }) {
  const c = (code || "OMR").toUpperCase();
  if (c === "OMR") return <OmrSign className={className} />;
  return <span className={className}>{c}</span>;
}

/** Official Omani Rial symbol. */
export function OmrSign({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center", className)} role="img" aria-label="ريال عماني" title="ريال عماني">
      <svg viewBox="0 0 1536 801" aria-hidden="true" className="h-[0.58em] w-[1.12em] shrink-0 fill-current">
        <path d="M 1532 396 L 1518 393 L 677 395 L 671 392 L 618 327 L 604 295 L 604 276 L 608 263 L 623 242 L 636 231 L 664 217 L 695 211 L 737 212 L 786 227 L 826 249 L 873 283 L 946 357 L 951 358 L 1008 137 L 1008 123 L 974 90 L 933 58 L 893 34 L 834 10 L 802 5 L 792 0 L 759 0 L 755 4 L 738 6 L 715 15 L 680 39 L 646 77 L 603 144 L 578 198 L 555 274 L 546 331 L 542 393 L 254 395 L 163 547 L 165 552 L 598 551 L 606 557 L 664 636 L 661 639 L 95 638 L 80 658 L 2 794 L 6 797 L 771 795 L 1224 800 L 1228 797 L 1274 798 L 1282 793 L 1371 639 L 1064 638 L 1020 624 L 954 596 L 887 559 L 885 554 L 890 551 L 1434 553 L 1442 544 Z" />
      </svg>
    </span>
  );
}
