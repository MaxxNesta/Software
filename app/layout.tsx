import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { getCompany } from "@/lib/queries";
import { NavLink, NavGroup } from "./nav";

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
              <span className="brand-sub">{company?.base_currency ?? "not set up"}</span>
            </div>

            <NavGroup label="Overview" match={["/", "/ledger"]}>
              <NavLink href="/">Dashboard</NavLink>
              <NavLink href="/ledger">Trial balance</NavLink>
              <NavLink href="/documents">All documents</NavLink>
            </NavGroup>

            <NavGroup label="Sales" match={["/sales", "/receivables"]}>
              <NavLink href="/sales/new">New sales invoice</NavLink>
              <NavLink href="/receivables/receive">Receive payment</NavLink>
              <NavLink href="/receivables" exact>Receivables</NavLink>
            </NavGroup>

            <NavGroup label="Purchases" match={["/purchases", "/payables"]}>
              <NavLink href="/purchases/new">New purchase invoice</NavLink>
              <NavLink href="/payables/pay">Pay supplier</NavLink>
              <NavLink href="/payables" exact>Payables</NavLink>
            </NavGroup>

            <NavGroup label="Cash &amp; Bank" match={["/finance"]}>
              <NavLink href="/finance/cash-book">Cash book</NavLink>
              <NavLink href="/finance/bank">Bank</NavLink>
              <NavLink href="/finance/journal">Journal</NavLink>
              <NavLink href="/finance/transfer">Interbranch transfer</NavLink>
              <NavLink href="/finance/opening">Account opening</NavLink>
              <NavLink href="/finance/cash-detail">Cash detail</NavLink>
              <NavLink href="/finance/bank-detail">Bank detail</NavLink>
            </NavGroup>

            <NavGroup label="Master data" match={["/items", "/partners"]}>
              <NavLink href="/items/categories">Categories</NavLink>
              <NavLink href="/items" exact>Items &amp; stock</NavLink>
              <NavLink href="/partners">Partners</NavLink>
            </NavGroup>

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
              ) : !company ? (
                <div className="card">
                  <div className="card-head"><h2>Nothing set up yet</h2></div>
                  <div className="card-body">
                    <p className="page-sub">
                      This database is empty. Creating a company builds the chart of
                      accounts, the financial calendar and the posting rules &mdash;
                      everything the ledger needs before anything can be recorded.
                    </p>
                    <div className="actions" style={{ marginTop: "1rem" }}>
                      <Link href="/setup" className="btn">Set up your company</Link>
                    </div>
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
