"use client";

import { CONSENT_VERSION, ENQUIRY_ALPHABET } from "@ff/shared";

type Source = "direct" | "wa" | "tg" | "search" | "other";
type Event =
    | { type: "suit_view"; suit_slug: string }
    | { type: "enquire_click"; suit_slug: string; code: string }
    | { type: "delivery_click"; order_ref: string }
    | { type: "join_channel_click"; suit_slug?: string };

const API = "/ffapi";
const YEAR = 60 * 60 * 24 * 365;

let source: Source | null = null;
let fingerprint: Promise<string | undefined> | null = null;

function cookie(name: string): string | undefined {
    return document.cookie
        .split("; ")
        .find((c) => c.startsWith(`${name}=`))
        ?.slice(name.length + 1);
}

function setCookie(name: string, value: string, maxAge: number) {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${name}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

export function signalsDecline(): boolean {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    return nav.doNotTrack === "1" || nav.globalPrivacyControl === true;
}

export type ConsentState = "accepted" | "declined" | "unset";

export function consent(): ConsentState {
    if (signalsDecline()) return "declined";
    const v = cookie("ff_consent");
    if (v === `${CONSENT_VERSION}:accepted`) return "accepted";
    if (v === `${CONSENT_VERSION}:declined`) return "declined";
    return "unset";
}

function readSource(): Source {
    if (source) return source;
    const src = new URLSearchParams(location.search).get("src");
    if (src === "wa" || src === "tg") source = src;
    else if (!document.referrer) source = "direct";
    else if (/google\.|bing\.|duckduckgo\.|yahoo\./i.test(document.referrer)) source = "search";
    else source = "other";
    return source;
}

function visitorCookie(): string {
    let id = cookie("ff_vid");
    if (!id || !/^[a-f0-9]{32}$/.test(id)) {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        id = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
        setCookie("ff_vid", id, YEAR);
    }
    return id;
}

function loadFingerprint(): Promise<string | undefined> {
    fingerprint ??= new Promise((resolve) => {
        const start = () =>
            import("@fingerprintjs/fingerprintjs")
                .then((m) => m.load())
                .then((agent) => agent.get())
                .then((r) => resolve(r.visitorId))
                .catch(() => resolve(undefined));
        if ("requestIdleCallback" in window) window.requestIdleCallback(start, { timeout: 2000 });
        else setTimeout(start, 1000);
    });
    return fingerprint;
}

export function visitorCookieIfAccepted(): string | undefined {
    return consent() === "accepted" ? visitorCookie() : undefined;
}

export async function track(event: Event): Promise<void> {
    try {
        if (cookie("ff_internal") === "1") return;
        const body: Record<string, unknown> = { ...event, source: readSource() };
        if (consent() === "accepted") {
            const fp = await Promise.race([loadFingerprint(), new Promise<undefined>((r) => setTimeout(() => r(undefined), 1500))]);
            body.visitor = { cookie: visitorCookie(), ...(fp ? { fp } : {}), consent_version: CONSENT_VERSION };
        }
        const blob = new Blob([JSON.stringify(body)], { type: "text/plain" });
        if (!navigator.sendBeacon?.(`${API}/events`, blob)) {
            void fetch(`${API}/events`, { method: "POST", body: blob, keepalive: true, mode: "cors" }).catch(() => {});
        }
    } catch {
        // Analytics never breaks the page.
    }
}

export function chooseConsent(choice: "accepted" | "declined") {
    const before = consent();
    setCookie("ff_consent", `${CONSENT_VERSION}:${choice}`, YEAR);
    if (choice === "accepted") {
        visitorCookie();
        void loadFingerprint();
    } else if (before === "accepted") {
        const id = cookie("ff_vid");
        setCookie("ff_vid", "", 0);
        if (id) void fetch(`${API}/visitors/forget`, { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify({ cookie: id }), keepalive: true }).catch(() => {});
    }
}

export function enquiryCode(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    return [...bytes].map((b) => ENQUIRY_ALPHABET[b % ENQUIRY_ALPHABET.length]).join("");
}
