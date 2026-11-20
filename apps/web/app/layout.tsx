import type { Metadata } from "next";
import type { ReactNode } from "react";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Frankie Fabrics",
  description: "Ladies' London and Turkey suits. Wholesale and retail from Martins Street, Lagos Island. Since 2012.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // Theme is fixed to sunlit for now. Step 2 adds the visitor's saved choice.
  return (
    <html lang="en-NG" data-theme="sunlit" className={fontVariables}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
