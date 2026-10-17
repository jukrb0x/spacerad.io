import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { baseURL, launchOptions } from "./helpers/browser.mjs";

const vendor = `window.remarkBoots ||= []; window.REMARK42 = { createInstance(config) {
 const root=document.getElementById('remark42'); if(!root) throw new Error("Can't find root node");
 window.remarkBoots.push(config.url); const frame=document.createElement('iframe');frame.srcdoc='<p>Read-only fixture</p>';root.append(frame);
 window.REMARK42.destroy=()=>frame.remove();window.REMARK42.changeTheme=()=>{};
} }; window.REMARK42.createInstance(window.remark_config);`;
const safe = (route) => ["GET", "HEAD", "OPTIONS"].includes(route.request().method());

test("pending comment bootstrap never executes after leaving its article", async () => {
    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let release;
    let started;
    const held = new Promise((resolve) => {
        release = resolve;
    });
    const requested = new Promise((resolve) => {
        started = resolve;
    });
    await context.route("**/*", async (route) => {
        if (!safe(route)) return route.abort();
        if (/\/(web\/embed\.js|api\/remark42-script)$/.test(new URL(route.request().url()).pathname)) {
            started();
            await held;
            return route.fulfill({ contentType: "application/javascript", body: vendor }).catch(() => {});
        }
        return route.continue();
    });
    try {
        await page.goto(new URL("/posts/ue5-landscape-grass", baseURL).href, { waitUntil: "domcontentloaded" });
        await page.locator(".comments-section").scrollIntoViewIfNeeded();
        await requested;
        await page.locator(".editorial-back a").click();
        await page.waitForURL(/\/posts\/?$/);
        release();
        await page.waitForTimeout(450);
        assert.deepEqual(errors, []);
        assert.equal(await page.evaluate(() => window.remarkBoots?.length || 0), 0);
        assert.equal(await page.locator("#remark42").count(), 0);
    } finally {
        release();
        await context.close();
        await browser.close();
    }
});

test("pending Home channel loading is cancelled without a rejection or stale DOM write", async () => {
    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let release;
    let started;
    const held = new Promise((resolve) => {
        release = resolve;
    });
    const requested = new Promise((resolve) => {
        started = resolve;
    });
    await context.route("**/*", async (route) => {
        if (!safe(route)) return route.abort();
        if (/\/(api\/latest-channel|_server-islands\/LatestChannel)/.test(new URL(route.request().url()).pathname)) {
            started();
            await held;
            return route.abort("aborted").catch(() => {});
        }
        return route.continue();
    });
    try {
        await page.goto(baseURL, { waitUntil: "domcontentloaded" });
        await requested;
        await page.locator('.site-header a[href="/posts"]').click();
        await page.waitForURL(/\/posts\/?$/);
        release();
        await page.waitForTimeout(450);
        assert.deepEqual(errors, []);
        assert.equal(await page.locator(".home-channel").count(), 0);
        assert.equal(await page.getByText("Late channel fixture").count(), 0);
    } finally {
        release();
        await context.close();
        await browser.close();
    }
});
