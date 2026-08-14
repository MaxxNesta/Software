"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export function NavLink({
  href,
  exact,
  children,
}: {
  href: string;
  exact?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active =
    href === "/" || exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link href={href} className="navlink" data-active={active}>
      {children}
    </Link>
  );
}

/**
 * A collapsible group. Opens itself when the current page is inside it, so
 * you always see where you are without every section being expanded at once.
 */
export function NavGroup({
  label,
  match,
  children,
  defaultOpen,
}: {
  label: string;
  /** Path prefixes that belong to this group. */
  match: string[];
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const pathname = usePathname();
  const contains = match.some((m) => (m === "/" ? pathname === "/" : pathname.startsWith(m)));
  const [open, setOpen] = useState<boolean | null>(null);

  const isOpen = open ?? (contains || Boolean(defaultOpen));

  return (
    <div className="navgroup">
      <button
        type="button"
        className="navhead"
        onClick={() => setOpen(!isOpen)}
        aria-expanded={isOpen}
        data-inside={contains}
      >
        <span>{label}</span>
        <span className="navcaret" data-open={isOpen}>›</span>
      </button>
      {isOpen && <div className="navitems">{children}</div>}
    </div>
  );
}
