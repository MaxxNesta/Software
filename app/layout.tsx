import type { Metadata } from "next";
import "./globals.css";
import { getCompany } from "@/lib/queries";
import { NavLink } from "./nav";

export const metadata: Metadata = {
  title: "Myanmar ERP",
  description: "Inventory and accounting for Myanmar trading and distribution",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let company: Awaited<ReturnType<typeof getCompany>> = null;
  let dbError: string | null = null;

  try {
    company = await getCompany();
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  return (
    <html lang="en">
      <body>
        <div className="shell">
          <nav className="sidebar">
            <div className="brand">
              <span className="brand-name">{company?.name ?? "Myanmar ERP"}</span>
              <span className="brand-sub">{company?.base_currency ?? "—"} · FY 2026-27</span>
            </div>

            <div className="navgroup">
              <span className="navlabel">Overview</span>
              <NavLink href="/">Dashboard</NavLink>
              <NavLink href="/ledger">Trial balance</NavLink>
            </div>

            <div className="navgroup">
              <span className="navlabel">Transactions</span>
              <NavLink href="/documents">All documents</NavLink>
              <NavLink href="/receivables">Receivables</NavLink>
              <NavLink href="/payables">Payables</NavLink>
            </div>

            <div className="navgroup">
              <span className="navlabel">Master data</span>
              <NavLink href="/items">Items &amp; stock</NavLink>
              <NavLink href="/partners">Partners</NavLink>
            </div>
          </nav>

          <main className="main">
            <div className="inner">
              {dbError ? (
                <div className="card">
                  <div className="card-head"><h2>Database unavailable</h2></div>
                  <div className="card-body">
                    <p className="page-sub">
                      The app could not reach the database. Check that
                      <span className="m"> DATABASE_URL</span> is set and reachable
                      from this environment.
                    </p>
                    <p className="m" style={{ color: "var(--bad)", marginTop: "0.75rem" }}>{dbError}</p>
                  </div>
                </div>
              ) : (
                children
              )}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
