import asyncio
from playwright.async_api import async_playwright

url = "http://127.0.0.1:8080/login"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width":1440,"height":900})
        await page.goto(url, wait_until="networkidle")
        await page.wait_for_timeout(1000)
        await page.screenshot(path="/home/gt/projects/my/kubernetes-defaults/vless-mesh/web/ui-shot.png", full_page=True)
        await browser.close()

asyncio.run(main())
