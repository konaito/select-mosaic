# /// script
# requires-python = ">=3.10"
# dependencies = ["playwright", "pillow"]
# ///
"""Chrome ウェブストアに載せるスクリーンショット（1280×800）を作る。

Playwright の Chromium に拡張を読み込み、同じフォルダの demo.html（架空のメールの
アカウント設定画面）を開いて、次の3枚を言語ごとに撮る。1・2枚目は、撮ったページに
ポップアップの画像を右上に重ねて合成する。

  <lang>-1-text.png     文字モードで名前、電話番号、APIキーをぼかした画面
  <lang>-2-words.png    常にぼかす文字を4つ登録し、1つをオフにした画面
  <lang>-3-element.png  要素モードで2つの値をぼかし、1つに枠を出した画面

使い方（リポジトリのルートで実行する）:

  uv run --with playwright playwright install chromium   # 初回だけ
  uv run scripts/store-shots/shots.py                    # ja と en を dist/store-shots/ に出す
  uv run scripts/store-shots/shots.py en --out store     # en だけを store/ に直接出す

引数:
  langs        撮る言語。ja と en のどちらか、または両方。省くと両方
  --src        読み込む拡張のフォルダ。既定はこのリポジトリのルート
  --out        画像の出力先。既定は dist/store-shots
  --port       demo.html を配る127.0.0.1のポート。既定は8766

撮影用に、拡張のコピーを作業用の一時フォルダに作って次の2点を変えている。元のファイルは変えない。
  - manifest に host_permissions <all_urls> を足す（service worker からタブに content.js を入れるため）
  - popup.js のタブの探し方を demo.html の URL に変える（ポップアップを別タブで開くため）
en では _locales/ja を外す。macOS の Chromium は --lang で拡張の言語が変わらないので、
ja を外して既定の en を出す。
"""
import argparse
import asyncio
import functools
import http.server
import json
import shutil
import tempfile
import threading
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter
from playwright.async_api import async_playwright

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
# 拡張のコピーに入れないもの。拡張の動作に要らないファイル
IGNORE = shutil.ignore_patterns(".git", "dist", "docs", "store", "scripts", "*.md", ".DS_Store")


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve(port):
    handler = functools.partial(QuietHandler, directory=str(HERE))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def make_ext(src, work, lang, origin):
    d = work / f"ext-{lang}"
    shutil.copytree(src, d, ignore=IGNORE)
    m = json.loads((d / "manifest.json").read_text())
    m["host_permissions"] = ["<all_urls>"]
    (d / "manifest.json").write_text(json.dumps(m, ensure_ascii=False))
    p = d / "popup.js"
    s = p.read_text()
    old = "chrome.tabs.query({ active: true, currentWindow: true })"
    if old not in s:
        raise SystemExit(f"popup.js に {old} が見つからない。タブの探し方が変わったので shots.py を直す")
    p.write_text(s.replace(old, f"chrome.tabs.query({{ url: '{origin}/*' }})"))
    if lang == "en":
        shutil.rmtree(d / "_locales" / "ja")
    return d


def compose(page_png, popup_png, out):
    bg = Image.open(page_png).convert("RGBA")
    pop = Image.open(popup_png).convert("RGBA")
    x, y = bg.width - pop.width - 28, 10
    sh = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((x - 2, y + 4, x + pop.width + 2, y + pop.height + 8), 10, fill=(0, 0, 0, 70))
    bg = Image.alpha_composite(bg, sh.filter(ImageFilter.GaussianBlur(10)))
    mask = Image.new("L", pop.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, pop.width - 1, pop.height - 1), 8, fill=255)
    bg.paste(pop, (x, y), mask)
    ImageDraw.Draw(bg).rounded_rectangle((x, y, x + pop.width - 1, y + pop.height - 1), 8, outline=(220, 220, 225))
    bg.convert("RGB").save(out)


async def run(lang, src, work, out, origin):
    ext = make_ext(src, work, lang, origin)
    async with async_playwright() as p:
        ctx = await p.chromium.launch_persistent_context(
            str(work / f"prof-{lang}"), headless=True, channel="chromium",
            locale=("ja-JP" if lang == "ja" else "en-US"), viewport={"width": 1280, "height": 800},
            args=[f"--disable-extensions-except={ext}", f"--load-extension={ext}", f"--lang={'ja' if lang == 'ja' else 'en-US'}"])
        sw = ctx.service_workers[0] if ctx.service_workers else await ctx.wait_for_event("serviceworker")
        eid = sw.url.split("/")[2]
        page = await ctx.new_page()
        await page.goto(f"{origin}/demo.html#{lang}")
        tabid = await sw.evaluate(
            "async(o)=>{const [t]=await chrome.tabs.query({url:o+'/*'});"
            "await chrome.scripting.executeScript({target:{tabId:t.id},files:['content.js']});return t.id}", origin)

        def msg(m):
            return sw.evaluate("([id,m])=>chrome.tabs.sendMessage(id,m)", [tabid, m])

        async def popup(name):
            pop = await ctx.new_page()
            await pop.set_viewport_size({"width": 260, "height": 800})
            await pop.goto(f"chrome-extension://{eid}/popup.html")
            await pop.wait_for_timeout(400)
            hh = await pop.evaluate("document.querySelector('main').getBoundingClientRect().height")
            await pop.screenshot(path=str(work / f"_pop-{name}.png"), clip={"x": 0, "y": 0, "width": 260, "height": int(hh)})
            await pop.close()

        # 1. 文字モード
        await msg({"type": "set", "mode": "text"})
        for sel in ["#v0", "#v2", "#v4"]:
            await page.evaluate("""s=>{const td=document.querySelector(s);const r=document.createRange();
              r.selectNodeContents(td);
              if(s==='#v0'){r.setStart(td.firstChild, td.firstChild.nodeValue.indexOf('<')+1);r.setEnd(td.firstChild, td.firstChild.nodeValue.indexOf('>'));}
              const g=getSelection();g.removeAllRanges();g.addRange(r);}""", sel)
            await page.wait_for_timeout(300)
        await page.bring_to_front()
        await page.screenshot(path=str(work / "_page1.png"))
        await popup("1")
        compose(work / "_page1.png", work / "_pop-1.png", out / f"{lang}-1-text.png")

        # 2. 常にぼかす文字
        await msg({"type": "set", "mode": None})
        await msg({"type": "clear"})
        words = ["taro.yamada@example.com", "sk-live-4f9a2c7e1b8d6a3f0e5c", "hanako.sato@example.com"]
        await sw.evaluate("async ws=>{for(const w of ws.reverse()) await addWord(w)}", words)
        await sw.evaluate("(w)=>addWord(w)", "山田 太郎" if lang == "ja" else "Taro Yamada")
        await sw.evaluate("()=>toggleWord('hanako.sato@example.com')")
        await page.wait_for_timeout(400)
        await page.bring_to_front()
        await page.screenshot(path=str(work / "_page2.png"))
        await popup("2")
        compose(work / "_page2.png", work / "_pop-2.png", out / f"{lang}-2-words.png")

        # 3. 要素モード
        await sw.evaluate("async()=>{for(const w of await getWords()) await removeWord(w.text)}")
        await page.wait_for_timeout(200)
        await msg({"type": "set", "mode": "element"})
        await page.bring_to_front()
        for sel in ["#v3", "#v5"]:
            await page.click(sel)
        await page.hover("#v1")
        await page.wait_for_timeout(200)
        await page.screenshot(path=str(out / f"{lang}-3-element.png"))
        await ctx.close()


async def main():
    ap = argparse.ArgumentParser(description="Chrome ウェブストア用のスクリーンショットを撮る")
    ap.add_argument("langs", nargs="*", choices=["ja", "en"], default=["ja", "en"])
    ap.add_argument("--src", type=Path, default=REPO)
    ap.add_argument("--out", type=Path, default=REPO / "dist" / "store-shots")
    ap.add_argument("--port", type=int, default=8766)
    a = ap.parse_args()
    a.out.mkdir(parents=True, exist_ok=True)
    httpd = serve(a.port)
    origin = f"http://127.0.0.1:{a.port}"
    try:
        with tempfile.TemporaryDirectory(prefix="smz-shots-") as tmp:
            for lang in a.langs:
                await run(lang, a.src.resolve(), Path(tmp), a.out.resolve(), origin)
                print(f"{lang}: {a.out}/{lang}-{{1-text,2-words,3-element}}.png")
    finally:
        httpd.shutdown()


asyncio.run(main())
