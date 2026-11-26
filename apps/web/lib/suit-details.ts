import type { SuitAnatomy } from "@ff/shared";

const LENGTH = {
    knee: "at the knee",
    "3/4": "mid-calf, between the knee and the ankle",
    full: "down to the ankle",
} as const;

const SLEEVE = {
    "3/4": "three-quarter, ending a little above the wrist",
    full: "long, down to the wrist",
} as const;

export function suitDetailLines(a: SuitAnatomy): string[] {
    const lines: string[] = [];
    if (a.type === "skirt-suit") lines.push("Skirt suit: a jacket and a separate skirt");
    if (a.type === "gown-suit") lines.push(a.has_no_jacket ? "Gown only, worn without a jacket" : "Gown suit: a jacket with a matching gown");
    if (a.type !== "gown-suit" && a.skirt_length) lines.push(`Skirt length: ${LENGTH[a.skirt_length]}`);
    if (a.type !== "skirt-suit" && a.gown_length) lines.push(`Gown length: ${LENGTH[a.gown_length]}`);
    if (a.sleeve_length) lines.push(`Sleeves: ${SLEEVE[a.sleeve_length]}`);
    if (a.has_camisole) lines.push("Comes with a matching camisole (3 pieces)");
    if (a.has_belt) lines.push("Comes with a matching belt");
    return lines;
}
