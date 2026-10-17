// Direct node --test invocations also retain stress coverage by default.
const profile = process.env.BROWSER_TEST_PROFILE || "full";
if (!["full", "pr"].includes(profile)) throw new Error(`Unknown browser test profile: ${profile}`);
export const spaSwaps = (fullCount) => (profile === "pr" ? 4 : fullCount);
