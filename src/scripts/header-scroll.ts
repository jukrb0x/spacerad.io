// Float only navigation; the Home profile stays in its original document flow.
let header: HTMLElement | null = null;
let navigation: HTMLElement | null = null;
let profile: HTMLElement | null = null;
let footer: HTMLElement | null = null;
let profileLink: HTMLElement | null = null;
let profileLinkTop = 0;
let progressBar: HTMLElement | null = null;
let frame: number | undefined;
let directionAnchor = 0;
let headerTop = 0;
let navigationHeight = 0;
let profileHeight = 0;
let floating = false;
let hidden = false;
let pointerInput = false;
let navigationPaintOffset = "";
let profilePaintOffset = "";
let canvasStrength = "";
let footerEdgeStrength = "";
let footerEdgeCutoff = 24;
let washStops: [number, number][] = [];
const REVEAL_DISTANCE = 32;
const HIDE_DISTANCE = 24;
const MIN_SCROLL_DISTANCE_VH = 1.5;
// Matches the static page wash in editorial.css.
const PAGE_WASH_HEIGHT = 170;

function updateCanvasPaint(scrollY: number) {
    let strength = 0;
    for (let index = 1; index < washStops.length; index++) {
        const [end, endLevel] = washStops[index];
        if (scrollY > end) continue;
        const [start, startLevel] = washStops[index - 1];
        strength = startLevel + ((scrollY - start) / (end - start)) * (endLevel - startLevel);
        break;
    }
    const value = String(strength);
    if (value !== canvasStrength) {
        document.documentElement.style.setProperty("--browser-canvas-strength", value);
        canvasStrength = value;
    }
}

function updateFooterPaint(scrollY: number) {
    const root = document.documentElement;
    if (!footer || window.innerWidth >= 768) {
        if (footerEdgeStrength !== "0") {
            root.style.setProperty("--footer-edge-strength", "0");
            footerEdgeStrength = "0";
        }
        return;
    }
    const remaining = Math.max(0, document.documentElement.scrollHeight - window.innerHeight - scrollY);
    const strength = Math.max(0, Math.min(1, 1 - remaining / footerEdgeCutoff));
    const value = String(strength);
    if (value !== footerEdgeStrength) {
        root.style.setProperty("--footer-edge-strength", value);
        footerEdgeStrength = value;
    }
}

function updateBackgroundPaint(scrollY: number, profileInset: number) {
    if (!header || !navigation || !floating) return;
    const beyondWash = scrollY >= PAGE_WASH_HEIGHT;
    const navigationTop = beyondWash ? 0 : navigation.getBoundingClientRect().bottom - navigationHeight;
    const profileTop = profile && !beyondWash ? profile.getBoundingClientRect().top + profileInset : 0;
    const navOffset = `${beyondWash ? -PAGE_WASH_HEIGHT : -scrollY - navigationTop}px`;
    const profileOffset = `${beyondWash ? -PAGE_WASH_HEIGHT : -scrollY - profileTop}px`;
    if (navOffset !== navigationPaintOffset) {
        header.style.setProperty("--page-wash-nav-offset", navOffset);
        navigationPaintOffset = navOffset;
    }
    if (profile && profileOffset !== profilePaintOffset) {
        header.style.setProperty("--page-wash-profile-offset", profileOffset);
        profilePaintOffset = profileOffset;
    }
}

function measureNavigation() {
    if (!header || !navigation) return;
    footerEdgeCutoff = footer ? Number.parseFloat(getComputedStyle(footer).paddingBottom) || 24 : 24;
    // Include the header's top spacing even while navigation is fixed.
    headerTop = header.getBoundingClientRect().top + window.scrollY + (Number.parseFloat(getComputedStyle(header).paddingTop) || 0);
    navigationHeight = navigation.offsetHeight;
    profileHeight = profile?.offsetHeight ?? 0;
    profileLinkTop = profile && profileLink ? profileLink.getBoundingClientRect().top - profile.getBoundingClientRect().top : 0;
    header.style.setProperty("--navigation-height", `${navigationHeight}px`);
}

function updateHeader() {
    frame = undefined;
    if (!header || !navigation) return;
    const scrollY = Math.max(0, window.scrollY);
    updateCanvasPaint(scrollY);
    updateFooterPaint(scrollY);
    // Dialogs restore focus to their trigger for every input method. Only
    // keyboard focus should hold the bar open once pointer reading resumes.
    const focused = !pointerInput && navigation.contains(document.activeElement);
    // Scroll locks may restore position on close; don't interpret them as intent.
    if (!document.querySelector("dialog[open]")) {
        const wasFloating = floating;
        // Hand off only when the original bar reaches the pinned bar's position.
        if (scrollY <= headerTop) {
            floating = false;
            hidden = false;
            directionAnchor = scrollY;
        } else {
            if (!floating && scrollY >= headerTop + navigationHeight) {
                floating = true;
                hidden = true;
                directionAnchor = scrollY;
            }
            if (floating) {
                const wasHidden = hidden;
                // Track the last extreme, so small reversals don't erase slow intent.
                directionAnchor = hidden ? Math.max(directionAnchor, scrollY) : Math.min(directionAnchor, scrollY);
                if (hidden && directionAnchor - scrollY >= REVEAL_DISTANCE) hidden = false;
                if (!hidden && scrollY - directionAnchor >= HIDE_DISTANCE) hidden = true;
                if (focused) hidden = false;
                if (focused || hidden !== wasHidden) directionAnchor = scrollY;
            }
        }
        if (!floating) {
            header.removeAttribute("data-nav-ready");
        }
        header.toggleAttribute("data-nav-floating", floating);
        header.toggleAttribute("data-nav-hidden", floating && hidden);
        navigation.inert = floating && hidden;
        if (floating && !wasFloating) {
            // Resolve the initial offscreen state before enabling either transition.
            navigation.getBoundingClientRect();
            header.setAttribute("data-nav-ready", "");
        }
    } else {
        directionAnchor = scrollY;
    }

    let profileInset = 0;
    if (profile) {
        const paintedBottom = floating ? Math.max(0, navigation.getBoundingClientRect().bottom) : 0;
        const distance = Math.max(0, scrollY - headerTop);
        // Occlude in place: the drawer must never translate the profile's content.
        // A negative inset exposes only background across the near-top gap.
        const clipTop = Math.min(profileHeight, paintedBottom - (navigationHeight - distance));
        profileInset = Math.min(0, clipTop);
        const returning = floating && (paintedBottom > 0 || distance < navigationHeight);
        header.toggleAttribute("data-profile-return", returning);
        header.style.setProperty("--profile-return-top", `${clipTop}px`);
        if (profileLink) profileLink.inert = returning && clipTop > profileLinkTop;
    }
    updateBackgroundPaint(scrollY, profileInset);
    if (
        navigation
            .getAnimations()
            .some(
                (animation) =>
                    animation instanceof CSSTransition && animation.transitionProperty === "transform" && animation.playState === "running",
            )
    )
        queueUpdate();

    if (progressBar) {
        const trackLength = document.documentElement.scrollHeight - window.innerHeight;
        const longEnough = trackLength >= window.innerHeight * MIN_SCROLL_DISTANCE_VH;
        progressBar.style.opacity = longEnough ? "1" : "0";
        if (longEnough) {
            const progress = Math.max(0, Math.min(scrollY / trackLength, 1));
            progressBar.style.transform = `scaleX(${progress})`;
            progressBar.setAttribute("aria-valuenow", Math.round(progress * 100).toString());
        }
    }
}

function queueUpdate() {
    if (frame === undefined && header) frame = requestAnimationFrame(updateHeader);
}

function initHeader() {
    header = document.querySelector<HTMLElement>("[data-header]");
    navigation = header?.querySelector<HTMLElement>(".site-header__inner") ?? null;
    profile = header?.querySelector<HTMLElement>(".home-profile") ?? null;
    footer = document.querySelector<HTMLElement>(".site-footer");
    profileLink = profile?.querySelector<HTMLElement>(".home-profile__about") ?? null;
    progressBar = document.querySelector<HTMLElement>("[data-reading-progress]");
    floating = false;
    hidden = false;
    navigationPaintOffset = "";
    profilePaintOffset = "";
    canvasStrength = "";
    footerEdgeStrength = "";
    const washStyle = getComputedStyle(document.documentElement);
    washStops = [
        [0, 1],
        ...[1, 2, 3].map((stop): [number, number] => [
            Number.parseFloat(washStyle.getPropertyValue(`--page-wash-stop-${stop}`)),
            Number.parseFloat(washStyle.getPropertyValue(`--page-wash-level-${stop}`)),
        ]),
        [PAGE_WASH_HEIGHT, 0],
    ];
    directionAnchor = Math.max(0, window.scrollY);
    measureNavigation();
    // Only the navigation bar occupies the viewport during reading.
    document.documentElement.style.setProperty("--header-offset", `${navigationHeight}px`);
    updateHeader();
}

// Persistent module listeners bind once; references and queued work are reset per page.
window.addEventListener("scroll", queueUpdate, { passive: true });
for (const inputEvent of ["pointerdown", "wheel"]) {
    document.addEventListener(
        inputEvent,
        () => {
            pointerInput = true;
            queueUpdate();
        },
        { passive: true },
    );
}
document.addEventListener("keydown", () => {
    pointerInput = false;
    queueUpdate();
});
document.addEventListener("focusin", queueUpdate);
document.addEventListener("focusout", queueUpdate);
window.addEventListener(
    "resize",
    () => {
        measureNavigation();
        queueUpdate();
    },
    { passive: true },
);
document.addEventListener("astro:page-load", initHeader);
document.addEventListener("astro:before-swap", () => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    header = null;
    navigation = null;
    profile = null;
    footer = null;
    document.documentElement.style.setProperty("--footer-edge-strength", "0");
    profileLink = null;
    progressBar = null;
});
