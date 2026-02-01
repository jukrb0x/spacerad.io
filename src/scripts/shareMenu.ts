/**
 * Share Menu System
 * Manages mobile share menu toggle and copy link functionality
 */

import { autoInit } from "../utils/spaLifecycle";

let menuOpen = false;
let toastTimeout: number;

/**
 * Set menu open state
 */
function setMenuOpen(open: boolean): void {
	const mobileToggle = document.querySelector<HTMLElement>("[data-share-mobile-toggle]");
	const shareMenu = document.querySelector<HTMLElement>("[data-share-menu]");
	const shareMenuItems = document.querySelectorAll<HTMLElement>("[data-share-menu-item]");

	if (!shareMenu || !mobileToggle) return;

	menuOpen = open;
	mobileToggle.setAttribute("aria-expanded", String(open));
	shareMenu.setAttribute("aria-hidden", String(!open));

	if (open) {
		shareMenu.classList.remove("opacity-0", "pointer-events-none");
		shareMenuItems.forEach((item, i) => {
			setTimeout(() => {
				item.classList.remove("scale-75");
				item.classList.add("scale-100");
			}, i * 50);
		});
	} else {
		shareMenu.classList.add("opacity-0", "pointer-events-none");
		shareMenuItems.forEach((item) => {
			item.classList.remove("scale-100");
			item.classList.add("scale-75");
		});
	}
}

/**
 * Show toast notification
 */
function showToast(): void {
	const toast = document.querySelector<HTMLElement>("[data-copy-toast]");
	if (!toast) return;

	clearTimeout(toastTimeout);
	toast.classList.remove("opacity-0", "pointer-events-none", "translate-y-2");
	toastTimeout = window.setTimeout(() => {
		toast.classList.add("opacity-0", "pointer-events-none", "translate-y-2");
	}, 2000);
}

/**
 * Copy link to clipboard
 */
async function copyLink(url: string): Promise<void> {
	try {
		await navigator.clipboard.writeText(url);
		showToast();
	} catch {
		// Fallback for older browsers
		const textarea = document.createElement("textarea");
		textarea.value = url;
		textarea.style.position = "fixed";
		textarea.style.opacity = "0";
		document.body.appendChild(textarea);
		textarea.select();
		document.execCommand("copy");
		document.body.removeChild(textarea);
		showToast();
	}
}

/**
 * Initialize share menu
 */
function initShareMenu(): void {
	const mobileToggle = document.querySelector<HTMLElement>("[data-share-mobile-toggle]");
	const copyButtons = document.querySelectorAll<HTMLElement>("[data-copy-link]");

	// Reset state
	menuOpen = false;

	// Mobile toggle
	mobileToggle?.addEventListener("click", () => setMenuOpen(!menuOpen));

	// Close on outside click
	document.addEventListener("click", (e) => {
		const target = e.target as HTMLElement;
		if (menuOpen && !target.closest("[data-share-menu]") && !target.closest("[data-share-mobile-toggle]")) {
			setMenuOpen(false);
		}
	});

	// Close on Escape
	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && menuOpen) {
			setMenuOpen(false);
			mobileToggle?.focus();
		}
	});

	// Copy link buttons
	copyButtons.forEach((btn) => {
		btn.addEventListener("click", () => {
			const url = btn.dataset.url;
			if (url) copyLink(url);
			if (menuOpen) setMenuOpen(false);
		});
	});

	// Listen for custom close event (from likes module)
	document.addEventListener("share-menu-close", () => {
		setMenuOpen(false);
	});
}

// Initialize on page load
autoInit(initShareMenu, "page-load");

export { initShareMenu, setMenuOpen, copyLink };
