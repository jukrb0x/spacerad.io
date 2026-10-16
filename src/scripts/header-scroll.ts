// Float only navigation; the Home profile stays in its original document flow.
let header: HTMLElement | null = null;
let navigation: HTMLElement | null = null;
let profile: HTMLElement | null = null;
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
const REVEAL_DISTANCE = 32;
const HIDE_DISTANCE = 24;
const MIN_SCROLL_DISTANCE_VH = 1.5;

function measureNavigation() {
    if (!header || !navigation) return;
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

    if (profile) {
        const paintedBottom = floating ? Math.max(0, navigation.getBoundingClientRect().bottom) : 0;
        const distance = Math.max(0, scrollY - headerTop);
        // Occlude in place: the drawer must never translate the profile's content.
        // A negative inset exposes only background across the near-top gap.
        const clipTop = Math.min(profileHeight, paintedBottom - (navigationHeight - distance));
        const returning = floating && (paintedBottom > 0 || distance < navigationHeight);
        header.toggleAttribute("data-profile-return", returning);
        header.style.setProperty("--profile-return-top", `${clipTop}px`);
        if (profileLink) profileLink.inert = returning && clipTop > profileLinkTop;
        if (
            navigation
                .getAnimations()
                .some(
                    (animation) =>
                        animation instanceof CSSTransition && animation.transitionProperty === "transform" && animation.playState === "running",
                )
        )
            queueUpdate();
    }

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
    profileLink = profile?.querySelector<HTMLElement>(".home-profile__about") ?? null;
    progressBar = document.querySelector<HTMLElement>("[data-reading-progress]");
    floating = false;
    hidden = false;
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
    profileLink = null;
    progressBar = null;
});
