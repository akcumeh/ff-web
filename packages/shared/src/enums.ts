import { z } from "zod";

/** The two cuts. Shown to people as "London style" and "Turkey style". */
export const SuitStyle = z.enum(["london", "turkey"]);
export type SuitStyle = z.infer<typeof SuitStyle>;

export const SuitStatus = z.enum(["draft", "review", "published", "archived"]);
export type SuitStatus = z.infer<typeof SuitStatus>;

/** Theme ids from the design system. Set on <html data-theme="...">. */
export const ThemeId = z.enum(["sunlit", "workshop"]);
export type ThemeId = z.infer<typeof ThemeId>;

export const styleLabel: Record<SuitStyle, string> = {
  london: "London style",
  turkey: "Turkey style",
};
