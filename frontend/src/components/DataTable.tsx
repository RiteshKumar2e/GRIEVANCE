import clsx from "clsx";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { EmptyState, ErrorState, SkeletonRows } from "./ui";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Enables header sorting on this column. */
  sortValue?: (row: T) => string | number | null | undefined;
  className?: string;
  align?: "left" | "right";
}

type Dir = "asc" | "desc";

/**
 * Responsive data table: a sortable, paginated table on wide screens and a stacked card list on phones.
 * Sorting and paging are client-side over rows the API has already scoped to the user's permissions.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  mobileCard,
  loading,
  error,
  onRetry,
  empty,
  pageSize = 15,
  initialSort,
  caption,
  minWidth = 860,
  paginate = true,
}: {
  rows: T[] | undefined;
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  mobileCard: (row: T) => ReactNode;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty: { title: string; body?: string; action?: ReactNode };
  pageSize?: number;
  initialSort?: { key: string; dir: Dir };
  caption: string;
  minWidth?: number;
  /** false when the API already pages the rows (the caller renders its own Pagination). */
  paginate?: boolean;
}) {
  const [sort, setSort] = useState<{ key: string; dir: Dir } | undefined>(initialSort);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!rows) return [];
    const col = columns.find((c) => c.key === sort?.key);
    if (!col?.sortValue || !sort) return rows;
    const val = col.sortValue;
    return [...rows].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      const r = x < y ? -1 : 1;
      return sort.dir === "asc" ? r : -r;
    });
  }, [rows, columns, sort]);

  const size = paginate ? pageSize : Math.max(1, sorted.length);
  const pages = Math.max(1, Math.ceil(sorted.length / size));
  // Back to page 1 when the result set or ordering changes (not on background refetches of the same data).
  useEffect(() => setPage(0), [rows?.length, sort?.key, sort?.dir]);
  const current = Math.min(page, pages - 1);
  const visible = sorted.slice(current * size, current * size + size);

  if (loading) return <SkeletonRows rows={6} />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (!rows?.length) return <EmptyState {...empty} />;

  const toggle = (key: string) => setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  return (
    <div>
      {/* Desktop / tablet */}
      <div className="hidden overflow-x-auto rounded-lg border border-line bg-surface md:block">
        <table className="w-full text-sm" style={{ minWidth }}>
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b border-line bg-canvas/60 text-left text-[12px] uppercase tracking-[0.05em] text-ink-muted">
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}
                    className={clsx("px-4 py-2.5 font-semibold", c.align === "right" && "text-right", c.className)}
                  >
                    {c.sortValue ? (
                      <button
                        onClick={() => toggle(c.key)}
                        className="inline-flex items-center gap-1 rounded-sm uppercase hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                      >
                        {c.header}
                        <span aria-hidden className={clsx("text-[10px]", active ? "text-ink" : "text-ink-muted/60")}>
                          {active ? (sort!.dir === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                        <span className="sr-only">{active ? `, sorted ${sort!.dir === "asc" ? "ascending" : "descending"}` : ", sortable"}</span>
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((r) => (
              <tr key={rowKey(r)} className="align-top hover:bg-canvas/70">
                {columns.map((c) => (
                  <td key={c.key} className={clsx("px-4 py-3", c.align === "right" && "text-right", c.className)}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone */}
      <ul className="space-y-2 md:hidden" aria-label={caption}>
        {visible.map((r) => (
          <li key={rowKey(r)} className="rounded-lg border border-line bg-surface p-4">
            {mobileCard(r)}
          </li>
        ))}
      </ul>

      {paginate && <Pagination page={current} pages={pages} total={sorted.length} pageSize={pageSize} onPage={setPage} />}
    </div>
  );
}

export function Pagination({ page, pages, total, pageSize, onPage }: { page: number; pages: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const from = total ? page * pageSize + 1 : 0;
  const to = Math.min(total, (page + 1) * pageSize);
  const btn =
    "inline-flex h-9 items-center rounded-md border border-line bg-surface px-3 text-[13px] font-medium text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500";
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink-muted">
      <p aria-live="polite">
        Showing {from}–{to} of {total}
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <button className={btn} onClick={() => onPage(page - 1)} disabled={page === 0}>
            Previous
          </button>
          <span className="tabular-nums">
            Page {page + 1} of {pages}
          </span>
          <button className={btn} onClick={() => onPage(page + 1)} disabled={page >= pages - 1}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
