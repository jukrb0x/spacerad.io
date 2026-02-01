/**
 * Like Button System
 * Manages like functionality with localStorage persistence and API sync
 */

import { autoInit } from "../utils/spaLifecycle";

const LIKE_STORAGE_KEY = "spacerad_likes";
const MAX_LIKES = 16;

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
	localStorage.setItem(LIKE_STORAGE_KEY, JSON.stringify(data));
}

/**
 * Update like UI for all like buttons
 */
function updateLikeUI(count: number, userLikes: number, maxReached: boolean): void {
	const likeButtons = document.querySelectorAll<HTMLElement>("[data-like-button]");
	const likeCountElements = document.querySelectorAll<HTMLElement>("[data-like-count]");

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
	});

	likeCountElements.forEach((el) => {
		el.textContent = count > 0 ? String(count) : "";
	});
}

/**
 * Fetch like status from API
 */
async function fetchLikeStatus(slug: string): Promise<void> {
	const localData = getLikeData();
	const localUserLikes = localData[slug] || 0;
	updateLikeUI(localUserLikes, localUserLikes, localUserLikes >= MAX_LIKES);

	try {
		const res = await fetch(`/api/like?slug=${encodeURIComponent(slug)}`);
		if (res.ok) {
			const data: LikeResponse = await res.json();
			const userLikes = Math.max(data.userLikes, localUserLikes);
			updateLikeUI(data.count, userLikes, userLikes >= MAX_LIKES);
			if (userLikes !== localUserLikes) {
				localData[slug] = userLikes;
				saveLikeData(localData);
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
	const localData = getLikeData();
	const currentLikes = localData[slug] || 0;

	if (currentLikes >= MAX_LIKES) {
		// Shake animation when max reached
		const likeButtons = document.querySelectorAll<HTMLElement>("[data-like-button]");
		likeButtons.forEach((btn) => {
			btn.classList.add("animate-shake");
			setTimeout(() => btn.classList.remove("animate-shake"), 300);
		});
		return;
	}

	const newLikes = currentLikes + 1;
	localData[slug] = newLikes;
	saveLikeData(localData);

	// Pop animation
	const likeButtons = document.querySelectorAll<HTMLElement>("[data-like-button]");
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
			updateLikeUI(data.count, data.userLikes, data.userLikes >= MAX_LIKES);
			localData[slug] = data.userLikes;
			saveLikeData(localData);
		}
	} catch (err) {
		console.error("Failed to add like:", err);
	}
}

/**
 * Initialize like buttons
 */
function initLikes(): void {
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
			// Close mobile menu if open
			const menuOpen = document.querySelector("[data-share-menu]")?.classList.contains("opacity-0") === false;
			if (menuOpen) {
				const event = new CustomEvent("share-menu-close");
				document.dispatchEvent(event);
			}
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

// Initialize on page load
autoInit(initLikes, "page-load");

export { initLikes, addLike, fetchLikeStatus };
