export const baseURL = process.env.BASE_URL || "http://127.0.0.1:4321";
export const launchOptions = {
    headless: true,
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
};

export async function waitForPageAnimations(page) {
    await page.evaluate(async () => {
        const animations = document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity);
        let timeout;
        try {
            await Promise.race([
                Promise.all(animations.map((animation) => animation.finished.catch(() => {}))),
                new Promise((_, reject) => {
                    timeout = setTimeout(() => reject(new Error("Page animations did not finish within 4 seconds")), 4000);
                }),
            ]);
        } finally {
            clearTimeout(timeout);
        }
    });
}
