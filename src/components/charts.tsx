"use client";

import { useId, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatINR } from "@/lib/format";
import { AXIS, ORDINAL, SERIES, SINGLE_SERIES } from "@/lib/viz";

/* --------------------------------------------------------------------------
 * Chart primitives for the Audit design system.
 *
 * Shared decisions, made once here rather than per chart:
 *  - Two-pixel lines, eight-pixel hover markers, four-pixel rounded data ends
 *    on bars, anchored to the baseline.
 *  - Grid and axes are recessive: one hairline, no vertical rules, no axis
 *    lines, no tick marks.
 *  - Every chart has a hover layer. An HTML chart that cannot be interrogated
 *    is a picture of data.
 *  - Every chart can show its own numbers as a table. That is an accessibility
 *    requirement in its own right, and it is also the relief the palette
 *    validator requires for the third series colour.
 *  - No chart here has two y-axes. Two measures on different scales get two
 *    charts.
 *
 * Number formatting is passed as a NAME rather than a function. These are
 * client components rendered from server components, and a function cannot
 * cross that boundary — React has to serialise the props, and a closure has no
 * serialisation. Naming the format keeps the call sites declarative and the
 * boundary intact.
 * ----------------------------------------------------------------------- */

export type ValueFormat = "count" | "inr" | "percent";

function formatter(format: ValueFormat): (v: number) => string {
  switch (format) {
    case "inr":
      return (v) => formatINR(v);
    case "percent":
      return (v) => `${Math.round(v)}%`;
    default:
      return (v) => v.toLocaleString("en-IN");
  }
}

const tickStyle = { fill: AXIS.tick, fontSize: 11 };

function TooltipBox({
  label,
  rows,
}: {
  label: string;
  rows: { name: string; value: string; colour?: string }[];
}) {
  return (
    <div className="rounded border border-line bg-white px-2.5 py-1.5 shadow-card">
      <div className="text-2xs font-medium text-ink">{label}</div>
      <ul className="mt-1 space-y-0.5">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-1.5 text-2xs">
            {r.colour ? (
              <span
                aria-hidden
                className="inline-block h-2 w-2 shrink-0 rounded-[1px]"
                style={{ background: r.colour }}
              />
            ) : null}
            <span className="text-slate">{r.name}</span>
            <span className="tnum ml-auto pl-3 font-medium text-ink">
              {r.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Toggle between the plot and the same figures as a table. */
function ChartFrame({
  children,
  table,
  height,
}: {
  children: React.ReactNode;
  table: React.ReactNode;
  height: number;
}) {
  const [showTable, setShowTable] = useState(false);
  const id = useId();

  return (
    <div>
      <div className="flex justify-end px-4 pt-2">
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          aria-expanded={showTable}
          aria-controls={id}
          className="rounded border border-line px-2 py-0.5 text-2xs font-medium text-slate hover:bg-paper hover:text-ink"
        >
          {showTable ? "Show chart" : "Show figures"}
        </button>
      </div>
      <div id={id}>
        {showTable ? (
          <div className="overflow-x-auto px-4 pb-3">{table}</div>
        ) : (
          <div className="px-2 pb-3" style={{ height }}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-2xs uppercase tracking-wide text-slate">
          {columns.map((c, i) => (
            <th
              key={c}
              scope="col"
              className={
                i === 0
                  ? "px-2 py-1.5 text-left font-medium"
                  : "px-2 py-1.5 text-right font-medium"
              }
            >
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-line/60 last:border-0">
            {r.map((cell, j) => (
              <td
                key={j}
                className={
                  j === 0
                    ? "px-2 py-1 text-ink"
                    : "tnum px-2 py-1 text-right text-slate"
                }
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* --------------------------------------------------------------------------
 * Multi-series trend. Up to three series — the palette's validated cap.
 * ----------------------------------------------------------------------- */

export type TrendPoint = { label: string } & Record<string, string | number>;

export function TrendLines({
  data,
  series,
  height = 240,
  format = "count",
}: {
  data: TrendPoint[];
  series: { key: string; name: string }[];
  height?: number;
  format?: ValueFormat;
}) {
  const shown = series.slice(0, SERIES.length);
  const formatValue = formatter(format);

  return (
    <div>
      {/* Identity is never colour alone: the legend is always present, and with
          three or fewer series each is also named in the tooltip. */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 px-4 pt-2">
        {shown.map((s, i) => (
          <li key={s.key} className="flex items-center gap-1.5 text-2xs text-slate">
            <span
              aria-hidden
              className="inline-block h-0.5 w-4 rounded-full"
              style={{ background: SERIES[i] }}
            />
            {s.name}
          </li>
        ))}
      </ul>

      <ChartFrame
        height={height}
        table={
          <DataTable
            columns={["Month", ...shown.map((s) => s.name)]}
            rows={data.map((d) => [
              d.label,
              ...shown.map((s) => formatValue(Number(d[s.key] ?? 0))),
            ])}
          />
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid
              stroke={AXIS.grid}
              strokeDasharray="0"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={tickStyle}
              tickLine={false}
              axisLine={{ stroke: AXIS.line }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              tick={tickStyle}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(v) => formatValue(Number(v))}
            />
            <Tooltip
              cursor={{ stroke: AXIS.tick, strokeWidth: 1, strokeDasharray: "3 3" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox
                    label={String(label)}
                    rows={payload.map((p) => ({
                      name: String(p.name),
                      value: formatValue(Number(p.value)),
                      colour: p.color,
                    }))}
                  />
                ) : null
              }
            />
            {shown.map((s, i) => (
              <Line
                key={s.key}
                // Linear, not monotone. A spline through sparse integer counts
                // draws smooth waves between 0, 1 and 2 — shape the data does
                // not have. A district with three works in a month should look
                // like three works in a month.
                type="linear"
                dataKey={s.key}
                name={s.name}
                stroke={SERIES[i]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "#FFFFFF" }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Ranked comparison. One measure across nominal categories, so one hue for
 * every bar — colouring each bar by its own value would spend the identity
 * channel re-encoding what bar length already shows.
 * ----------------------------------------------------------------------- */

export function RankedBars({
  data,
  valueName,
  height = 260,
  format = "count",
}: {
  data: { label: string; value: number; hint?: string }[];
  valueName: string;
  height?: number;
  format?: ValueFormat;
}) {
  const formatValue = formatter(format);
  return (
    <ChartFrame
      height={height}
      table={
        <DataTable
          columns={["", valueName]}
          rows={data.map((d) => [d.label, formatValue(d.value)])}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 48, bottom: 4, left: 4 }}
          barCategoryGap={4}
        >
          <CartesianGrid stroke={AXIS.grid} horizontal={false} />
          <XAxis
            type="number"
            tick={tickStyle}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatValue(Number(v))}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={tickStyle}
            tickLine={false}
            axisLine={{ stroke: AXIS.line }}
            width={170}
            // Label every bar. Left to itself Recharts drops labels it thinks
            // would collide, which leaves a ranked chart where half the rows
            // are anonymous — worse than a slightly crowded axis.
            interval={0}
          />
          <Tooltip
            cursor={{ fill: "rgba(11,18,32,0.04)" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipBox
                  label={String(payload[0].payload.label)}
                  rows={[
                    {
                      name: valueName,
                      value: formatValue(Number(payload[0].value)),
                      colour: SINGLE_SERIES,
                    },
                    ...(payload[0].payload.hint
                      ? [{ name: "", value: String(payload[0].payload.hint) }]
                      : []),
                  ]}
                />
              ) : null
            }
          />
          <Bar
            dataKey="value"
            name={valueName}
            fill={SINGLE_SERIES}
            radius={[0, 4, 4, 0]}
            maxBarSize={18}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* --------------------------------------------------------------------------
 * An ordered progression — entitlement down to money actually released. The
 * order carries meaning, so the colour ramps with it.
 * ----------------------------------------------------------------------- */

export function FundFlowBars({
  data,
  height = 200,
  format = "inr",
}: {
  data: { label: string; value: number }[];
  height?: number;
  format?: ValueFormat;
}) {
  const formatValue = formatter(format);
  return (
    <ChartFrame
      height={height}
      table={
        <DataTable
          columns={["Stage", "Amount"]}
          rows={data.map((d) => [d.label, formatValue(d.value)])}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 12, bottom: 4, left: 4 }}
          barCategoryGap={6}
        >
          <CartesianGrid stroke={AXIS.grid} horizontal={false} />
          <XAxis
            type="number"
            tick={tickStyle}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatValue(Number(v))}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={tickStyle}
            tickLine={false}
            axisLine={{ stroke: AXIS.line }}
            width={150}
          />
          <Tooltip
            cursor={{ fill: "rgba(11,18,32,0.04)" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipBox
                  label={String(payload[0].payload.label)}
                  rows={[
                    {
                      name: "Amount",
                      value: formatValue(Number(payload[0].value)),
                    },
                  ]}
                />
              ) : null
            }
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={26}>
            {data.map((d, i) => (
              <Cell key={d.label} fill={ORDINAL[Math.min(i, ORDINAL.length - 1)]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
