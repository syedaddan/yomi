import asyncio, sys
from playwright.async_api import async_playwright
OUT='http://127.0.0.1:5173/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width':1100,'height':900})
        errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        pg.on('console', lambda m: errs.append('CONSOLE '+m.text) if m.type=='error' and 'fonts' not in m.text and 'ERR_' not in m.text else None)
        await pg.goto(OUT)
        await pg.wait_for_selector('#stage .word')
        # read mode: reveal and rate
        for i in range(3):
            await pg.click('#reveal'); await pg.wait_for_selector('.pitchline')
            n_h = await pg.locator('.m.H').count(); n_l = await pg.locator('.m.L').count()
            print('reveal', i, 'H moras', n_h, 'L moras', n_l)
            if i==0: await pg.screenshot(path='shot_reveal.png')
            await pg.click('[data-rate="got"]'); await pg.wait_for_selector('#reveal')
        # phrases deck
        await pg.click('[data-setting="decks"]')
        await pg.click('[data-deck="phr"]'); await pg.click('[data-deck="hira"]'); await pg.click('[data-deck="kata"]')
        await pg.wait_for_selector('#stage .word.phrase')
        await pg.click('#reveal'); await pg.wait_for_selector('.pitchline.phrase'); await pg.screenshot(path='shot_phrase.png')
        # flash mode
        await pg.click('[data-mode="flash"]'); await pg.wait_for_selector('.timer-bar'); await pg.wait_for_selector('.word.masked', timeout=5000); print('flash masks ok')
        # sprint
        await pg.click('[data-mode="sprint"]'); await pg.click('#sprint-go')
        for i in range(5): await pg.keyboard.press('Space')
        await pg.keyboard.press('x'); print('sprint counter:', await pg.inner_text('.sprint-head .mono'))
        await pg.screenshot(path='shot_sprint.png')
        # pacer
        await pg.click('[data-page="pacer"]'); await pg.click('#pace-go'); await pg.wait_for_timeout(700)
        print('pacer now:', await pg.locator('.pm.now').count(), 'done:', await pg.locator('.pm.done').count()); await pg.screenshot(path='shot_pacer.png')
        await pg.click('#pace-go')
        # look-alikes
        await pg.click('[data-page="alike"]'); await pg.click('#alike-go')
        for i in range(20):
            await pg.wait_for_selector('.choices button'); await pg.keyboard.press('1'); await pg.wait_for_timeout(1250)
        print('alike summary:', (await pg.inner_text('#alike-stage')).replace('\n',' | ')[:160]); await pg.screenshot(path='shot_alike.png')
        # progress + kanji
        await pg.click('[data-page="progress"]'); await pg.wait_for_selector('#progress-body .card'); await pg.screenshot(path='shot_progress.png', full_page=True)
        await pg.click('[data-page="kanji"]')
        # phone width overflow check
        await pg.set_viewport_size({'width':390,'height':800})
        for t in ['drill','pacer','alike','progress','kanji']:
            await pg.click(f'[data-page="{t}"]')
            assert await pg.locator('.panel').count() == 1, f'{t} page rendered other sections'
            assert await pg.locator(f'#page-{t}').is_visible(), f'{t} page did not render'
            assert not pg.url.endswith('.html'), f'{t} route still exposes an HTML extension: {pg.url}'
            sw = await pg.evaluate('document.documentElement.scrollWidth'); cw = await pg.evaluate('document.documentElement.clientWidth')
            assert sw == cw, f'{t} page overflows at phone width: {sw} > {cw}'
            print('phone', t, 'scrollWidth', sw, 'clientWidth', cw)
        await pg.click('[data-page="drill"]'); await pg.locator('[data-mode="read"]').click(); await pg.wait_for_selector('#reveal'); await pg.click('#reveal'); await pg.screenshot(path='shot_phone.png')
        print('ERRORS:', errs)
        await b.close()
asyncio.run(main())
