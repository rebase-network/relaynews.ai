import { clsx } from "clsx";
import { type ReactNode, useEffect, useRef, useState } from "react";

export function InfoTip({
  content,
  align = "left",
}: {
  content: ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <span className="relative inline-flex" ref={rootRef}>
      <button
        aria-expanded={open}
        className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-[11px] font-semibold text-white/58 transition hover:border-[#ffd06a]/35 hover:text-white"
        onClick={() => setOpen((current) => !current)}
        title="查看说明"
        type="button"
      >
        ?
      </button>
      {open ? (
        <div
          className={clsx(
            "absolute top-[calc(100%+0.55rem)] z-30 w-64 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(57,43,21,0.98),rgba(24,22,20,0.99))] px-3 py-2.5 text-sm leading-6 text-white/72 shadow-[rgba(0,0,0,0.34)_0_22px_40px]",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {content}
        </div>
      ) : null}
    </span>
  );
}
