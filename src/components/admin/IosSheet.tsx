import type { ReactNode } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { Loader2 } from "lucide-react";
import { useLang } from "@/lib/app-context";
import { cn } from "@/lib/utils";

/** iOS bottom sheet with "Cancel · Title · Save" header. */
export function IosSheet({
  open,
  onOpenChange,
  title,
  onSave,
  saving,
  saveLabel,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  onSave?: () => void;
  saving?: boolean;
  saveLabel?: string;
  children: ReactNode;
}) {
  const { lang } = useLang();
  const ar = lang === "ar";
  return (
    <DrawerPrimitive.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DrawerPrimitive.Content
          dir={ar ? "rtl" : "ltr"}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] max-w-xl flex-col rounded-t-[1.4rem] bg-background outline-none"
        >
          <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
          {/* fixed physical order: Cancel on the left, Save on the right (also in Arabic) */}
          <div dir="ltr" className="hairline-b grid shrink-0 grid-cols-[1fr_auto_1fr] items-center px-4 py-2.5">
            <button type="button" onClick={() => onOpenChange(false)} className="justify-self-start text-[15px] text-ios-blue">
              {ar ? "إلغاء" : "Cancel"}
            </button>
            <DrawerPrimitive.Title dir={ar ? "rtl" : "ltr"} className="text-[16px] font-bold">{title}</DrawerPrimitive.Title>
            {onSave ? (
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className={cn("inline-flex items-center gap-1.5 justify-self-end text-[15px] font-bold text-ios-blue disabled:opacity-50")}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saveLabel ?? (ar ? "حفظ" : "Save")}
              </button>
            ) : <span />}
          </div>
          <DrawerPrimitive.Description className="sr-only">{title}</DrawerPrimitive.Description>
          <div className="overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-4">{children}</div>
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}

/** Grouped form section used inside sheets/settings. */
export function FormGroup({ label, footer, children }: { label?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-5">
      {label && <div className="section-label">{label}</div>}
      <div className="ios-group ios-divide">{children}</div>
      {footer && <p className="mt-1.5 px-4 text-xs text-muted-foreground">{footer}</p>}
    </div>
  );
}

/** One labelled row with an input on the trailing side (or below for long inputs). */
export function FormRow({ label, children, stacked }: { label: string; children: ReactNode; stacked?: boolean }) {
  if (stacked) {
    return (
      <label className="block px-4 py-2.5">
        <span className="mb-1 block text-[13px] font-semibold text-muted-foreground">{label}</span>
        {children}
      </label>
    );
  }
  return (
    <label className="ios-row">
      <span className="w-[42%] shrink-0 text-[15px] font-semibold">{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}

export const fieldCls = "w-full bg-transparent py-1 text-[15px] outline-none placeholder:text-muted-foreground/70";
