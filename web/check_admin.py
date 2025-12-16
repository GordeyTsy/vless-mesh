import asyncio
from playwright.async_api import async_playwright

ADMIN_URL = "http://127.0.0.1:8001/admin/login/"
USER = "root"
PASS = "eib1flYD2nIvCoIJnNxQNQ"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width":1280,"height":900})
        await page.goto(ADMIN_URL, wait_until="networkidle")
        await page.fill('input#id_username', USER)
        await page.fill('input#id_password', PASS)
        await page.click('input[type=submit]')
        await page.wait_for_load_state("networkidle")
        await page.screenshot(path="/home/gt/projects/my/kubernetes-defaults/vless-mesh/web/admin-shot.png", full_page=True)
        await browser.close()

asyncio.run(main())
