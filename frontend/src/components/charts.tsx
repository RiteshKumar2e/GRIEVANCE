/** Chart primitives. Palette: validated reference categorical slots (blue, orange) and the
 *  fixed status palette. Thin marks, recessive grid, hover tooltips, legends for >= 2 series. */
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a"];
const GRID = "#eceef2";
const AXIS = { stroke: "#d6d9df", tickLine: false, axisLine: false } as const;

const tooltipStyle = { borderRadius: 8, border: "1px solid #e3e5ea", fontSize: 12, boxShadow: "0 4px 12px rgba(16,24,40,.08)", whiteSpace: "normal" as const };
// Keeps a tooltip near the right edge of a phone screen from widening the page.
const tooltipWrapper = { maxWidth: "min(260px, calc(100vw - 32px))" };

/** The chart itself is an image to assistive technology; this table carries the same numbers. */
function ChartData({ caption, columns, rows }: { caption: string; columns: string[]; rows: (string | number)[][] }) {
  return (
    // The wrapper is hidden, not the table: a table will not shrink below its content width, so an
    // `sr-only` table widens the page on phones (measured +46px on /admin at 375px).
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead><tr>{columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((v, j) => (j === 0 ? <th key={j} scope="row">{v}</th> : <td key={j}>{v}</td>))}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function TrendChart({ data, series }: { data: Record<string, string | number>[]; series: { key: string; label: string }[] }) {
  const week = (v: string | number) => `Week of ${new Date(String(v)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;
  return (
    <>
    <div className="h-64 overflow-hidden" role="img" aria-label={`Line chart of ${series.map((s) => s.label).join(" and ")} over time`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="period" {...AXIS} tickFormatter={(v: string) => new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} minTickGap={24} />
          <YAxis {...AXIS} allowDecimals={false} width={40} />
          <Tooltip contentStyle={tooltipStyle} wrapperStyle={tooltipWrapper} labelFormatter={(v: string) => `Week of ${new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`} />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
          {series.map((s, i) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={SERIES[i]} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
    <ChartData caption={series.map((x) => x.label).join(" and ") + " by week"} columns={["Week", ...series.map((x) => x.label)]}
      rows={data.map((d) => [week(d.period), ...series.map((x) => d[x.key] ?? 0)])} />
    </>
  );
}

export function HBarChart({ data, valueKey, labelKey, name, color = SERIES[0], height }: { data: Record<string, string | number>[]; valueKey: string; labelKey: string; name: string; color?: string; height?: number }) {
  return (
    <>
    <div className="overflow-hidden" style={{ height: height ?? Math.max(160, data.length * 30 + 30) }} role="img" aria-label={`Bar chart of ${name}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }} barCategoryGap={6}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" {...AXIS} allowDecimals={false} />
          <YAxis type="category" dataKey={labelKey} {...AXIS} width={150} tick={{ fontSize: 11, fill: "#3d424d" }} />
          <Tooltip contentStyle={tooltipStyle} wrapperStyle={tooltipWrapper} cursor={{ fill: "rgba(42,120,214,0.06)" }} />
          <Bar dataKey={valueKey} name={name} fill={color} radius={[0, 4, 4, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
    <ChartData caption={name} columns={["Item", name]} rows={data.map((d) => [d[labelKey], d[valueKey]])} />
    </>
  );
}
