"use client";

import { Fragment, useMemo, useState } from "react";

export type Column = {
  key: string;
  label: string;
  sortable?: boolean;
  align?: "r";
};

export type DataRow = {
  key: string;
  /** Combined lowercase-searchable text for this row. */
  searchText: string;
  /** Sort value per sortable column key. */
  sort?: Record<string, string | number>;
  /** The row already rendered as a <tr> — a Server Component page renders
   *  its own markup exactly as before; this component never touches it. */
  node: React.ReactNode;
};

/**
 * Search and sort for an already-fetched list, entirely client-side — these
 * pages are small master-data/document lists, not paged reports, so there's
 * nothing worth a server round trip for.
 *
 * Rows arrive pre-rendered (DataRow.node) with plain searchText/sort data
 * alongside, rather than as callbacks — a Server Component page can hand a
 * Client Component already-rendered JSX and plain data, but not a function;
 * React has no way to serialize a closure across that boundary (only a
 * "use server" action gets special handling), so renderRow/getSearchText/
 * getSortValue callbacks would crash in production even though they type-
 * check fine locally with no DATABASE_URL to actually exercise the render.
 */
export function DataTable({
  rows,
  columns,
  searchPlaceholder = "Search…",
  defaultSort,
  emptyLabel = "Nothing here",
  footer,
}: {
  rows: DataRow[];
  columns: Column[];
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
    return needle ? rows.filter((r) => r.searchText.toLowerCase().includes(needle)) : rows;
  }, [rows, q]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a.sort?.[sort.key] ?? "";
      const bv = b.sort?.[sort.key] ?? "";
      const cmp =
        typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sort]);

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
                  {c.sortable ? (
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
              <Fragment key={r.key}>{r.node}</Fragment>
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
