import type { ReactNode } from "react";
import { SiteShell } from "@/components/site/SiteShell";

export default function LightLayout({ children }: { children: ReactNode }) {
  return <SiteShell theme="light">{children}</SiteShell>;
}
