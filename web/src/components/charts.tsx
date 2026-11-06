"use client";

import { Table2, BarChart3 } from "lucide-react";
import { useTheme } from "next-themes";
import { useState, type ReactNode } from "react";
import { useMounted } from "@/lib/hooks";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardHeader } from "./ui";

/** Validated reference palette (dataviz skill). Light and dark are selected steps, not a flip. */
const PALETTE = {
  light: {
    series: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"],
    ordinal: ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab"],
    surface: "#fcfcfb",
    hover: "#f0efec",
    grid: "#e1e0d9",
    axis: "#c3c2b7",
    muted: "#898781",
  },
  dark: {
    series: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
    ordinal: ["#184f95", "#256abf", "#3987e5", "#86b6ef"],
    surface: "#1a1a19",
    hover: "#232321",
    grid: "#2c2c2a",
    axis: "#383835",
    muted: "#898781",
  },
};

export function useChartColors() {
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();
  return PALETTE[mounted && resolvedTheme === "dark" ? "dark" : "light"];
}

export function ChartCard({
  title,
  subtitle,
  table,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  table: { columns: string[]; rows: (string | number)[][] };
  children: ReactNode;
  className?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Card className={className}>
      <CardHeader
        title={title}
        subtitle={subtitle}
        action={
          <button
            onClick={() => setAsTable((v) => !v)}
            className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
            aria-label={asTable ? "Show chart" : "Show as table"}
            title={asTable ? "Show chart" : "Show as table"}
          >
            {asTable ? <BarChart3 className="size-4" /> : <Table2 className="size-4" />}
          </button>
        }
      />
      <div className="px-5 pb-4">
        {asTable ? (
          <table className="tabular w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                {table.columns.map((c, i) => (
                  <th key={c} className={`py-1.5 font-medium ${i > 0 ? "text-right" : ""}`}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r) => (
                <tr key={String(r[0])} className="border-b border-line last:border-0">
                  {r.map((v, i) => (
                    <td key={i} className={`py-1.5 ${i > 0 ? "text-right" : "text-ink-2"}`}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          children
        )}
      </div>
    </Card>
  );
}

function TooltipBox({ active, payload, label, unit = "applications" }: { active?: boolean; payload?: { value: number; payload: Record<string, unknown> }[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="font-medium text-ink">{(p.payload.tooltipLabel as string) ?? label}</div>
      <div className="tabular mt-0.5 text-ink-2">
        {p.value} {p.value === 1 ? unit.replace(/s$/, "") : unit}
      </div>
    </div>
  );
}

const axisTick = (c: ReturnType<typeof useChartColors>) => ({ fill: c.muted, fontSize: 11 });

/** Single-series column chart (one series: no legend, the title names it). */
export function ColumnChart({ data, height = 220 }: { data: { label: string; value: number; tooltipLabel?: string }[]; height?: number }) {
  const c = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 16, right: 4, bottom: 0, left: -24 }}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: c.axis }} tick={axisTick(c)} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={axisTick(c)} />
        <Tooltip cursor={{ fill: c.hover }} content={<TooltipBox />} />
        <Bar dataKey="value" fill={c.series[0]} radius={[4, 4, 0, 0]} maxBarSize={24} label={{ position: "top", fill: c.muted, fontSize: 11, formatter: (v: unknown) => (v ? String(v) : "") }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal single-series bars, value at the tip. */
export function HBarChart({ data, ordinal }: { data: { label: string; value: number; tooltipLabel?: string }[]; ordinal?: boolean }) {
  const c = useChartColors();
  const height = Math.max(120, data.length * 34 + 8);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }} barCategoryGap={8}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="label" width={128} tickLine={false} axisLine={{ stroke: c.axis }} tick={{ ...axisTick(c), fill: c.muted }} />
        <Tooltip cursor={{ fill: c.hover }} content={<TooltipBox />} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20} fill={c.series[0]} label={{ position: "right", fill: c.muted, fontSize: 11 }}>
          {ordinal && data.map((d, i) => <Cell key={d.label} fill={c.ordinal[Math.min(i, c.ordinal.length - 1)]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** One whole split into parts, with a legend (identity never by colour alone). */
export function SegmentedBar({ parts }: { parts: { label: string; value: number }[] }) {
  const c = useChartColors();
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div>
      <div className="flex h-6 w-full gap-[2px] overflow-hidden rounded" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}>
        {parts
          .map((p, i) => ({ ...p, i }))
          .filter((p) => p.value > 0)
          .map((p) => (
            <div
              key={p.label}
              className="relative h-full transition-opacity first:rounded-l last:rounded-r"
              style={{ width: `${(p.value / total) * 100}%`, background: c.series[p.i], opacity: hover === null || hover === p.i ? 1 : 0.35 }}
              onMouseEnter={() => setHover(p.i)}
              onMouseLeave={() => setHover(null)}
              title={`${p.label}: ${p.value} (${Math.round((p.value / total) * 100)}%)`}
            />
          ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        {parts.map((p, i) => (
          <li key={p.label} className="flex items-center gap-2" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: c.series[i] }} aria-hidden />
            <span className="truncate text-ink-2">{p.label}</span>
            <span className="tabular ml-auto font-medium text-ink">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Tiny single-series sparkline for stat tiles. */
export function Sparkline({ values }: { values: number[] }) {
  const c = useChartColors();
  const max = Math.max(1, ...values);
  const w = 80;
  const h = 24;
  const step = w / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => `${i * step},${h - (v / max) * (h - 4) - 2}`).join(" ");
  const last = values.length - 1;
  return (
    <svg width={w} height={h} className="overflow-visible" aria-hidden>
      <polyline points={pts} fill="none" stroke={c.muted} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.6} />
      <circle cx={last * step} cy={h - (values[last] / max) * (h - 4) - 2} r={3} fill={c.series[0]} stroke={c.surface} strokeWidth={2} />
    </svg>
  );
}
