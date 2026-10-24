import type { ReactNode } from "react";

/** Large section heading in the iOS "large title" style. */
export function SectionHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3 px-1">
      <div className="min-w-0">
        <h2 className="text-[26px] font-extrabold leading-tight tracking-tight md:text-3xl">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
