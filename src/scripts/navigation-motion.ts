/** Preserve the runner's current geometry before smoothly filling its track. */
export function expandBrandTrack(brand: HTMLElement) {
    const runner = brand.querySelector<HTMLElement>(".motion-track i");
    if (!runner) return;
    const style = getComputedStyle(runner);
    runner.style.left = style.left;
    runner.style.width = style.width;
    brand.dataset.loading = "completing";
    runner.getBoundingClientRect();
    runner.style.left = "0px";
    runner.style.width = "100%";
}

export function resetBrandMotion(brand: HTMLElement) {
    brand.querySelector<HTMLElement>(".motion-track i")?.removeAttribute("style");
    brand.dataset.loading = "reset";
    brand.getBoundingClientRect();
    brand.removeAttribute("data-loading");
}
