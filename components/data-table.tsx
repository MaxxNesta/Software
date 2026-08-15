"use client";

import { Fragment, useMemo, useState } from "react";

export type Column = {
  key: string;
  label: string;
  sortable?: boolean;
  align?: "r";
};

/**
 * Search and sort for an already-fetched list, entirely client-side — these
 * pages are small master-data/document lists, not paged reports, so there's
 * nothing worth a server round trip for. Rows keep rendering exactly as each
 * page already writes them (renderRow gets the whole <tr>); this only owns
 * the toolbar, the header click targets, and the filter/sort of the array.
 */
export function DataTable<T>({
  rows,
  columns,
  renderRow,
  getSearchText,
  getSortValue,
  rowKey,
  searchPlaceholder = "Search…",
  defaultSort,
  emptyLabel = "Nothing here",
  footer,
}: {
  rows: T[];
  columns: Column[];
  renderRow: (row: T) => React.ReactNode;
  getSearchText: (row: T) => string;
  getSortValue?: (row: T, key: string) => string | number;
  rowKey: (row: T) => string;
  searchPlaceholder?: string;
  defaultSort?: { key: string; dir: "asc" | "desc" };
  emptyLabel?: string;
  /** Rendered as <tfoot>, on the unfiltered/unsorted totals — a search that hides rows shouldn't change a grand total. */
  footer?: React.ReactNode;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(defaultSort ?? null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? rows.filter((r) => getSearchText(r).toLowerCase().includes(needle)) : rows;
  }, [rows, q, getSearchText]);

  const sorted = useMemo(() => {
    if (!sort || !getSortValue) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = getSortValue(a, sort.key);
      const bv = getSortValue(b, sort.key);
      const cmp =
        typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sort, getSortValue]);

  function toggleSort(key: string) {
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: "asc" };
      if (s.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  return (
    <>
      <div style={{ marginBottom: "0.75rem" }}>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label="Search"
          style={{ maxWidth: 320 }}
        />
      </div>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={c.align === "r" ? "r" : undefined}>
                  {c.sortable && getSortValue ? (
                    <button type="button" className="sortbtn" onClick={() => toggleSort(c.key)}>
                      {c.label}
                      {sort?.key === c.key ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <Fragment key={rowKey(r)}>{renderRow(r)}</Fragment>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="empty">
                  {q ? "No matches" : emptyLabel}
                </td>
              </tr>
            )}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>
    </>
  );
}
