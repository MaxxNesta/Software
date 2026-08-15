import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { getCompany } from "@/lib/queries";
import { NavLink, NavGroup } from "./nav";
import { Toast } from "@/components/toast";
import {
  LayoutDashboard, ShoppingCart, Package, Wallet, BookOpen, Boxes, Database, Settings as SettingsIcon,
} from "lucide-react";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

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
    <html lang="en" className={inter.variable}>
      <body>
        <div className="shell">
          <nav className="sidebar">
            <div className="brand">
              <span className="brand-name">{company?.name ?? "Myanmar ERP"}</span>
              <span className="brand-sub">{company?.base_currency ?? "not set up"}</span>
            </div>

            <NavGroup label="Overview" icon={<LayoutDashboard size={14} />} match={["/"]}>
              <NavLink href="/">Dashboard</NavLink>
              <NavLink href="/documents">All documents</NavLink>
            </NavGroup>

            <NavGroup label="Sales" icon={<ShoppingCart size={14} />} match={["/sales", "/receivables"]}>
              <NavLink href="/sales/orders/new">New sales order</NavLink>
              <NavLink href="/sales/new">New sales invoice</NavLink>
              <NavLink href="/sales/deliver">Deliveries</NavLink>
              <NavLink href="/sales/returns/new">Customer return</NavLink>
              <NavLink href="/receivables/receive">Receive payment</NavLink>
              <NavLink href="/receivables" exact>Receivables</NavLink>
            </NavGroup>

            <NavGroup label="Purchases" icon={<Package size={14} />} match={["/purchases", "/payables"]}>
              <NavLink href="/purchases/orders/new">New purchase order</NavLink>
              <NavLink href="/purchases/new">New purchase invoice</NavLink>
              <NavLink href="/purchases/receive">Goods receipts</NavLink>
              <NavLink href="/purchases/returns/new">Supplier return</NavLink>
              <NavLink href="/payables/pay">Pay supplier</NavLink>
              <NavLink href="/payables" exact>Payables</NavLink>
            </NavGroup>

            <NavGroup label="Cash &amp; Bank" icon={<Wallet size={14} />} match={[
              "/finance/cash-detail", "/finance/bank-detail",
              "/finance/cash-receipt", "/finance/cash-payment",
              "/finance/bank-receipt", "/finance/bank-payment",
              "/finance/transfer",
            ]}>
              <NavLink href="/finance/cash-detail">Cash book</NavLink>
              <NavLink href="/finance/bank-detail">Bank book</NavLink>
              <NavLink href="/finance/cash-receipt">Cash receipt</NavLink>
              <NavLink href="/finance/cash-payment">Cash payment</NavLink>
              <NavLink href="/finance/bank-receipt">Bank receipt</NavLink>
              <NavLink href="/finance/bank-payment">Bank payment</NavLink>
              <NavLink href="/finance/transfer">Interbranch transfer</NavLink>
            </NavGroup>

            <NavGroup label="Accounting" icon={<BookOpen size={14} />} match={[
              "/finance/journal", "/finance/opening", "/finance/general-ledger", "/ledger",
              "/finance/income-statement", "/finance/balance-sheet", "/finance/cash-flow",
            ]}>
              <NavLink href="/finance/journal">Journal entries</NavLink>
              <NavLink href="/finance/opening">Opening balances</NavLink>
              <NavLink href="/finance/general-ledger">General ledger</NavLink>
              <NavLink href="/ledger">Trial balance</NavLink>
              <NavLink href="/finance/income-statement">Income statement</NavLink>
              <NavLink href="/finance/balance-sheet">Balance sheet</NavLink>
              <NavLink href="/finance/cash-flow">Cash flow</NavLink>
            </NavGroup>

            <NavGroup label="Inventory" icon={<Boxes size={14} />} match={["/items/stock", "/inventory", "/warehouses"]}>
              <NavLink href="/items/stock">Stock overview</NavLink>
              <NavLink href="/inventory/movements">Stock movements</NavLink>
              <NavLink href="/inventory/adjustments">Adjustments</NavLink>
              <NavLink href="/warehouses">Warehouses</NavLink>
            </NavGroup>

            <NavGroup label="Master data" icon={<Database size={14} />} match={["/items/categories", "/items/subcategories", "/items", "/partners", "/salespersons"]}>
              <NavLink href="/items/categories">Categories</NavLink>
              <NavLink href="/items/subcategories">Sub category</NavLink>
              <NavLink href="/items" exact>Items</NavLink>
              <NavLink href="/partners">Partners</NavLink>
              <NavLink href="/salespersons">Salespersons</NavLink>
            </NavGroup>

            <NavGroup label="Settings" icon={<SettingsIcon size={14} />} match={["/settings"]}>
              <NavLink href="/settings/accounts">Chart of accounts</NavLink>
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
        <Toast />
      </body>
    </html>
  );
}
