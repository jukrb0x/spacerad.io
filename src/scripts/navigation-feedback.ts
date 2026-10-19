import type { TransitionBeforePreparationEvent } from "astro:transitions/client";

import { expandBrandTrack, resetBrandMotion } from "./navigation-motion";

type Mode = "brand" | "page";
let mode: Mode | undefined;
let revision = 0;
let activeSignal: AbortSignal | undefined;
let swappedRevision = -1;
let revealTimer: ReturnType<typeof setTimeout> | undefined;
let finishTimer: ReturnType<typeof setTimeout> | undefined;
let started = 0;

function paint(state?: string) {
    const brand = document.querySelector<HTMLElement>(".site-brand");
    const panel = document.querySelector<HTMLElement>("[data-navigation-feedback]");
    for (const element of [brand, panel]) element?.removeAttribute("data-loading");
    if (state && mode) (mode === "brand" ? brand : panel)?.setAttribute("data-loading", state);
    const status = document.querySelector("[data-navigation-status]");
    if (status) status.textContent = state === "active" ? (document.documentElement.dataset.uiLanguage === "zh" ? "加载中" : "Loading") : "";
}

function reset() {
    clearTimeout(revealTimer);
    clearTimeout(finishTimer);
    const brand = document.querySelector<HTMLElement>(".site-brand");
    if (brand?.hasAttribute("data-loading")) resetBrandMotion(brand);
    paint();
    mode = undefined;
}

function finish() {
    if (!mode || swappedRevision !== revision) return;
    clearTimeout(revealTimer);
    // Let a fast logo tap register without delaying the navigation itself.
    finishTimer = setTimeout(
        () => {
            const brand = document.querySelector<HTMLElement>(".site-brand");
            if (mode === "brand" && brand) expandBrandTrack(brand);
            finishTimer = setTimeout(
                () => {
                    paint("leaving");
                    finishTimer = setTimeout(() => paint("settled"), 340);
                },
                mode === "brand" ? 320 : 0,
            );
        },
        mode === "brand" ? Math.max(0, 240 - (performance.now() - started)) : 0,
    );
}

document.addEventListener("astro:before-preparation", (event) => {
    const navigation = event as TransitionBeforePreparationEvent;
    const current = ++revision;
    reset();
    activeSignal = navigation.signal;
    swappedRevision = -1;
    if (navigation.from.pathname === navigation.to.pathname && navigation.from.search === navigation.to.search && navigation.to.hash) return;
    mode = navigation.sourceElement?.closest(".site-brand") ? "brand" : "page";
    started = performance.now();
    if (mode === "brand") paint("active");
    else revealTimer = setTimeout(() => paint("active"), 180);
    navigation.signal.addEventListener(
        "abort",
        () => {
            if (current === revision) reset();
        },
        { once: true },
    );
    const loader = navigation.loader;
    navigation.loader = async () => {
        try {
            await loader();
            if (navigation.defaultPrevented && current === revision) reset();
        } catch (error) {
            if (current === revision) reset();
            throw error;
        }
    };
});
document.addEventListener("astro:before-swap", (event) => {
    const swap = event as import("astro:transitions/client").TransitionBeforeSwapEvent;
    if (swap.signal !== activeSignal || swap.signal.aborted) return;
    swappedRevision = revision;
    if (mode !== "brand") return;
    // Header DOM is replaced. Seed its replacement before the browser paints it.
    const next = swap.newDocument;
    next.querySelector(".site-brand")?.setAttribute("data-loading", "active");
});
// after-swap belongs to the DOM just installed; older page-load events can arrive late.
document.addEventListener("astro:after-swap", finish);
window.addEventListener("pageshow", (event) => {
    if (event.persisted) reset();
});
// Keep the completed wipe clear under a resting pointer; a fresh entry restores hover.
for (const type of ["pointerover", "pointerout", "focusin", "focusout"]) {
    document.addEventListener(type, (event) => {
        if (!(event.target instanceof Element)) return;
        const brand = event.target.closest<HTMLElement>('.site-brand[data-loading="settled"]');
        const related = (event as MouseEvent | FocusEvent).relatedTarget;
        if (brand && !(related instanceof Node && brand.contains(related))) resetBrandMotion(brand);
    });
}
