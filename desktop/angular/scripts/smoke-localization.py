#!/usr/bin/env python3
"""MOCKED browser smoke tests of the existing compiled Angular app, never a live core.

Uses installed Python Playwright (>=1.48) and its cached Chromium; installs nothing.
The loopback static server also rejects proxy traffic. HTTP/WebSocket API fixtures
are intercepted in the browser context; no app code, DOM, or globals are replaced.
"""
import argparse
import copy
import hashlib
import importlib.metadata
import json
import mimetypes
from pathlib import Path
import re
import sys
import threading
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit
from typing import Any

BASE = "/ui/modules/portmaster/"
SUPPORT = "https://support.safing.io/api/v1/"
DEBUG = "MOCKED browser smoke tests\nSynthetic debug data; no machine data collected.\n"
CATEGORY = "safing/portbase:ui:category"
HINT = "safing/portbase:ui:display-hint"


def setting(key, name, value, category) -> dict[str, Any]:
    return dict(Key=key, Name=name, DefaultValue=value, Description="",
                OptType=4 if isinstance(value, bool) else 3 if isinstance(value, int) else 1,
                ExpertiseLevel=0, ReleaseLevel=0, Annotations={CATEGORY: category})


def fixtures():
    # Schema: projects/safing/portmaster-api/src/lib/config.types.ts.
    # Source metadata: service/core/config.go, service/resolver/config.go,
    # service/profile/config.go, base/config/{expertise,release}.go.
    rows = [
        setting("core/locale", "Time and Date Format", "en-GB", "User Interface"),
        setting("core/expertiseLevel", "UI Mode", "user", "User Interface"),
        setting("core/releaseLevel", "Feature Stability", "stable", "Updates"),
        setting("filter/defaultAction", "Default Network Action", "permit", "General"),
        setting("dns/nameserverRetryRate", "Retry Failing DNS Servers", 300, "Servers"),
        setting("spn/enable", "SPN Module", False, "General"),
        setting("history/enable", "Enable Network History", False, "General"),
    ]
    records = {"config:" + row["Key"]: row for row in rows}
    locale = records["config:core/locale"]
    locale["Description"] = "Configures the time and date format for the user interface. Selection is an example and correct formatting in the UI is a continual work in progress."
    locale["Annotations"].update({HINT: "one-of", "safing/portbase:ui:requires-reload": True})
    locale["PossibleValues"] = [{"Name": name, "Value": value, "Description": ""} for name, value in
                                [("24h DD-MM-YYYY", "en-GB"), ("12h MM/DD/YYYY", "en-US")]]
    for key, choices in [
        ("core/expertiseLevel", [("Simple Interface", "user"), ("Advanced Interface", "expert"), ("Developer Interface", "developer")]),
        ("core/releaseLevel", [("Stable", "stable"), ("Beta", "beta"), ("Experimental", "experimental")]),
    ]:
        records["config:" + key]["Annotations"][HINT] = "one-of"
        records["config:" + key]["PossibleValues"] = [{"Name": n, "Value": v, "Description": ""} for n, v in choices]
    records["config:core/releaseLevel"]["ExpertiseLevel"] = 2
    action = records["config:filter/defaultAction"]
    action["Description"] = "The default network action is applied when nothing else allows or blocks a connection. This affects both outgoing and incoming connections. This setting is the weakest of all and is commonly overruled by Force Block settings or Rules."
    action["Annotations"][HINT] = "one-of"
    action["PossibleValues"] = [dict(Name=n, Value=v, Description=d) for n, v, d in [
        ("Allow", "permit", "Allow all connections"), ("Block", "block", "Block all connections"),
        ("Prompt", "ask", "Prompt for decisions")]]
    retry = records["config:dns/nameserverRetryRate"]
    retry.update(Description="Duration in seconds how often failing DNS server should be retried. This is done continuously in the background.",
                 ExpertiseLevel=2, ValidationRegex="^[1-9][0-9]{1,5}$")
    retry["Annotations"].update({"safing/portbase:ui:unit": "seconds", "safing/portbase:ui:order": 32})
    # Actual startup record schemas: services/{ui-state.service,status.types}.ts,
    # portmaster-api/src/lib/spn.types.ts. Empty account/notifications are deliberate.
    records.update({
        "core:ui/v1": {"hideExitScreen": True, "introScreenFinished": True, "netscoutSortOrder": "Static"},
        "core:status/versions": {"Channel": "stable", "Resources": {}, "Core": {
            "Name": "MOCKED core", "Version": "2.2.8", "VersionNumber": "2.2.8", "License": "GPLv3",
            "Source": "mock", "BuildTime": "2026-11-09T00:00:00Z", "CGO": False,
            "Commit": "mock", "CommitTime": "2026-11-09T00:00:00Z", "Dirty": False}},
        "runtime:system/status": {"OnlineStatus": 5, "CaptivePortal": {"URL": "", "IP": "", "Domain": ""},
            "Modules": [], "WorstState": {"Module": "", "ID": "", "Name": "", "Message": "", "Type": "", "Data": None}},
        "runtime:spn/status": {"Status": "disabled", "HomeHubID": "", "HomeHubName": "", "ConnectedIP": "",
            "ConnectedTransport": "", "ConnectedCountry": None, "ConnectedSince": None},
    })
    return records


FORMS = [
    ("report-bug", "报告问题", [("What happened?", "发生了什么？"),
        ("What did you expect to happen?", "您期望发生什么？"),
        ("How did you reproduce it?", "如何复现问题？"), ("Additional information", "补充信息")]),
    ("give-feedback", "提出改进建议", [("What would you like to add or change?", "您希望添加或更改什么？"),
        ("Why do you and others need this?", "您和其他用户为什么需要这项改进？")]),
    ("compatibility-report", "提交兼容性报告", [("What worked?", "哪些功能正常？"),
        ("What did not work?", "哪些功能异常？"), ("Additional information", "补充信息")]),
]


def run(args):
    from playwright.sync_api import sync_playwright, expect

    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    dist = args.dist.resolve()
    index = dist / "index.html"
    assert index.is_file(), f"Missing compiled Angular app: {index}; this harness does not build it."
    entry = index.read_text(encoding="utf-8")
    assert 'lang="zh-CN"' in entry and f'<base href="{BASE}">' in entry, "Expected the localized production dist, not the dev server"
    scripts = re.findall(r'<script[^>]+src="([^"]+)"', entry)
    assert scripts and all((dist / name).is_file() for name in scripts), "Incomplete compiled dist"
    hashes = {name: hashlib.sha256((dist / name).read_bytes()).hexdigest() for name in ["index.html", *scripts]}
    records = fixtures()
    baseline = copy.deepcopy(records)
    log = {"label": "MOCKED browser smoke tests", "status": "running", "dist": str(dist), "bundle_sha256": hashes,
           "python": sys.executable, "playwright": importlib.metadata.version("playwright"),
           "checks": [], "console": [], "page_errors": [], "http": [], "websocket": [], "writes": [],
           "tickets": [], "uploads": [], "unmocked": [], "proxy_denied": [], "screenshots": [],
           "limits": ["Existing compiled dist only; source changes after this build are not exercised.",
                      "Mock core/support APIs, empty network/account state; no real service, OS, driver, account or delivery integration.",
                      "Seven representative setting records, not all 76 registered options; session restoration is in-app navigation, not a reload."]}

    class StaticServer(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def do_CONNECT(self):
            log["proxy_denied"].append(self.path)
            self.send_error(403, "No forwarding")

        def do_GET(self):
            url = urlsplit(self.path)
            if url.scheme or url.netloc:
                log["proxy_denied"].append(self.path)
                self.send_error(403, "No forwarding")
                return
            path = unquote(url.path)
            if path.startswith(BASE):
                relative = path[len(BASE):]
                if relative in ("", "settings", "support", *("support/" + form[0] for form in FORMS)):
                    relative = "index.html"
            elif path.startswith("/assets/"):
                relative = path.lstrip("/")
            else:
                self.send_error(404)
                return
            file = (dist / relative).resolve()
            if not file.is_relative_to(dist) or not file.is_file():
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header("Content-Type", mimetypes.guess_type(file)[0] or "application/octet-stream")
            self.send_header("Content-Length", str(file.stat().st_size))
            self.end_headers()
            try:
                self.wfile.write(file.read_bytes())
            except (BrokenPipeError, ConnectionResetError):
                pass

        def do_POST(self):
            log["unmocked"].append("Server rejected POST " + self.path)
            self.send_error(403, "Static only; no live API")

    server = ThreadingHTTPServer(("127.0.0.1", 0), StaticServer)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = f"http://127.0.0.1:{server.server_port}"
    log["origin"] = origin
    subscriptions = {}

    def mock_ws(ws):
        if ws.url != origin.replace("http:", "ws:") + "/api/database/v1":
            log["unmocked"].append("WebSocket " + ws.url)
            ws.close(code=1008, reason="Unmocked socket blocked")
            return

        def send(id_, kind, key=None, data=None):
            message = f"{id_}|{kind}"
            if key is not None:
                message += f"|{key}|J" + json.dumps(data, ensure_ascii=False, separators=(",", ":"))
            ws.send(message)

        def message(raw):
            id_ = "0"
            try:
                # Wire protocol is id|type|key-or-query|Jjson, including literal pipes in JSON.
                parts = (raw.decode() if isinstance(raw, bytes) else raw).split("|", 3)
                id_, method = parts[:2]
                key = parts[2].removeprefix("query ") if len(parts) > 2 else ""
                log["websocket"].append({"id": id_, "method": method, "key": key})
                if method == "cancel":
                    subscriptions.pop(id_, None)
                    return
                if method == "update":
                    assert key in ("config:dns/nameserverRetryRate", "config:filter/defaultAction"), f"Unexpected write: {key}"
                    assert parts[3].startswith("J")
                    data = json.loads(parts[3][1:])
                    assert {k: v for k, v in data.items() if k != "Value"} == baseline[key], "Translated/mutated machine metadata in config update"
                    if "Value" in data:
                        if key.endswith("nameserverRetryRate"):
                            assert type(data["Value"]) is int and data["Value"] == 301
                        else:
                            assert data["Value"] in ("permit", "block", "ask"), "Choice machine value was translated"
                    log["writes"].append({"key": key, "data": data})
                    records[key] = copy.deepcopy(data)
                    send(id_, "success")
                    for subid, query in list(subscriptions.items()):
                        if key.startswith(query):
                            send(subid, "upd", key, data)
                    return
                assert method in ("get", "query", "qsub", "sub"), f"Unsupported WebSocket method {method}"
                empty = key in ("core:spn/account/user", "runtime:modules/core/event/shutdown", "runtime:modules/core/event/restart") or key.startswith("notifications:all/")
                assert key in records or key == "config:" or empty, f"Missing WebSocket fixture: {method} {key}"
                if method in ("qsub", "sub"):
                    subscriptions[id_] = key
                if method != "sub":
                    for record_key, value in records.items():
                        if (record_key == key if method == "get" else record_key.startswith(key)):
                            send(id_, "ok", record_key, value)
                if method != "get":
                    send(id_, "done")
            except Exception as error:
                log["unmocked"].append(str(error))
                ws.send(f"{id_}|error|MOCKED boundary: {error}")

        ws.on_message(message)

    def mock_http(route):
        req = route.request
        url = urlsplit(req.url)
        log["http"].append({"method": req.method, "url": req.url})
        try:
            if req.url.startswith(origin + "/"):
                if req.method == "GET" and (url.path.startswith(BASE) or url.path.startswith("/assets/")):
                    route.continue_()
                    return
                if req.method == "POST" and url.path == "/api/v1/netquery/query/batch":
                    queries = req.post_data_json
                    assert set(queries) == {"verdicts", "conns", "identities"}, "Unexpected netquery batch"
                    route.fulfill(json={key: [] for key in queries})
                    return
                if req.method == "GET" and url.path == "/api/v1/intel/geoip/countries":
                    # CountryListResponse is an ISO-A2 keyed object, not an array.
                    route.fulfill(json={})
                    return
                if req.method == "GET" and url.path == "/api/v1/debug/core" and url.query == "style=github":
                    route.fulfill(content_type="text/plain", body=DEBUG)
                    return
            if req.url.startswith(SUPPORT):
                headers = {"Access-Control-Allow-Origin": origin}
                if req.method == "GET" and req.url == SUPPORT + "issues":
                    route.fulfill(json={"issues": []}, headers=headers)
                    return
                if req.method == "POST" and req.url == SUPPORT + "upload":
                    body = req.post_data_buffer.decode("utf-8")
                    assert 'name="file"; filename="debug-info"' in body and DEBUG in body
                    log["uploads"].append(body)
                    route.fulfill(json={"urls": {"file": [origin + "/mock/debug-info"]}}, headers=headers)
                    return
                if req.method == "POST" and req.url in (SUPPORT + "ticket", SUPPORT + "issues/portmaster/suggest-feature.md"):
                    log["tickets"].append({"url": req.url, "data": req.post_data_json})
                    if req.url.endswith("/ticket"):
                        route.fulfill(status=204, body="", headers=headers)
                    else:
                        route.fulfill(json={"url": origin + "/mock/issue"}, headers=headers)
                    return
            raise AssertionError(f"Unmocked HTTP request blocked: {req.method} {req.url}")
        except Exception as error:
            log["unmocked"].append(str(error))
            route.abort("blockedbyclient")

    browser = context = page = None
    try:
        with sync_playwright() as playwright:
            try:
                executable = args.browser.resolve() if args.browser else Path(playwright.chromium.executable_path)
                assert executable.is_file(), f"Missing cached browser: {executable}; pass --browser with an installed Chromium executable. No download attempted."
                log["browser_executable"] = str(executable)
                browser = playwright.chromium.launch(headless=True, executable_path=str(executable),
                    proxy={"server": origin, "bypass": "127.0.0.1"},
                    args=["--disable-background-networking", "--disable-quic", "--force-webrtc-ip-handling-policy=disable_non_proxied_udp"])
                log["browser_version"] = browser.version
                context = browser.new_context(viewport={"width": 1440, "height": 1080}, locale="zh-CN", service_workers="block", accept_downloads=False)
                context.route("**/*", mock_http)
                context.route_web_socket("**/*", mock_ws)
                page = context.new_page()
                page.set_default_timeout(12000)
                page.on("console", lambda msg: log["console"].append({"type": msg.type, "text": msg.text}))
                page.on("pageerror", lambda error: log["page_errors"].append(str(error)))
                page.on("dialog", lambda dialog: dialog.dismiss())

                def screenshot(name):
                    path = output / (name + ".png")
                    page.screenshot(path=str(path), full_page=True)
                    log["screenshots"].append(str(path))

                page.goto(origin + BASE + "settings", wait_until="networkidle")
                expect(page.get_by_role("heading", name="全局设置", exact=True)).to_be_visible()
                expect(page.locator('app-generic-setting[id="core/locale"] h3')).to_have_text("时间和日期格式")
                expect(page.locator('app-generic-setting[id="filter/defaultAction"] h3')).to_have_text("默认网络操作")
                screenshot("01-settings")
                log["checks"].append("Compiled zh-CN Angular app bootstraps using mocked HTTP/WebSocket schemas; Chinese setting names render")
                if args.inspect:
                    (output / "inspect.txt").write_text(page.locator("body").inner_text() + "\n\n" + page.locator("input, sfng-select, app-navigation [routerlink]").evaluate_all("nodes => nodes.map(n => n.outerHTML).join('\\n')"), encoding="utf-8")
                else:
                    exercise(page, expect, records, baseline, log, screenshot)
                assert not log["unmocked"], log["unmocked"]
                assert not log["page_errors"], log["page_errors"]
                assert not [item for item in log["console"] if item["type"] == "error"], log["console"]
                assert hashes == {name: hashlib.sha256((dist / name).read_bytes()).hexdigest() for name in hashes}, "Compiled dist changed during run; rerun against a stable build"
                log["checks"].append("No browser console errors, page errors, unmocked app requests, or dist mutations")
                log["status"] = "INSPECT ONLY" if args.inspect else "PASS"
            except Exception:
                if page and not page.is_closed():
                    try:
                        screenshot("failure")
                        (output / "failure.txt").write_text(page.locator("body").inner_text(), encoding="utf-8")
                    except Exception:
                        pass
                raise
            finally:
                try:
                    if context:
                        context.close()
                finally:
                    if browser:
                        browser.close()
    except Exception:
        log["status"] = "FAIL"
        log["error"] = traceback.format_exc()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)
        log["loopback_server_closed"] = not thread.is_alive()
        (output / "smoke-localization.json").write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"label": log["label"], "status": log["status"], "checks": log["checks"],
                      "log": str(output / "smoke-localization.json"), "error": log.get("error")}, ensure_ascii=False, indent=2))
    return int(log["status"] == "FAIL")


def await_mock(page, predicate):
    # Pump Playwright events while waiting for a local mock callback, not a fixed sleep.
    for _ in range(100):
        if predicate():
            return
        page.wait_for_timeout(50)
    raise AssertionError("Expected request did not reach the local mock boundary within 5 seconds")


def exercise(page, expect, records, baseline, log, screenshot):
    expect(page.locator("html")).to_have_attribute("lang", "zh-CN")
    search = page.locator('.main .header input[placeholder="搜索"]')
    rows = page.locator("app-settings-view app-generic-setting")
    action = page.locator('app-generic-setting[id="filter/defaultAction"]')
    search.fill("默认")
    expect(rows).to_have_count(1)
    expect(action.locator("h3")).to_have_text("默认网络操作")
    assert records == baseline and not log["writes"], "Search must be read-only"
    screenshot("02-two-character-search")
    log["checks"].append("Two-character Chinese search filters by translated display text without changing keys or values")

    for label, value in [("阻止", "block"), ("询问", "ask")]:
        action.locator("sfng-select button").click()
        choices = page.locator(".sfng-select-dropdown li")
        expect(choices).to_have_count(3)
        assert {text.strip() for text in choices.all_text_contents()} == {"允许", "阻止", "询问"}
        if value == "block":
            screenshot("03-localized-choices")
        count = len(log["writes"])
        choices.get_by_text(label, exact=True).click()
        await_mock(page, lambda: len(log["writes"]) == count + 1)
        assert log["writes"][-1]["data"]["Value"] == value
        expect(action.locator("sfng-select button")).to_have_text(label)
        action.get_by_text("重置为系统默认值", exact=True).click()
        await_mock(page, lambda: len(log["writes"]) == count + 2)
        expect(action.locator("sfng-select button")).to_have_text("允许")
        assert "Value" not in log["writes"][-1]["data"]
        assert records == baseline
    log["checks"].append("Chinese Allow/Block/Prompt choices keep permit/block/ask machine codes; reset omits Value and restores defaults")

    search.fill("重试")
    expect(rows).to_have_count(1)
    retry = page.locator('app-generic-setting[id="dns/nameserverRetryRate"]')
    expect(retry.locator("h3")).to_have_text("重试故障 DNS 服务器")
    expect(retry.locator(".suffix")).to_have_text("秒")
    number = retry.locator('input[type="number"]')
    expect(number).to_have_value("300")
    count = len(log["writes"])
    number.fill("301")
    assert len(log["writes"]) == count, "Uncommitted text edit unexpectedly submitted"
    number.press("Tab")
    await_mock(page, lambda: len(log["writes"]) == count + 1)
    expect(retry.get_by_text("已保存", exact=True)).to_be_visible()
    assert log["writes"][-1]["data"]["Value"] == 301
    screenshot("04-numeric-edit")
    retry.get_by_text("重置为系统默认值", exact=True).click()
    await_mock(page, lambda: len(log["writes"]) == count + 2)
    expect(number).to_have_value("300")
    assert records == baseline
    search.fill("不存在的设置")
    expect(rows).to_have_count(0)
    search.fill("")
    expect(action.locator("h3")).to_have_text("默认网络操作")
    assert len(log["writes"]) == 6 and records == baseline
    log["checks"].append("Developer setting is reachable by two-character search; numeric edit commits on blur, Chinese save/unit/reset render, all mock config is restored")
    exercise_forms(page, expect, log, screenshot)
    page.locator('app-navigation [routerlink="settings"]').click()
    expect(page.get_by_role("heading", name="全局设置", exact=True)).to_be_visible()
    expect(action.locator("sfng-select button")).to_have_text("允许")
    assert records == baseline, "Machine-facing config did not end at the original fixture values"
    log["checks"].append("Settings/support navigation round trip retains unchanged mock machine configuration; no real machine configuration was accessed")


def exercise_forms(page, expect, log, screenshot):
    def open_form(card):
        page.locator('app-navigation [routerlink="support"]').click()
        page.wait_for_load_state("networkidle")
        page.locator(".option-list section").filter(has=page.get_by_role("heading", name=re.compile(card))).click()
        page.wait_for_load_state("networkidle")
        expect(page.locator(".form-wrapper h1").first).to_contain_text(card)

    for index, (id_, card, questions) in enumerate(FORMS):
        open_form(card)
        expect(page).to_have_url(log["origin"] + BASE + "support/" + id_)
        title = page.get_by_placeholder("简要概述问题", exact=True)
        sections = page.locator(".form-wrapper section")
        expect(sections.locator("h3")).to_have_text([label for _, label in questions])
        expect(title).to_have_value("")
        count = len(log["tickets"])
        page.get_by_role("button", name="发送私密工单", exact=True).click()
        expect(title).to_have_class(re.compile("missing"))
        assert len(log["tickets"]) == count, "Empty-title validation should not submit"
        title_text = "MOCKED 中文报告 | " + id_
        title.fill(title_text)
        expected_sections = []
        for i, (stable, _) in enumerate(questions):
            body = f"MOCKED 中文回答 {i}: dot://dns.example.invalid?ip=192.0.2.1 | {stable}"
            sections.nth(i).locator("textarea").fill(body)
            expected_sections.append({"title": stable, "body": body})
        if id_ != "give-feedback":
            expect(page.locator(".form-wrapper > textarea")).to_have_value(DEBUG)
        screenshot(f"05-{id_}-questions")

        # SessionDataService is in-memory, so navigate rather than reload the app.
        page.locator('app-navigation [routerlink="settings"]').click()
        expect(page.get_by_role("heading", name="全局设置", exact=True)).to_be_visible()
        open_form(card)
        expect(title).to_have_value(title_text)
        for i, expected in enumerate(expected_sections):
            expect(sections.nth(i).locator("textarea")).to_have_value(expected["body"])
        log["checks"].append(id_ + ": Chinese question labels and in-app session draft restoration")

        page.get_by_role("button", name="发送私密工单", exact=True).click()
        page.get_by_role("button", name="取消", exact=True).click()
        assert len(log["tickets"]) == count, "Cancelled confirmation should not submit"
        page.get_by_role("button", name="发送私密工单", exact=True).click()
        page.get_by_placeholder("电子邮箱（可选）", exact=True).fill("smoke@example.invalid")
        page.get_by_role("button", name="创建工单", exact=True).click()
        expect(page.get_by_text("工单创建成功！", exact=True)).to_be_visible()
        assert len(log["tickets"]) == count + 1
        assert log["tickets"][-1] == {"url": SUPPORT + "ticket", "data": {
            "title": title_text, "sections": expected_sections, "email": "smoke@example.invalid", "repoName": "portmaster",
            "debugInfoUrl": "" if id_ == "give-feedback" else log["origin"] + "/mock/debug-info"}}
        screenshot(f"06-{id_}-mock-ticket")
        page.get_by_role("button", name="关闭", exact=True).click()
        open_form(card)
        expect(title).to_have_value("")
        for i in range(len(questions)):
            expect(sections.nth(i).locator("textarea")).to_have_value("")
        log["checks"].append(id_ + ": validation/cancel are non-submitting; mock ticket retains English section titles and API fields, successful submit clears the draft")

    # Also verify the stable GitHub preset/repository path; never open its returned URL.
    _, card, questions = FORMS[1]
    open_form(card)
    page.get_by_placeholder("简要概述问题", exact=True).fill("MOCKED GitHub 建议")
    expected_sections = []
    for i, (stable, _) in enumerate(questions):
        body = "MOCKED 改进建议 " + str(i)
        page.locator(".form-wrapper section textarea").nth(i).fill(body)
        expected_sections.append({"title": stable, "body": body})
    page.get_by_role("button", name="在 GitHub 上创建", exact=True).click()
    page.get_by_role("button", name="不使用账号创建", exact=True).click()
    expect(page.get_by_text("工单创建成功！", exact=True)).to_be_visible()
    assert len(log["tickets"]) == 4 and len(log["uploads"]) == 2
    assert log["tickets"][-1] == {"url": SUPPORT + "issues/portmaster/suggest-feature.md", "data": {
        "title": "MOCKED GitHub 建议", "sections": expected_sections, "debugInfoUrl": ""}}
    screenshot("07-mock-github-ticket")
    page.get_by_role("button", name="关闭", exact=True).click()
    log["checks"].append("GitHub submission is intercepted locally with unchanged portmaster/suggest-feature.md path and stable sections; debug uploads contain only the synthetic fixture")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dist", type=Path, default=Path(__file__).resolve().parent.parent / "dist", help="Existing zh-CN compiled Angular dist; never rebuilt")
    parser.add_argument("--output", type=Path, required=True, help="Directory for screenshots and JSON/diagnostic logs")
    parser.add_argument("--browser", type=Path, help="Existing Chromium executable, otherwise the installed Playwright cache")
    parser.add_argument("--inspect", action="store_true", help="Bootstrap and capture the actual DOM only, not the interaction suite")
    args = parser.parse_args()
    if not __debug__:
        parser.error("Assertions are required; do not run Python with -O")
    try:
        return run(args)
    except ModuleNotFoundError as error:
        parser.error(f"Missing installed Python module: {error.name}; use a Python environment with Playwright >=1.48. Nothing was installed.")
    except Exception as error:
        parser.error(str(error))


if __name__ == "__main__":
    sys.exit(main())
