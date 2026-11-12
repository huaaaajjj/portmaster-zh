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
from urllib.parse import parse_qs, unquote, urlsplit
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
    # portmaster-api/src/lib/spn.types.ts. Account stays empty; notification actions follow Go definitions.
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
        "notifications:all/resolver:suggest-using-stale-cache": {
            "EventID": "resolver:suggest-using-stale-cache", "GUID": "mock-notification", "Type": 0,
            "Title": "MOCKED DNS performance notice", "Message": "MOCKED notification body", "Category": "",
            "EventData": None, "Expires": 0, "State": "active", "SelectedActionID": "",
            "AvailableActions": [
                {"ID": "", "Text": "Open Setting", "Type": "open-setting", "Visibility": "in-app-only",
                    "Payload": {"Key": "dns/useStaleCache", "Profile": ""}},
                {"ID": "suppress", "Text": "Don't show again", "Type": "", "Visibility": "detailed", "Payload": None},
                {"ID": "ack", "Text": "Got it!", "Type": "", "Visibility": "", "Payload": None},
            ],
        },
    })
    base_notice = records["notifications:all/resolver:suggest-using-stale-cache"]
    for event_id, title, message in [
        ("interop:ivpn-old-version", "IVPN Client Compatibility Notice", "Portmaster has detected the IVPN Client, but the installed version may not be fully compatible when running alongside Portmaster. Some features may not work as expected. Please consider updating to the latest version of the IVPN Client."),
        ("updates:no-new-update", "Portmaster Is Up-To-Date*", 'While Portmaster v2.2.8-beta.1 is the newest version, there is an internal issue with checking for updates: MOCKED <span id="notification-injected">raw</span> & **details** {{TOKEN}}'),
        ("broadcasts:mock", "MOCKED broadcast", "Portmaster did not detect any network connectivity."),
    ]:
        records["notifications:all/" + event_id] = {
            **copy.deepcopy(base_notice), "EventID": event_id, "GUID": "mock-" + event_id,
            "Title": title, "Message": message,
            "AvailableActions": [{"ID": "ack", "Text": "OK", "Type": "", "Payload": None, "Visibility": ""}],
        }
    return records


def connection_fixtures():
    # NetqueryConnection: portmaster-api/src/lib/netquery.service.ts. Synthetic data only.
    rows = []
    for index, (message, key, context) in enumerate([
        ("Internet access blocked", "filter/blockInternet", None),
        ("denied by rule: domain matches *.blocked.test TCP/443", "filter/endpoints",
         {"Filter": "- *.blocked.test TCP/443", "Permitted": False, "Value": "blocked.test", "Extra": {}}),
        ('failed to request tunneling: MOCKED <span id="reason-injected">raw</span> & **details** {{ERROR}}', "", None),
        ("MOCKED future firewall reason: Internet access blocked", "", None),
    ]):
        rows.append(dict(id=f"mock-connection-{index}", allowed=False, profile="local/mock", path="MOCKED/app",
            type="ip", external=True, ip_version=4, ip_protocol=6, local_ip="192.0.2.1", local_port=12345,
            remote_ip="198.51.100.1", remote_port=443, domain=f"mock-{index}.test", country="CN", asn=0,
            as_owner="MOCKED provider", latitude=30, longitude=120, scope=4, verdict=7 if index == 2 else 3,
            started="2026-11-12T00:00:00Z", ended="2026-11-12T00:00:01Z", tunneled=False, encrypted=False,
            internal=False, direction="outbound", profile_revision=0, exit_node="", profile_name="MOCKED app",
            active=False, bytes_received=0, bytes_sent=0,
            extra_data={"reason": {"Msg": message, "Context": context, "OptionKey": key, "Profile": ""}}))
    return rows


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
           "checks": [], "console": [], "page_errors": [], "http": [], "websocket": [], "queries": [], "api_calls": [], "writes": [],
           "tickets": [], "uploads": [], "unmocked": [], "proxy_denied": [], "screenshots": [],
           "mock_connections": connection_fixtures(), "serve_connections": False,
           "limits": ["Existing compiled dist only; source changes after this build are not exercised.",
                      "Mock core/support APIs, four synthetic connections and one synthetic SPN profile during the reason/country scenario; no real service, OS, driver, account or delivery integration.",
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
                if relative in ("", "settings", "monitor", "support", *("support/" + form[0] for form in FORMS)):
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
                if method == "create" and key == "api:ui/reload":
                    assert parts[3].startswith("J")
                    data = json.loads(parts[3][1:])
                    assert data == {"Method": "POST"}, "Unexpected UI reload bridge payload"
                    log["api_calls"].append({"key": key, "data": data})
                    send(id_, "success")
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
                empty = key in ("core:spn/account/user", "core:profiles/", "runtime:modules/core/event/shutdown", "runtime:modules/core/event/restart") or key.startswith("notifications:all/") or key == "map:main/"
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
                    log["queries"].append({"path": url.path, "query_string": url.query, "data": queries})
                    if set(queries) == {"verdicts", "conns", "identities"}:
                        route.fulfill(json={key: [] for key in queries})
                    else:
                        assert set(queries) == {"totalCount", "totalConnCount"}, "Unexpected netquery batch"
                        for key, query in queries.items():
                            assert query["select"] == {"$count": {"field": "*", "as": key}}, "Translated/mutated count query"
                            assert not query.get("groupBy"), "Only ungrouped empty-network counts are mocked"
                        count = len(log["mock_connections"]) if log["serve_connections"] else 0
                        route.fulfill(json={key: [{key: count}] for key in queries})
                    return
                if req.method == "POST" and url.path in (
                    "/api/v1/netquery/query", "/api/v1/netquery/charts/bandwidth",
                    "/api/v1/netquery/charts/connection-active",
                ):
                    data = req.post_data_json
                    assert isinstance(data, dict), "Expected a structured query request"
                    if url.path == "/api/v1/netquery/query":
                        assert "origin=" in url.query, "Missing diagnostic query origin"
                    log["queries"].append({"path": url.path, "query_string": url.query, "data": data})
                    if url.path == "/api/v1/netquery/query" and log["serve_connections"] and parse_qs(url.query).get("origin") == ["netquery-viewer"]:
                        assert not data.get("select") and not data.get("groupBy"), "Only ungrouped connection rows are mocked"
                        assert data.get("page") == 0 and data.get("pageSize") == 25, "Unexpected pagination"
                        assert data.get("databases") == ["main"], "Only the mock live database is served"
                        route.fulfill(json={"results": copy.deepcopy(log["mock_connections"])})
                    else:
                        route.fulfill(json={"results": []})
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

    browser = context = page = screenshot = None
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
                if page and not page.is_closed() and screenshot:
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
    exercise_notifications(page, expect, records, baseline, log, screenshot)
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
    exercise_search(page, expect, records, baseline, log, screenshot)
    exercise_connection_reasons(page, expect, records, baseline, log, screenshot)
    exercise_forms(page, expect, log, screenshot)
    page.locator('app-navigation [routerlink="settings"]').click()
    expect(page.get_by_role("heading", name="全局设置", exact=True)).to_be_visible()
    expect(action.locator("sfng-select button")).to_have_text("允许")
    assert records == baseline, "Machine-facing config did not end at the original fixture values"
    log["checks"].append("Settings/support navigation round trip retains unchanged mock machine configuration; no real machine configuration was accessed")


def exercise_notifications(page, expect, records, baseline, log, screenshot):
    row = page.locator("app-notification-list .row").filter(has_text="MOCKED DNS performance notice")
    expect(row).to_be_visible()
    expect(row.get_by_role("button")).to_have_text(["打开设置", "知道了"])
    expect(row.get_by_text("Open Setting", exact=True)).to_have_count(0)
    expect(row.get_by_text("Got it!", exact=True)).to_have_count(0)
    screenshot("02-notification-list")
    row.locator(".preview > span").click()
    detail = page.locator("app-notification")
    expect(detail).to_be_visible()
    expect(detail.get_by_text("MOCKED DNS performance notice", exact=True)).to_be_visible()
    expect(detail.get_by_text("MOCKED notification body", exact=True)).to_be_visible()
    expect(detail.get_by_role("button")).to_have_text(["打开设置", "不再显示", "知道了"])
    expect(detail.get_by_text("Don't show again", exact=True)).to_have_count(0)
    screenshot("03-notification-detail")
    assert records == baseline and not log["writes"], "Displaying localized notification actions mutated mock records"
    detail.locator(".close-icon").click()
    expect(detail).to_have_count(0)
    log["checks"].append("Angular notification list/detail localize exact action labels while retaining untouched action IDs, types, payloads and visibility")
    for title, body, button in [
        ("IVPN 客户端兼容性提示", "Portmaster 检测到 IVPN 客户端，但当前安装的版本可能无法与 Portmaster 完全兼容地同时运行。部分功能可能无法正常工作。建议更新到最新版本的 IVPN 客户端。", "确定"),
        ("Portmaster 已是最新版本*", 'Portmaster v2.2.8-beta.1 已是最新版本，但检查更新时发生了内部问题：MOCKED <span id="notification-injected">raw</span> & **details** {{TOKEN}}', "确定"),
        ("MOCKED broadcast", "Portmaster did not detect any network connectivity.", "OK"),
    ]:
        row = page.locator("app-notification-list .row").filter(has_text=title)
        expect(row).to_be_visible()
        row.locator(".preview > span").click()
        expect(detail).to_be_visible()
        expect(detail.locator("h1")).to_have_text(title)
        expect(detail.locator(".message")).to_have_text(body)
        expect(detail.get_by_role("button")).to_have_text(button)
        expect(detail.locator("#notification-injected")).to_have_count(0)
        if title == "Portmaster 已是最新版本*":
            screenshot("04-notification-body")
        detail.locator(".close-icon").click()
        expect(detail).to_have_count(0)
    assert records == baseline and not log["writes"], "Localizing titles/bodies mutated notification records"
    log["checks"].append("Known notification titles/bodies render Chinese; versions and raw error markup stay literal, broadcasts remain English, and backend records stay unchanged")



def exercise_search(page, expect, records, baseline, log, screenshot):
    page.locator('app-navigation [routerlink="monitor"]').click()
    page.wait_for_load_state("networkidle")
    search = page.get_by_placeholder("搜索连接，按 Enter 应用", exact=True)
    tags = page.locator("sfng-netquery-tagbar")
    original_filters = tags.inner_text()
    search.fill("(")
    search.press("Enter")
    toast = page.locator(".indicator-content").filter(
        has=page.get_by_role("heading", name="搜索查询无效", exact=True))
    expect(toast).to_be_visible()
    detail = toast.locator(".message")
    expect(detail).to_contain_text("0:0")
    message = detail.inner_text()
    assert "(" in message and "Can't handle character" not in message and " at " not in message, message
    expect(search).to_have_value("(")
    expect(tags).to_have_text(original_filters)
    assert records == baseline, "Invalid search unexpectedly changed machine configuration"
    screenshot("05-search-parse-error")
    log["checks"].append("Malformed query displays a Chinese error with the original 0:0 coordinate and retains editable input")
    toast.locator(".close-icon").click()
    expect(toast).to_have_count(0)
    search.fill("country:CN")
    search.press("Enter")
    expect(search).to_have_value("")
    expect(toast).to_have_count(0)
    expect(tags).to_contain_text("国家/地区")
    page.get_by_role("button", name="全部清除", exact=True).click()
    assert records == baseline, "Search/reset unexpectedly changed machine configuration"
    log["checks"].append("Search remains usable after a parse error; a valid country:CN query and filter reset complete without a new error")
    page.goto(log["origin"] + BASE + "monitor?q=%28", wait_until="networkidle")
    expect(toast).to_be_visible()
    expect(toast.locator(".message")).to_contain_text("0:0")
    expect(tags).to_contain_text("互联网")
    toast.locator(".close-icon").click()
    expect(toast).to_have_count(0)
    assert records == baseline, "Invalid URL query unexpectedly changed machine configuration"
    log["checks"].append("Malformed URL query shows a Chinese error and preserves the monitor's existing Internet filter")


def exercise_connection_reasons(page, expect, records, baseline, log, screenshot):
    # Change only this local fixture, never send config/account writes to the app.
    before = copy.deepcopy(records)
    connections_before = copy.deepcopy(log["mock_connections"])
    records["config:core/expertiseLevel"]["Value"] = "developer"
    records["config:spn/enable"]["Value"] = True
    records["runtime:spn/status"].update(Status="connected", HomeHubID="mock-home", HomeHubName="MOCKED home",
        ConnectedCountry={"Code": "CN", "Name": "China"}, ConnectedIP="192.0.2.2", ConnectedTransport="MOCKED transport")
    records["core:spn/account/user"] = dict(username="MOCKED user", state="approved", balance=0,
        device=None, subscription=None, next_plan=None,
        current_plan={"name": "MOCKED plan", "amount": 0, "months": 0, "renewable": False, "feature_ids": ["spn"]},
        view={"Message": "", "ShowAccountData": False, "ShowAccountButton": False, "ShowLoginButton": False,
              "ShowRefreshButton": False, "ShowLogoutButton": False})
    log["serve_connections"] = True
    try:
        page.goto(log["origin"] + BASE + "monitor", wait_until="networkidle")
        status = page.locator("app-feature-scout .status-info")
        expect(status).to_contain_text("中国")
        expect(status).not_to_contain_text("China")
        assert records["config:core/locale"].get("Value", records["config:core/locale"]["DefaultValue"]) == "en-GB"
        rows = page.locator("sfng-netquery-connection-row")
        expect(rows).to_have_count(4)
        expected_reasons = ["已阻止互联网访问", "规则拒绝：*.blocked.test TCP/443（域名匹配）",
            '请求建立隧道失败：MOCKED <span id="reason-injected">raw</span> & **details** {{ERROR}}',
            "MOCKED future firewall reason: Internet access blocked"]
        for index, expected in enumerate(expected_reasons):
            row = rows.filter(has_text=f"mock-{index}.test")
            row.locator(".verdict").hover()
            tooltip = page.locator("sfng-tooltip-container")
            expect(tooltip).to_contain_text(expected)
            expect(tooltip.locator("#reason-injected")).to_have_count(0)
            accordion = row.locator("xpath=ancestor::sfng-accordion[1]")
            accordion.locator(":scope > div").first.click()
            detail = accordion.locator("sfng-netquery-conn-details")
            expect(detail).to_be_visible()
            expect(detail).to_contain_text(expected)
            expect(detail.locator("#reason-injected")).to_have_count(0)
            if index == 1:
                expect(detail).to_contain_text("*.blocked.test TCP/443")
            if index == 2:
                screenshot("08-connection-reason-and-country")
            accordion.locator(":scope > div").first.click()
            expect(detail).to_have_count(0)
        assert log["mock_connections"] == connections_before, "Reason rendering changed mock connection records"
        assert records["runtime:spn/status"]["ConnectedCountry"] == {"Code": "CN", "Name": "China"}
        log["checks"].append("Compiled connection tooltips/details translate canonical reasons and preserve rule tokens, literal error markup and unknown backend reasons")
        records["runtime:spn/status"]["ConnectedCountry"] = {"Code": "", "Name": "Future Country"}
        page.reload(wait_until="networkidle")
        expect(status).to_contain_text("Future Country")
        log["checks"].append("SPN scout uses Chinese country names despite en-GB date formatting; missing country codes retain the raw backend name")
    finally:
        log["serve_connections"] = False
        records.clear()
        records.update(before)
        page.reload(wait_until="networkidle")
    assert records == baseline and log["mock_connections"] == connections_before
    expect(page.locator("sfng-netquery-connection-row")).to_have_count(0)
    expect(page.locator("app-feature-scout .status-info")).to_have_count(0)


def exercise_forms(page, expect, log, screenshot):
    def open_form(card):
        page.locator('app-navigation [routerlink="support"]').click()
        page.wait_for_load_state("networkidle")
        page.locator(".option-list section").filter(has=page.get_by_role("heading", name=re.compile(card))).click()
        page.wait_for_load_state("networkidle")
        expect(page.locator(".form-wrapper h1").first).to_contain_text(card)

    for id_, card, questions in FORMS:
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
