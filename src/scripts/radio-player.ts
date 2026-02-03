/**
 * Radio Player Controller
 * Manages audio playback, UI bindings, and nanostore state for the persistent radio player.
 * Uses transition:persist — the DOM element survives navigation, so we guard against double-binding.
 */

import { radioState, radioExpanded, radioVolume, radioMuted, radioTitle, type RadioState } from "../stores/radio";

const BOUND_ATTR = "data-radio-bound";
const DEFAULT_TITLE = "Space Radio";

function initRadioPlayer(): void {
    const root = document.querySelector<HTMLElement>("[data-radio-player]");
    if (!root) return;

    // Guard: persisted element may already be bound
    if (root.hasAttribute(BOUND_ATTR)) return;
    root.setAttribute(BOUND_ATTR, "");

    const audio = root.querySelector<HTMLAudioElement>("[data-radio-audio]");
    const streamUrl = root.dataset.streamUrl || "";

    if (!audio || !streamUrl) return;

    // --- DOM refs ---
    const playButtons = root.querySelectorAll<HTMLElement>("[data-radio-play]");
    const expandBtn = root.querySelector<HTMLElement>("[data-radio-expand]");
    const barClickable = root.querySelector<HTMLElement>("[data-radio-bar-clickable]");
    const drawer = root.querySelector<HTMLElement>("[data-radio-drawer]");
    const titleEl = root.querySelector<HTMLElement>("[data-radio-title]");
    const statusEl = root.querySelector<HTMLElement>("[data-radio-status]");
    const muteBtn = root.querySelector<HTMLElement>("[data-radio-mute]");
    const volumeSlider = root.querySelector<HTMLInputElement>("[data-radio-volume]");
    const dialIndicator = root.querySelector<SVGLineElement>("[data-radio-dial-indicator]");
    const cassetteTitle = root.querySelector<SVGTextElement>("[data-radio-cassette-title]");

    // --- Audio helpers ---
    function play(): void {
        radioState.set("loading");
        audio!.src = streamUrl;
        audio!.load();
        audio!.play().catch(() => {
            radioState.set("error");
        });
    }

    function stop(): void {
        audio!.pause();
        audio!.removeAttribute("src");
        audio!.load(); // release stream buffer
        radioState.set("stopped");
    }

    function togglePlay(): void {
        const state = radioState.get();
        if (state === "playing" || state === "loading") {
            stop();
        } else {
            play();
        }
    }

    function toggleExpanded(): void {
        radioExpanded.set(!radioExpanded.get());
    }

    function updateVolume(val: number): void {
        radioVolume.set(Math.max(0, Math.min(1, val)));
    }

    function toggleMute(): void {
        radioMuted.set(!radioMuted.get());
    }

    // --- Audio events ---
    audio.addEventListener("playing", () => radioState.set("playing"));
    audio.addEventListener("waiting", () => radioState.set("loading"));
    audio.addEventListener("stalled", () => radioState.set("loading"));
    audio.addEventListener("error", () => {
        if (audio.src) radioState.set("error");
    });

    // --- UI event listeners ---
    playButtons.forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            togglePlay();
        });
    });

    expandBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleExpanded();
    });

    barClickable?.addEventListener("click", () => {
        toggleExpanded();
    });

    muteBtn?.addEventListener("click", () => {
        toggleMute();
    });

    volumeSlider?.addEventListener("input", () => {
        updateVolume(parseFloat(volumeSlider.value));
        // Unmute if user adjusts volume while muted
        if (radioMuted.get()) {
            radioMuted.set(false);
        }
    });

    // Escape key closes drawer
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && radioExpanded.get()) {
            radioExpanded.set(false);
        }
    });

    // --- Helper: update displayed title based on state ---
    function updateDisplayedTitle(state: RadioState): void {
        const isActive = state === "playing" || state === "loading";
        const displayTitle = isActive ? radioTitle.get() : DEFAULT_TITLE;
        if (titleEl) titleEl.textContent = displayTitle;
        if (cassetteTitle) cassetteTitle.textContent = displayTitle.toUpperCase();
    }

    // --- Nanostore subscriptions → update UI ---
    radioState.subscribe((state: RadioState) => {
        root.dataset.radioState = state;

        // Update play button aria-labels
        const label = state === "playing" || state === "loading" ? "Stop radio" : "Play radio";
        playButtons.forEach((btn) => {
            btn.setAttribute("aria-label", label);
        });

        // Update status text
        if (statusEl) {
            const statusMap: Record<RadioState, string> = {
                stopped: "",
                loading: "Connecting...",
                playing: "Now playing",
                error: "Connection error",
            };
            statusEl.textContent = statusMap[state];
        }

        // Update title: show store title when active, default when stopped/error
        updateDisplayedTitle(state);
    });

    radioExpanded.subscribe((expanded: boolean) => {
        root.dataset.radioExpanded = String(expanded);
        expandBtn?.setAttribute("aria-expanded", String(expanded));
        drawer?.setAttribute("aria-hidden", String(!expanded));
    });

    radioVolume.subscribe((vol: number) => {
        audio.volume = radioMuted.get() ? 0 : vol;

        if (volumeSlider) {
            volumeSlider.value = String(vol);
        }

        // Rotate dial indicator: 0 → -135deg (min), 1 → 135deg (max)
        if (dialIndicator) {
            const angle = -135 + vol * 270;
            dialIndicator.style.transform = `rotate(${angle}deg)`;
        }
    });

    radioMuted.subscribe((muted: boolean) => {
        root.dataset.radioMuted = String(muted);
        audio.volume = muted ? 0 : radioVolume.get();
    });

    radioTitle.subscribe(() => {
        // Only update display if radio is active; otherwise keep default title
        updateDisplayedTitle(radioState.get());
    });

    // --- Navigation lifecycle: mask backdrop-filter flash during DOM swap ---
    // Problem: during Astro's body swap the page content behind the player
    // disappears. backdrop-filter: blur() sees nothing → transparent flash.
    // The bar's `transition: background` makes it worse by animating through
    // intermediate alpha values instead of snapping.
    //
    // Fix: before swap, instantly switch to a solid opaque background with
    // transitions disabled. After the new page is painted, remove the class
    // but suppress the reverse transition so it doesn't animate back.
    const bar = root.querySelector<HTMLElement>(".radio-player__bar");
    const drawerEl = root.querySelector<HTMLElement>(".radio-player__drawer");

    document.addEventListener("astro:before-swap", () => {
        root.classList.add("radio-player--navigating");
    });

    document.addEventListener("astro:after-swap", () => {
        // Wait for the new page content to be painted before restoring
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                // Remove navigating class (restores backdrop-filter + alpha bg)
                root.classList.remove("radio-player--navigating");

                // The element's transition property is now back, so the browser
                // would animate from solid → semi-transparent. Suppress that by
                // temporarily disabling transitions on the elements directly.
                const targets = [bar, drawerEl].filter(Boolean) as HTMLElement[];
                for (const el of targets) {
                    el.style.transition = "none";
                }

                // Force style recalc so the new background is applied without transition
                root.offsetHeight; // eslint-disable-line @typescript-eslint/no-unused-expressions

                // Re-enable transitions on the next frame
                requestAnimationFrame(() => {
                    for (const el of targets) {
                        el.style.transition = "";
                    }
                });
            });
        });
    });

    // --- Initialize UI from current store state ---
    radioState.notify();
    radioExpanded.notify();
    radioVolume.notify();
    radioMuted.notify();
    radioTitle.notify();
}

// Run once — the persisted element + module-level execution + BOUND_ATTR guard
// ensures this only initializes once even across SPA navigations.
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRadioPlayer, { once: true });
} else {
    initRadioPlayer();
}
