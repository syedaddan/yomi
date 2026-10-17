import asyncio, json
from playwright.async_api import async_playwright
OUT='http://127.0.0.1:5173/'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']); pg=await b.new_page(viewport={'width':1100,'height':900})
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.on('console',lambda m: errs.append('C:'+m.text) if m.type=='error' and 'ERR_' not in m.text and 'fonts' not in m.text else None)
        await pg.goto(OUT); await pg.wait_for_selector('#stage .word')
        # 1) katakana-only deck: audio source on reveal
        await pg.click('[data-setting="decks"]')
        await pg.click('[data-deck="hira"]')
        await pg.click('#reveal'); await pg.wait_for_selector('[data-play="main"]')
        print('voice info:', (await pg.locator('.voice-row .info-tooltip').inner_text())[:110])
        src=await pg.evaluate("""() => new Promise(r=>{ const o=window.Audio; window.__src=null; window.Audio=function(s){ window.__src=s; return new o(s); }; document.querySelector('[data-play="main"]').click(); setTimeout(()=>r(window.__src),300); })""")
        print('Play used:', src)
        # 2) pacer with clip: compare highlighted mora vs audio.currentTime at several rates
        await pg.click('[data-page="pacer"]')
        await pg.click('[data-setting="pace"]')
        await pg.click('#pace-speak')
        for rate in ('3','5','8'):
            await pg.evaluate(f"(()=>{{const r=document.querySelector('#pace-rate'); r.value='{rate}'; r.dispatchEvent(new Event('input',{{bubbles:true}}));}})()")
            await pg.evaluate("""() => { window.__a=null; const o=window.Audio; window.Audio=function(s){ const a=new o(s); window.__a=a; return a; }; window.__samples=[]; }""")
            await pg.click('#pace-go')
            await pg.wait_for_timeout(300)
            item=await pg.evaluate("""() => ({n: document.querySelectorAll('.pm').length})""")
            for _ in range(40):
                await pg.wait_for_timeout(80)
                s=await pg.evaluate("""() => { const a=window.__a; const now=[...document.querySelectorAll('.pm')].findIndex(e=>e.classList.contains('now')); return a?[a.currentTime,a.playbackRate,now,a.paused]:null; }""")
                if s: await pg.evaluate("(s)=>window.__samples.push(s)", s)
            samp=await pg.evaluate("window.__samples")
            pb=samp[0][1] if samp else None
            print(f'rate slider {rate}: n moras {item["n"]}, playbackRate {pb:.2f}, samples {len(samp)}, note: {await pg.inner_text("#pace-note")!r}')
            # check monotonic and lag
            seq=[s[2] for s in samp if s[2]>=0]
            print('   highlight index sequence (dedup):', [x for i,x in enumerate(seq) if i==0 or x!=seq[i-1]])
            await pg.wait_for_timeout(1800)
            if await pg.evaluate("document.querySelector('#pace-go').firstChild.textContent")=='Stop ':
                await pg.click('#pace-go')
        print('errors:',errs); await b.close()
asyncio.run(main())
