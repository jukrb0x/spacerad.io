// Float only navigation; the Home profile stays in its original document flow.
let header: HTMLElement | null = null;
let navigation: HTMLElement | null = null;
let profile: HTMLElement | null = null;
let profileLink: HTMLElement | null = null;
let profileLinkTop = 0;
let profileLinkBottom = 0;
let progressBar: HTMLElement | null = null;
let frame: number | undefined;
let directionAnchor = 0;
let headerTop = 0;
let navigationHeight = 0;
let profileHeight = 0;
let floating = false;
let hidden = false;
const REVEAL_DISTANCE = 32;
const HIDE_DISTANCE = 24;
const MIN_SCROLL_DISTANCE_VH = 1.5;

function measureNavigation() {
    if (!header || !navigation) return;
    headerTop = header.getBoundingClientRect().top + window.scrollY;
    navigationHeight = navigation.offsetHeight;
    profileHeight = profile?.offsetHeight ?? 0;
    profileLinkTop = profile && profileLink ? profileLink.getBoundingClientRect().top - profile.getBoundingClientRect().top : 0;
    profileLinkBottom = profileLinkTop + (profileLink?.offsetHeight ?? 0);
    header.style.setProperty("--navigation-height", `${navigationHeight}px`);
}

function updateHeader() {
    frame = undefined;
    if (!header || !navigation) return;
    const scrollY = Math.max(0, window.scrollY);
    const focused = navigation.contains(document.activeElement);
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
        // Match the painted drawer on entrance, exit and interrupted transitions.
        // Clip within the profile's original footprint so Blog never moves or gets covered.
        const paintedFraction = floating ? Math.max(0, Math.min(1, navigation.getBoundingClientRect().bottom / navigationHeight)) : 0;
        const distance = Math.max(0, scrollY - headerTop);
        let shift = distance * paintedFraction;
        let clipTop = Math.max(0, distance - navigationHeight) * (1 - paintedFraction);
        let clipBottom = shift;
        const returning = floating && paintedFraction > 0;
        if (clipTop + clipBottom >= profileHeight) {
            shift = 0;
            clipTop = profileHeight;
            clipBottom = 0;
        }
        header.toggleAttribute("data-profile-return", returning);
        header.style.setProperty("--profile-return-shift", `${shift}px`);
        header.style.setProperty("--profile-return-top", `${clipTop}px`);
        header.style.setProperty("--profile-return-bottom", `${clipBottom}px`);
        if (profileLink) profileLink.inert = returning && (clipTop > profileLinkTop || clipBottom > profileHeight - profileLinkBottom);
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
    profileLink = profile?.querySelector<HTMLElement>(".home-profile__name") ?? null;
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
