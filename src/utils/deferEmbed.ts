/** Gate network startup on visibility or explicit interaction, without changing markup. */
export function deferEmbed(container: HTMLElement, initialize: () => void): () => void {
    const target = container.closest<HTMLElement>(".comments-section") || container;
    const controller = new AbortController();
    let observer: IntersectionObserver | undefined;
    let finished = false;
    const cleanup = () => {
        finished = true;
        observer?.disconnect();
        controller.abort();
    };
    const start = () => {
        if (finished || !container.isConnected) return;
        cleanup();
        initialize();
    };
    target.addEventListener("pointerdown", start, { signal: controller.signal });
    target.addEventListener("focusin", start, { signal: controller.signal });
    if (typeof IntersectionObserver === "undefined") {
        start(); // Keep comments available in older browsers.
    } else {
        observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) start();
        });
        // Observe the section, since the unloaded widget itself has zero height.
        observer.observe(target);
    }
    return cleanup;
}
