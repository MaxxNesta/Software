"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
