import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(import.meta.dirname, "..", "tokens.css"), "utf8");

function block(selector: RegExp): Record<string, string> {
    const match = css.match(selector);
    if (!match?.[1]) throw new Error(`block not found: ${selector}`);
    const out: Record<string, string> = {};
    for (const m of match[1].matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim();
    return out;
}

const palette = block(/:root\s*\{([^}]*--pal-maroon[^}]*)\}/);
const modes = {
    light: block(/:root,\s*\[data-theme="light"\]\s*\{([^}]*)\}/),
    dark: block(/\[data-theme="dark"\]\s*\{([^}]*)\}/),
};

function resolve(mode: Record<string, string>, token: string): string {
    const raw = mode[token];
    if (!raw) throw new Error(`token missing: ${token}`);
    const ref = raw.match(/^var\(--([a-z0-9-]+)\)$/);
    const value = ref ? palette[ref[1]!] : raw;
    if (!value?.startsWith("#")) throw new Error(`not a colour: ${token} = ${raw}`);
    return value;
}

function luminance(hex: string): number {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi! + 0.05) / (lo! + 0.05);
}

const TEXT_PAIRS: [string, string][] = [
    ...["ground", "ground-deep", "surface"].flatMap((bg) => ["ink", "ink-soft", "accent-text", "link"].map((fg) => [fg, bg] as [string, string])),
    ["on-accent", "accent"],
    ["on-accent-hover", "accent-hover"],
    ["on-band", "band"],
    ["on-highlight", "highlight"],
    ["on-support", "support"],
    ["ink", "hover"],
];

const LINE_PAIRS: [string, string][] = [
    ["line", "ground"],
    ["line", "surface"],
    ["focus", "ground"],
    ["focus", "surface"],
];

describe.each(Object.entries(modes))("%s mode", (_name, mode) => {
    it.each(TEXT_PAIRS)("%s on %s reaches 4.5:1", (fg, bg) => {
        expect(contrast(resolve(mode, fg), resolve(mode, bg))).toBeGreaterThanOrEqual(4.5);
    });

    it.each(LINE_PAIRS)("%s on %s reaches 3:1", (fg, bg) => {
        expect(contrast(resolve(mode, fg), resolve(mode, bg))).toBeGreaterThanOrEqual(3);
    });
});
