import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { baseURL, launchOptions } from './helpers/browser.mjs';

test('wordmark hover survives compact desktop widths without overlapping navigation', async () => {
    const browser = await chromium.launch(launchOptions);
    try {
        const page = await browser.newPage();
        await page.goto(new URL('/posts', baseURL).href);
        for (const width of [1019, 1099, 1100, 1164, 768, 390]) {
            await page.setViewportSize({ width, height: 900 });
            await page.mouse.move(0, 0);
            const brand = page.locator('[data-wordmark-trigger]');
            await brand.hover();
            const phrase = page.locator('[data-wordmark-whisper]');
            await phrase.waitFor({ state: 'visible' });
            assert.equal(await phrase.getAttribute('data-visible'), '');
            await page.waitForTimeout(180);
            assert(Number(await phrase.evaluate(e => getComputedStyle(e).opacity)) > 0);
            const wordmark = await brand.boundingBox();
            const bounds = await phrase.boundingBox();
            const controls = await page.locator('.site-header__controls').boundingBox();
            assert(bounds.x >= 0 && bounds.x + bounds.width <= width);
            if (width < 1100) assert(bounds.y >= wordmark.y + wordmark.height);
            assert(bounds.x + bounds.width <= controls.x || bounds.y >= controls.y + controls.height || bounds.y + bounds.height <= controls.y);
        }
    } finally { await browser.close(); }
});
