/**
 * Like Button System
 * Manages like functionality with localStorage persistence and API sync
 */

import { autoInit } from "../utils/spaLifecycle";

const LIKE_STORAGE_KEY = "spacerad_likes";
const MAX_LIKES = 16;
let routeRevision = 0;
let readRevision = 0;
let writeRevision = 0;

interface LikeData {
    [slug: string]: number;
}

interface LikeResponse {
    count: number;
    userLikes: number;
}

/**
 * Get like data from localStorage
 */
function getLikeData(): LikeData {
    try {
        return JSON.parse(localStorage.getItem(LIKE_STORAGE_KEY) || "{}");
    } catch {
        return {};
    }
}

/**
 * Save like data to localStorage
 */
function saveLikeData(data: LikeData): void {
    try {
        localStorage.setItem(LIKE_STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
        console.error("Failed to save like data:", err);
    }
}

/**
 * Find the requested article’s like controls without interpolating its slug into CSS.
 */
function getLikeButtons(slug: string): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>("[data-like-button]")).filter((btn) => btn.dataset.slug === slug);
}

/**
 * Update like UI for the requested article
 */
function updateLikeUI(slug: string, count: number, userLikes: number, maxReached: boolean): void {
    const likeButtons = getLikeButtons(slug);

    likeButtons.forEach((btn) => {
        if (userLikes > 0) {
            btn.setAttribute("data-liked", "");
        } else {
            btn.removeAttribute("data-liked");
        }
        if (maxReached) {
            btn.setAttribute("data-max-reached", "");
        } else {
            btn.removeAttribute("data-max-reached");
        }
        btn.querySelectorAll<HTMLElement>("[data-like-count]").forEach((el) => {
            el.textContent = count > 0 ? String(count) : "";
        });
    });
}

/**
 * Fetch like status from API
 */
async function fetchLikeStatus(slug: string): Promise<void> {
    const route = routeRevision;
    const read = ++readRevision;
    const localData = getLikeData();
    const localUserLikes = localData[slug] || 0;
    updateLikeUI(slug, localUserLikes, localUserLikes, localUserLikes >= MAX_LIKES);

    try {
        const res = await fetch(`/api/like?slug=${encodeURIComponent(slug)}`);
        if (route !== routeRevision || read !== readRevision) return;
        if (res.ok) {
            const data: LikeResponse = await res.json();
            if (route !== routeRevision || read !== readRevision) return;
            const latestData = getLikeData();
            const userLikes = Math.max(data.userLikes, latestData[slug] || 0);
            updateLikeUI(slug, data.count, userLikes, userLikes >= MAX_LIKES);
            if (userLikes !== (latestData[slug] || 0)) {
                latestData[slug] = userLikes;
                saveLikeData(latestData);
            }
        }
    } catch (err) {
        console.error("Failed to fetch like status:", err);
    }
}

/**
 * Add a like
 */
async function addLike(slug: string): Promise<void> {
    const route = routeRevision;
    const localData = getLikeData();
    const currentLikes = localData[slug] || 0;

    if (currentLikes >= MAX_LIKES) {
        // Shake animation when max reached
        const likeButtons = getLikeButtons(slug);
        likeButtons.forEach((btn) => {
            btn.classList.add("animate-shake");
            setTimeout(() => btn.classList.remove("animate-shake"), 300);
        });
        return;
    }

    // A pending status read predates this write and must not roll its UI back.
    readRevision++;
    const write = ++writeRevision;
    const newLikes = currentLikes + 1;
    localData[slug] = newLikes;
    saveLikeData(localData);

    // Pop animation
    const likeButtons = getLikeButtons(slug);
    likeButtons.forEach((btn) => {
        btn.setAttribute("data-liked", "");
        btn.classList.add("animate-pop");
        setTimeout(() => btn.classList.remove("animate-pop"), 200);
    });

    try {
        const res = await fetch("/api/like", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug }),
        });
        if (res.ok) {
            const data: LikeResponse = await res.json();
            const latestData = getLikeData();
            const userLikes = Math.max(data.userLikes, latestData[slug] || 0);
            latestData[slug] = userLikes;
            saveLikeData(latestData);
            if (route === routeRevision && write === writeRevision) {
                updateLikeUI(slug, data.count, userLikes, userLikes >= MAX_LIKES);
            }
        }
    } catch (err) {
        console.error("Failed to add like:", err);
    }
}

/**
 * Initialize like buttons
 */
function initLikes(): void {
    routeRevision++;
    const likeButtons = document.querySelectorAll<HTMLElement>("[data-like-button]");

    likeButtons.forEach((btn) => {
        const slug = btn.dataset.slug;
        if (!slug) return;

        // Remove existing listener if any
        const newBtn = btn.cloneNode(true) as HTMLElement;
        btn.parentNode?.replaceChild(newBtn, btn);

        // Add click listener
        newBtn.addEventListener("click", () => {
            addLike(slug);
        });
    });

    // Fetch like status for the first button
    const firstButton = likeButtons[0];
    if (firstButton) {
        const slug = firstButton.dataset.slug;
        if (slug) {
            fetchLikeStatus(slug);
        }
    }
}

// Invalidate reads before DOM replacement, including a later visit to the same slug.
document.addEventListener("astro:before-swap", () => {
    routeRevision++;
});

// Initialize on page load
autoInit(initLikes, "page-load");

export { initLikes, addLike, fetchLikeStatus };
