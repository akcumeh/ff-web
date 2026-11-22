"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/gallery", label: "Gallery" },
  { href: "/wholesale", label: "Wholesale" },
  { href: "/about", label: "About" },
];

export function NavLinks({ showTryon }: { showTryon: boolean }) {
  const path = usePathname();
  const links = showTryon ? [...LINKS.slice(0, 2), { href: "/changing-room", label: "Changing room" }, ...LINKS.slice(2)] : LINKS;
  return (
    <ul>
      {links.map((l) => {
        const current = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <li key={l.href}>
            <Link href={l.href} aria-current={current ? "page" : undefined}>{l.label}</Link>
          </li>
        );
      })}
    </ul>
  );
}
