import type { ReactNode } from "react";
import { SiteShell } from "@/components/site/SiteShell";

export default function DarkLayout({ children }: { children: ReactNode }) {
    return <SiteShell theme="dark">{children}</SiteShell>;
}
