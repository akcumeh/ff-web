import { Albert_Sans, Cormorant_Garamond, Tenor_Sans } from "next/font/google";

export const albertSans = Albert_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--nf-albert",
  display: "swap",
});

export const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--nf-cormorant",
  display: "swap",
});

export const tenor = Tenor_Sans({
  subsets: ["latin"],
  weight: "400",
  variable: "--nf-tenor",
  display: "swap",
});

export const fontVariables = [albertSans, cormorant, tenor].map((f) => f.variable).join(" ");
