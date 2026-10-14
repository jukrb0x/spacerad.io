// Float only navigation; the Home profile stays in its original document flow.
let header: HTMLElement | null = null;
let navigation: HTMLElement | null = null;
let progressBar: HTMLElement | null = null;
let frame: number | undefined;
let lastScrollY = 0;
let directionAnchor = 0;
let direction = 0;
let headerTop = 0;
let navigationHeight = 0;
let floating = false;
let hidden = false;
const REVEAL_DISTANCE = 32;
const HIDE_DISTANCE = 24;
const MIN_SCROLL_DISTANCE_VH = 1.5;

function measureNavigation() {
    if (!header || !navigation) return;
    headerTop = header.getBoundingClientRect().top + window.scrollY;
    navigationHeight = navigation.offsetHeight;
}

function updateHeader() {
    frame = undefined;
    if (!header || !navigation) return;
    const scrollY = Math.max(0, window.scrollY);
    const delta = scrollY - lastScrollY;
    // Scroll locks may restore position on close; don't interpret them as intent.
    if (!document.querySelector("dialog[open]")) {
        if (scrollY <= headerTop) {
            floating = false;
            hidden = false;
            direction = 0;
            directionAnchor = scrollY;
        } else {
            if (!floating && scrollY >= headerTop + navigationHeight) {
                floating = true;
                hidden = true;
                directionAnchor = scrollY;
                direction = 0;
            }
            if (floating) {
                const nextDirection = Math.sign(delta);
                if (nextDirection && nextDirection !== direction) {
                    directionAnchor = lastScrollY;
                    direction = nextDirection;
                }
                if (direction < 0 && directionAnchor - scrollY >= REVEAL_DISTANCE) hidden = false;
                if (direction > 0 && scrollY - directionAnchor >= HIDE_DISTANCE) hidden = true;
                if (navigation.contains(document.activeElement)) hidden = false;
            }
        }
        header.toggleAttribute("data-nav-floating", floating);
        header.toggleAttribute("data-nav-hidden", floating && hidden);
        navigation.inert = floating && hidden;
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
    lastScrollY = scrollY;
}

function queueUpdate() {
    if (frame === undefined && header) frame = requestAnimationFrame(updateHeader);
}

function initHeader() {
    header = document.querySelector<HTMLElement>("[data-header]");
    navigation = header?.querySelector<HTMLElement>(".site-header__inner") ?? null;
    progressBar = document.querySelector<HTMLElement>("[data-reading-progress]");
    floating = false;
    hidden = false;
    direction = 0;
    lastScrollY = Math.max(0, window.scrollY);
    directionAnchor = lastScrollY;
    measureNavigation();
    // Only the navigation bar occupies the viewport during reading.
    document.documentElement.style.setProperty("--header-offset", `${navigationHeight}px`);
    updateHeader();
}

// Persistent module listeners bind once; references and queued work are reset per page.
window.addEventListener("scroll", queueUpdate, { passive: true });
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
    progressBar = null;
});
