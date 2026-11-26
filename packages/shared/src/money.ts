import { z } from "zod";

/** Money is always whole kobo. 100 kobo = 1 naira. */
export const Kobo = z.number().int().nonnegative();
export type Kobo = z.infer<typeof Kobo>;

const nairaFormat = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
});

/** 2500000 kobo -> "₦25,000" */
export function formatNaira(kobo: Kobo): string {
    return nairaFormat.format(kobo / 100);
}
