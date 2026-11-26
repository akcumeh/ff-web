"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
    { href: "/", label: "Home" },
    { href: "/gallery", label: "Our suits" },
    { href: "/wholesale", label: "Buy in bulk" },
    { href: "/about", label: "About us" },
];

export function NavLinks({ showTryon }: { showTryon: boolean }) {
    const path = usePathname();
    const links = showTryon ? [...LINKS.slice(0, 2), { href: "/changing-room", label: "Try a suit on" }, ...LINKS.slice(2)] : LINKS;
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
