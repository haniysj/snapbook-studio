import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SegmentOption<T extends string> = { value: T; label: ReactNode; badge?: ReactNode };

/**
 * iOS-style segmented control with a sliding thumb.
 * Scrolls horizontally on narrow screens when options don't fit.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "md",
  ariaLabel,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const el = wrap.current?.querySelector<HTMLButtonElement>(`[data-value="${CSS.escape(value)}"]`);
    if (!el || !wrap.current) return;
    const measure = () => setThumb({ left: el.offsetLeft, width: el.offsetWidth });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap.current);
    el.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    return () => ro.disconnect();
  }, [value, options.length]);

  return (
    <div className={cn("no-scrollbar max-w-full overflow-x-auto", className)}>
      <div
        ref={wrap}
        role="tablist"
        aria-label={ariaLabel}
        className="relative inline-flex min-w-full items-stretch rounded-[11px] bg-fill p-[3px]"
      >
        {thumb && (
          <span
            aria-hidden
            className="absolute top-[3px] bottom-[3px] rounded-[8px] bg-card shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)] transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)] dark:bg-[#636366]"
            style={{ left: thumb.left, width: thumb.width }}
          />
        )}
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="tab"
              aria-selected={active}
              data-value={o.value}
              onClick={() => onChange(o.value)}
              className={cn(
                "relative z-10 flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] font-semibold transition-colors",
                size === "sm" ? "px-3 py-1 text-[13px]" : "px-4 py-1.5 text-sm",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
              {o.badge}
            </button>
          );
        })}
      </div>
    </div>
  );
}
