import { Albert_Sans, Alfa_Slab_One, Cormorant_Garamond, Tenor_Sans } from "next/font/google";

// Body font in both looks. Weights match body-lead (300), body-md/sm (400) and body-figure (500).
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

export const alfaSlab = Alfa_Slab_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--nf-alfa",
  display: "swap",
});

export const tenor = Tenor_Sans({
  subsets: ["latin"],
  weight: "400",
  variable: "--nf-tenor",
  display: "swap",
});

export const fontVariables = [albertSans, cormorant, alfaSlab, tenor].map((f) => f.variable).join(" ");
