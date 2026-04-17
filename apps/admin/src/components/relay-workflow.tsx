import { clsx } from "clsx";
import type { ReactNode } from "react";
import { InfoTip } from "./info-tip";

export type WorkflowPriceRow = {
  modelKey: string;
  modelName?: string | null;
  inputPricePer1M?: number | string | null;
  outputPricePer1M?: number | string | null;
};

export function WorkflowSection({
  title,
  description,
  tip,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  tip?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx("rounded-2xl border border-white/10 bg-black/10 p-3.5", className)}>
      <div className="flex flex-col gap-2.5 border-b border-white/10 pb-2.5 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">{title}</p>
            {tip ? <InfoTip content={tip} /> : null}
          </div>
          {description ? <p className="mt-1 text-sm leading-6 text-white/58">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function WorkflowMetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: ReactNode;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">{label}</p>
      <p className="mt-1.5 text-[1.7rem] tracking-[-0.04em]">{value}</p>
      {helper ? <p className="mt-2 text-sm leading-6 text-white/52">{helper}</p> : null}
    </div>
  );
}

export function WorkflowDetailGrid({
  items,
  columns = 2,
}: {
  items: Array<{ label: string; value: ReactNode }>;
  columns?: 1 | 2;
}) {
  const visibleItems = items.filter((item) => item.value !== null && item.value !== undefined && item.value !== "");
  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <div className={clsx("grid gap-3", columns === 2 && "md:grid-cols-2")}>
      {visibleItems.map((item) => (
        <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">{item.label}</p>
          <div className="mt-1 text-sm leading-6 text-white/74">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function WorkflowPriceTable({
  rows,
  emptyMessage = "暂未提供模型价格信息。",
  maxRows,
}: {
  rows: WorkflowPriceRow[];
  emptyMessage?: string;
  maxRows?: number;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-3 py-4 text-sm text-white/50">
        {emptyMessage}
      </div>
    );
  }

  const visibleRows = typeof maxRows === "number" ? rows.slice(0, maxRows) : rows;
  const hiddenCount = Math.max(0, rows.length - visibleRows.length);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <div className="hidden grid-cols-[minmax(0,1.2fr)_repeat(2,minmax(0,0.7fr))] gap-3 border-b border-white/10 px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-white/38 md:grid">
        <span>模型</span>
        <span>Input价格</span>
        <span>Output价格</span>
      </div>
      <div className="divide-y divide-white/10">
        {visibleRows.map((row) => (
          <div key={`${row.modelKey}-${row.inputPricePer1M}-${row.outputPricePer1M}`} className="grid gap-2.5 px-4 py-3 md:grid-cols-[minmax(0,1.2fr)_repeat(2,minmax(0,0.7fr))] md:gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/38 md:hidden">模型</p>
              <p className="text-sm font-medium text-white/82">{row.modelName ?? row.modelKey}</p>
              {row.modelName && row.modelName !== row.modelKey ? <p className="mt-1 text-xs text-white/46">{row.modelKey}</p> : null}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/38 md:hidden">Input价格</p>
              <p className="text-sm text-white/72">{row.inputPricePer1M ?? "-"}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/38 md:hidden">Output价格</p>
              <p className="text-sm text-white/72">{row.outputPricePer1M ?? "-"}</p>
            </div>
          </div>
        ))}
      </div>
      {hiddenCount > 0 ? (
        <div className="border-t border-white/10 px-4 py-3 text-sm text-white/48">
          还有 {hiddenCount} 行模型价格信息，请展开编辑查看完整数据。
        </div>
      ) : null}
    </div>
  );
}
