export const baseURL = process.env.BASE_URL || "http://127.0.0.1:4321";
export const launchOptions = {
    headless: true,
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
};

export async function waitForPageAnimations(page) {
    await page.evaluate(async () => {
        const animations = document
            .getAnimations()
            .filter((animation) => animation.playState !== "idle" && animation.effect?.getComputedTiming().iterations !== Infinity);
        const deadline = performance.now() + 4000;
        while (animations.some((animation) => animation.playState === "running" || animation.playState === "pending")) {
            if (performance.now() >= deadline) throw new Error("Page animations did not finish within 4 seconds");
            await new Promise(requestAnimationFrame);
        }
    });
}
