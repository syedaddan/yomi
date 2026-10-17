import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files','--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':1100,'height':900})
        errs=[]; pg.on('console', lambda m: errs.append(m.text) if 'female' in m.text else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        await pg.goto('http://127.0.0.1:5173/'); await pg.wait_for_selector('#stage .word')
        w1 = await pg.inner_text('#stage .word')
        print('back disabled at start:', await pg.locator('#nav-back').is_disabled())
        await pg.click('#reveal'); await pg.click('[data-rate="got"]'); await pg.wait_for_selector('#reveal')
        w2 = await pg.inner_text('#stage .word')
        await pg.keyboard.press('ArrowLeft'); await pg.wait_for_selector('.pitchline')
        print('back shows first card revealed:', w1 in await pg.inner_text('#stage'), 'rated note:', await pg.locator('.rated-note').count())
        s = await pg.inner_text('.session'); print('session after back:', s.replace('\n',' '))
        await pg.keyboard.press('ArrowRight'); await pg.wait_for_selector('#reveal')
        print('forward returns to 2nd card:', w2 == await pg.inner_text('#stage .word'))
        await pg.keyboard.press('ArrowRight'); await pg.wait_for_selector('#reveal')   # skip
        print('skip -> new card; session:', (await pg.inner_text('.session')).replace('\n',' '))
        # female voice
        await pg.click('#reveal'); await pg.click('[data-voice="female"]'); await pg.wait_for_selector('.audio-cap')
        print('caption:', (await pg.inner_text('.audio-cap'))[:60])
        await pg.click('[data-play="main"]'); await pg.wait_for_timeout(1500); print('toast after play:', await pg.inner_text('#toast'))
        ok = await pg.evaluate("curAudio && curAudio.src.startsWith('blob:')") if False else None
        # pacer female
        await pg.click('[data-page="pacer"]')
        assert pg.url.endswith('/pacer.html'), f'expected separate pacer URL, got {pg.url}'
        assert await pg.locator('.panel').count() == 1
        assert await pg.locator('#page-drill').count() == 0
        await pg.click('#pace-speak')
        assert await pg.locator('#pace-speak').get_attribute('aria-pressed') == 'true'
        await pg.click('#pace-go'); await pg.wait_for_timeout(900)
        print('pacer female now/done:', await pg.locator('.pm.now').count(), await pg.locator('.pm.done').count(), 'note:', await pg.inner_text('#pace-note'))
        await pg.click('#pace-go')
        t0=await pg.inner_text('#pace-text'); await pg.click('#pace-next'); await pg.click('#pace-prev')
        print('prev returns:', t0==await pg.inner_text('#pace-text'))
        await pg.screenshot(path='shot_pacer2.png')
        await pg.click('[data-page="drill"]')
        assert pg.url.endswith('/index.html'), f'expected separate drill URL, got {pg.url}'
        assert await pg.locator('.panel').count() == 1
        await pg.screenshot(path='shot_nav.png')
        print('errors', errs); await b.close()
asyncio.run(main())
