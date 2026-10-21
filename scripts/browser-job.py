"""Read-only Selenium collection in a separate browser. No user profile or form input."""
import json, os, sys, time
from pathlib import Path
from urllib.parse import urlparse
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "artifacts" / "browser-tools"))
from selenium import webdriver

def safe_url(value):
    parsed = urlparse(value)
    if parsed.scheme not in ("http", "https") or parsed.username or parsed.password:
        return False
    if parsed.hostname in ("localhost", "127.0.0.1", "::1") and os.getenv("YTMIND_BROWSER_TEST") != "1":
        return False
    return True

request = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8-sig"))
options = webdriver.ChromeOptions()
options.add_argument("--headless=new")
options.add_argument("--window-size=1365,1000")
options.add_argument("--disable-notifications")
options.add_experimental_option("prefs", {"download_restrictions": 3, "profile.default_content_setting_values.notifications": 2})
options.page_load_strategy = "eager"
driver = None
try:
    driver = webdriver.Chrome(options=options)
    driver.set_page_load_timeout(35)
    for index, url in enumerate(request["urls"]):
        result = {"requestedURL": url, "status": "failed"}
        try:
            if not safe_url(url):
                raise ValueError("Unsupported website address.")
            driver.get(url)
            time.sleep(1)
            if not safe_url(driver.current_url):
                raise ValueError("The page redirected to an unsupported address.")
            result.update({"url": driver.current_url, "title": driver.title})
            if driver.find_elements("css selector", 'input[type="password"],input[autocomplete^="cc-"]'):
                result.update(status="unavailable", reason="A private or payment form was detected; nothing was collected.")
            else:
                data = driver.execute_script("""
                  const root=(document.querySelector('article')||document.querySelector('main')||document.body).cloneNode(true);
                  root.querySelectorAll('script,style,noscript,iframe,object,embed,form,input,textarea,select,[contenteditable],[hidden],[aria-hidden="true"]').forEach(e=>e.remove());
                  root.querySelectorAll('*').forEach(e=>{for(const a of [...e.attributes]){if(!['href','class','colspan','rowspan'].includes(a.name)) e.removeAttribute(a.name);}if(e.hasAttribute('href')){try{const u=new URL(e.getAttribute('href'),location.href);if(!/^https?:$/.test(u.protocol)||u.username||u.password)e.removeAttribute('href');else{u.search='';u.hash='';e.setAttribute('href',u.href);}}catch{e.removeAttribute('href');}}});
                  for(const a of [...root.attributes])root.removeAttribute(a.name);
                  return {html:root.outerHTML.slice(0,1000000),text:root.textContent.replace(/\\s+/g,' ').trim().slice(0,60000),
                    headings:[...root.querySelectorAll('h1,h2,h3')].map(e=>e.textContent.trim()).slice(0,300),
                    links:[...root.querySelectorAll('a[href]')].map(e=>({label:e.textContent.trim(),url:new URL(e.getAttribute('href'),location.href).href})).filter(e=>/^https?:/.test(e.url)).slice(0,1000),
                    tables:[...root.querySelectorAll('table')].slice(0,30).map(t=>[...t.rows].slice(0,300).map(r=>[...r.cells].map(c=>c.textContent.trim())))};
                """)
                if "just a moment" in driver.title.lower() or "performing security verification" in data["text"].lower():
                    result.update(status="unavailable", reason="A security verification page prevented collection.")
                else:
                    mode = request["mode"]
                    result.update(status="complete", **({"links":data["links"]} if mode=="links" else {"tables":data["tables"]} if mode=="tables" else {"html":data["html"]} if mode=="html" else data))
        except Exception as error:
            result["reason"] = str(error).split("Stacktrace:")[0][:350]
        print(json.dumps({"type":"page","index":index,"result":result},ensure_ascii=True), flush=True)
except Exception:
    print(json.dumps({"type":"error","message":"The browser could not start. Check Selenium setup and the installed Chrome browser."}), flush=True)
    sys.exit(1)
finally:
    if driver:
        driver.quit()
