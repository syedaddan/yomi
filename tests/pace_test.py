import asyncio
from playwright.async_api import async_playwright

OUT = 'http://127.0.0.1:5173/'


async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch()
        page = await browser.new_page(viewport={'width': 1100, 'height': 900})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.goto(OUT)
        await page.click('[data-page="pacer"]')
        await page.click('[data-setting="pace"]')
        await page.evaluate("""() => {
          const slider = document.querySelector('#pace-rate');
          slider.value = '8';
          slider.dispatchEvent(new Event('input', { bubbles: true }));
        }""")
        count = await page.locator('.pm').count()
        await page.click('#pace-go')
        await page.wait_for_timeout(600)
        current = await page.locator('.pm.now').count()
        done = await page.locator('.pm.done').count()
        print('moras:', count, 'current highlight:', current, 'completed highlights:', done)
        assert count > 0 and current == 1 and done > 0, 'pacer did not advance its highlights'
        await page.click('#pace-go')
        original = await page.inner_text('#pace-text')
        await page.click('#pace-next')
        next_phrase = await page.inner_text('#pace-text')
        await page.click('#pace-prev')
        returned = await page.inner_text('#pace-text')
        print('next phrase changes:', next_phrase != original, 'previous returns to original:', returned == original)
        assert next_phrase != original and returned == original
        assert not errors, errors
        await browser.close()


asyncio.run(main())
