import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

export function AdminDrawer({
  open,
  title,
  kicker = "侧边面板",
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  kicker?: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[220] bg-black/72 backdrop-blur-sm">
      <div aria-hidden="true" className="absolute inset-0" onClick={onClose} role="presentation" />
      <aside className="absolute inset-y-0 right-0 flex h-full w-full max-w-[54rem] flex-col overflow-hidden border-l border-white/10 bg-[linear-gradient(180deg,rgba(49,37,18,0.97),rgba(24,22,20,0.995))] shadow-[rgba(0,0,0,0.42)_0_28px_80px]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-3.5 md:px-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">{kicker}</p>
            <h2 className="mt-1.5 text-[1.8rem] tracking-[-0.04em] text-white md:text-[1.9rem]">{title}</h2>
            {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">{description}</p> : null}
          </div>
          <button className="pill pill-idle" onClick={onClose} type="button">
            关闭
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 md:px-6">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}
