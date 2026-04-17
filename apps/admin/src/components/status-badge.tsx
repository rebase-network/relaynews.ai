import { clsx } from "clsx";
import type { ReactNode } from "react";
import type { StatusTone } from "../shared";

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: StatusTone;
}) {
  return (
    <span className={clsx("status-badge", `status-badge-${tone}`)}>
      <span className="status-badge-dot" aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}
