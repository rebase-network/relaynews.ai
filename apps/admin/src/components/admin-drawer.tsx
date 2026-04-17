import { type ReactNode, useEffect, useState } from "react";
import { clsx } from "clsx";
import { createPortal } from "react-dom";

const DRAWER_TRANSITION_MS = 220;
const DRAWER_ENTER_DELAY_MS = 24;

export function AdminDrawer({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const timeout = window.setTimeout(() => {
        setActive(true);
      }, DRAWER_ENTER_DELAY_MS);

      return () => {
        window.clearTimeout(timeout);
      };
    }

    if (!mounted) {
      return;
    }

    setActive(false);
    const timeout = window.setTimeout(() => {
      setMounted(false);
    }, DRAWER_TRANSITION_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [mounted, open]);

  useEffect(() => {
    if (!mounted || typeof document === "undefined") {
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
  }, [mounted, onClose]);

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[220]">
      <div
        aria-hidden="true"
        className={clsx("drawer-backdrop absolute inset-0", active && "drawer-backdrop-open")}
        onClick={onClose}
        role="presentation"
      />
      <aside
        className={clsx(
          "drawer-panel absolute inset-y-0 right-0 flex h-full w-full max-w-[54rem] flex-col overflow-hidden border-l border-white/10 bg-[linear-gradient(180deg,rgba(49,37,18,0.97),rgba(24,22,20,0.995))] shadow-[rgba(0,0,0,0.42)_0_28px_80px]",
          active && "drawer-panel-open",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-3.5 md:px-6">
          <div>
            <h2 className="text-[1.8rem] tracking-[-0.04em] text-white md:text-[1.9rem]">{title}</h2>
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
