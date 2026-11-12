import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as rxjs from 'rxjs';
import '@angular/compiler';
import { HttpErrorResponse, HttpHeaders, HttpResponse } from '@angular/common/http';
import { loadNotificationText, notificationCases } from './check-notifications.mjs';

const source = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const decorator = () => () => {};
const core = { Injectable: decorator, Pipe: decorator, InjectionToken: class {}, inject: () => ({}) };

// Called with the real zh-CN catalog loaded; no browser, backend or system service is used.
export async function checkDynamicGeneralLocalization(localize) {
  function load(file, imports = {}, globals = {}) {
    const compiled = ts.transpileModule(source(file), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, useDefineForClassFields: false }
    }).outputText;
    const exports = {};
    runInNewContext(compiled, {
      exports, $localize: localize, Error, ArrayBuffer, TextDecoder, Date,
      console: { log() {}, error() {} }, ...globals,
      require(name) {
        const modules = { '@angular/core': core, rxjs, 'rxjs/operators': rxjs, ...imports };
        assert(Object.hasOwn(modules, name), `Unexpected test import: ${name}`);
        return modules[name];
      }
    });
    return exports;
  }

  const labels = load('src/app/shared/utils.ts', { psl: {} });
  for (const [value, expected] of [['tag', '标签'], ['cmdline', '命令行'], ['env', '环境变量'], ['path', '路径']]) {
    assert.equal(labels.getFingerprintTypeLabel(value), expected);
  }
  for (const [value, expected] of [['equals', '等于'], ['prefix', '前缀'], ['regex', '正则表达式']]) {
    assert.equal(labels.getFingerprintOperationLabel(value), expected);
  }
  for (const unknown of ['', '__proto__', 'constructor', 'future-operator', '+ *.example.com TCP/443']) {
    assert.equal(labels.getFingerprintTypeLabel(unknown), unknown);
    assert.equal(labels.getFingerprintOperationLabel(unknown), unknown);
  }
  const { AppFingerprintPipe } = load('src/app/pages/app-view/app-fingerprint.pipe.ts', {
    '@safing/portmaster-api': { FingerprintType: { Path: 'path', Cmdline: 'cmdline' }, FingerpringOperation: { Equal: 'equals' } },
    '../../shared/utils': labels,
  });
  const fingerprint = new AppFingerprintPipe();
  const value = 'C:\\程序\\app.exe --profile=Allow .*';
  for (const [Type, Operation] of [['path', 'equals'], ['path', 'prefix'], ['cmdline', 'regex']]) {
    const profile = Object.freeze({ Fingerprints: Object.freeze([Object.freeze({ Type, Operation, Value: value })]) });
    const rendered = fingerprint.transform(profile);
    if (Operation === 'equals') assert.equal(rendered, value);
    else assert(rendered.includes(labels.getFingerprintOperationLabel(Operation)) && rendered.endsWith(value));
  }
  assert.equal(fingerprint.transform({ Fingerprints: [] }), null);

  const { ActionIndicatorService } = load('src/app/shared/action-indicator/action-indicator.service.ts', {
    '@angular/cdk/overlay': {}, '@angular/cdk/portal': {}, './indicator': {},
    '@angular/common/http': { HttpErrorResponse, HttpResponse },
  });
  const indicator = new ActionIndicatorService();
  const raw = 'lowercase backend message: Allow /path?key=Value';
  assert.equal(indicator.getErrorMessage(raw), raw);
  assert.equal(indicator.getErrorMessage(new Error(raw)), raw);
  assert.equal(indicator.getErrorMessage(new HttpErrorResponse({ error: raw })), raw);
  assert.equal(indicator.getErrorMessage(new HttpErrorResponse({ error: new Error(raw) })), raw);
  for (const body of [raw, new TextEncoder().encode(raw).buffer]) {
    assert.equal(indicator.getErrorMessage(new HttpResponse({ headers: new HttpHeaders({ 'content-type': 'text/plain' }), body })), raw);
  }
  assert.equal(indicator.getErrorMessage({ toString: () => raw }), `未知错误：${raw}`);

  const types = load('src/app/services/notifications.types.ts', { '@safing/portmaster-api': {} });
  const updates = [], creates = [], routes = [], toasts = [];
  const integration = { openExternal: async () => { throw new Error(raw); }, onExitRequest() {} };
  const api = {
    watchAll: () => rxjs.of([]),
    update: (key, data) => { updates.push([key, plain(data)]); return rxjs.of(undefined); },
    create: (key, data) => { creates.push([key, data]); return rxjs.of(undefined); },
  };
  const { NotificationsService } = load('src/app/services/notifications.service.ts', {
    '@angular/core': { ...core, inject: () => integration },
    './notifications.types': types, './virtual-notification': {}, '../integration': {},
    './notification-text': loadNotificationText(),
    'src/environments/environment': { environment: { httpAPI: 'http://test.invalid' } },
  });
  const notifications = new NotificationsService(api, { navigate: async (...args) => { routes.push(plain(args)); return true; } }, {}, {
    getErrorMessgae: error => indicator.getErrorMessage(error),
    error: (...args) => toasts.push(args),
  });
  for (const { name, n, expected, labels } of notificationCases()) {
    assert.deepEqual(plain(notifications.getText(n)), expected, name + ': service display');
    if (labels) assert.deepEqual(n.AvailableActions.map(action => notifications.getActionText(n, action)), labels, name + ': service actions');
  }
  const prompt = Object.freeze({ EventID: 'filter:prompt-local/raw-id', Type: types.NotificationType.Prompt, Message: raw, Title: raw });
  for (const [prefix, Text, expected] of [['allow', 'Allow', '允许'], ['block', 'Block', '阻止']]) {
    for (const suffix of ['domain-all', 'serving-ip', 'ip']) {
      const action = Object.freeze({ ID: `${prefix}-${suffix}`, Text, Type: '', Payload: raw });
      assert.equal(notifications.getActionText(prompt, action), expected);
      assert.equal(notifications.getActionText({ ...prompt, EventID: 'broadcasts:test' }, action), Text);
      assert.equal(notifications.getActionText({ ...prompt, Type: types.NotificationType.Info }, action), Text);
      assert.equal(notifications.getActionText(prompt, { ...action, Type: 'open-url' }), Text);
      assert.equal(notifications.getActionText(prompt, { ...action, Text: raw }), raw);
      await rxjs.lastValueFrom(notifications.execute(prompt, action));
      assert.deepEqual(updates.at(-1), ['notifications:all/' + prompt.EventID, { EventID: prompt.EventID, SelectedActionID: action.ID }]);
      assert.equal(action.Text, Text);
    }
  }
  assert.equal(notifications.getActionText(prompt, { ID: 'future-action', Text: raw, Type: '' }), raw);

  const actionCases = [
    ['interop:ivpn-old-version', { ID: 'ack', Text: 'OK', Type: '', Visibility: '' }, '确定'],
    ['resolver:suggest-using-stale-cache', { ID: 'ack', Text: 'Got it!', Type: '', Visibility: '' }, '知道了'],
    ['access:end-of-package-near', { ID: 'ack', Text: 'Got it!', Type: '', Visibility: '' }, '知道了'],
    ['resolver:suggest-using-stale-cache', { ID: 'suppress', Text: "Don't show again", Type: '', Visibility: 'detailed' }, '不再显示'],
    ['interop:ivpn', { ID: 'suppress', Text: "Don't show again", Type: '', Visibility: 'detailed' }, '不再显示'],
    ['resolver:suggest-using-stale-cache', { ID: '', Text: 'Open Setting', Type: 'open-setting', Visibility: 'in-app-only', Payload: { Key: 'dns/useStaleCache', Profile: '' } }, '打开设置'],
    ['status:example', { ID: '', Text: 'Get Help', Type: 'open-url', Visibility: '', Payload: 'https://safing.io/support/' }, '获取帮助'],
    ['spn:package-not-eligible', { ID: '', Text: 'Open Account Page', Type: 'open-url', Visibility: '', Payload: 'https://account.safing.io' }, '打开账户页面'],
    ['spn:subscription-inactive', { ID: '', Text: 'Open Account Page', Type: 'open-url', Visibility: '', Payload: 'https://account.safing.io' }, '打开账户页面'],
    ['access:end-of-package-near', { ID: '', Text: 'Open Account Page', Type: 'open-url', Visibility: '', Payload: 'https://account.safing.io' }, '打开账户页面'],
  ];
  const eventSpecificActions = new Set(['Got it!', "Don't show again", 'Open Setting', 'Open Account Page']);
  const openedURLs = [];
  const failingOpenExternal = integration.openExternal;
  integration.openExternal = async url => { openedURLs.push(url); };
  for (const [EventID, input, expected] of actionCases) {
    const action = Object.freeze({ ...input, ...(typeof input.Payload === 'object' ? { Payload: Object.freeze({ ...input.Payload }) } : {}) });
    const notification = Object.freeze({ EventID, Type: types.NotificationType.Info });
    const before = JSON.stringify(action);
    assert.equal(notifications.getActionText(notification, action), expected);
    assert.equal(JSON.stringify(action), before, `Display localization mutated ${input.Text}`);
    assert.equal(notifications.getActionText({ ...notification, EventID: 'broadcasts:remote' }, action), input.Text, `Remote broadcast action ${input.Text} must remain raw`);
    assert.equal(notifications.getActionText(notification, { ...action, ID: 'future-id' }), input.Text);
    assert.equal(notifications.getActionText(notification, { ...action, Type: undefined }), input.Text);
    assert.equal(notifications.getActionText(notification, { ...action, Visibility: undefined }), input.Text);
    assert.equal(notifications.getActionText(notification, { ...action, Text: input.Text + ' changed' }), input.Text + ' changed');
    if (eventSpecificActions.has(input.Text)) {
      assert.equal(notifications.getActionText({ ...notification, EventID: 'future:event' }, action), input.Text);
    }
    if (input.Type === 'open-url') {
      assert.equal(notifications.getActionText(notification, { ...action, Payload: input.Payload + '/' }), input.Text);
    }
    if (input.Type === 'open-setting') {
      for (const Payload of [null, undefined, {}, '', 0]) {
        assert.equal(notifications.getActionText(notification, { ...action, Payload }), input.Text, 'Incomplete action payload must fall back without breaking notification rendering');
      }
      assert.equal(notifications.getActionText(notification, { ...action, Payload: { Key: 'dns/useStaleCache', Profile: undefined } }), input.Text);
      assert.equal(notifications.getActionText(notification, { ...action, Payload: { Key: 'future/setting', Profile: '' } }), input.Text);
    }
    const updateCount = updates.length;
    await rxjs.lastValueFrom(notifications.execute(notification, action));
    assert.equal(updates.length, updateCount + (action.ID ? 1 : 0));
    if (action.ID) {
      assert.deepEqual(updates.at(-1), ['notifications:all/' + EventID, { EventID, SelectedActionID: action.ID }]);
    }
    if (action.Type === 'open-url') assert.equal(openedURLs.at(-1), input.Payload);
    if (action.Type === 'open-setting') {
      assert.deepEqual(routes.at(-1), [['/settings'], { queryParams: { setting: 'dns/useStaleCache' } }]);
    }
    assert.equal(JSON.stringify(action), before, 'Action execution must retain the original action');
  }
  assert.equal(toasts.length, 0, 'Canonical actions must execute without errors');
  integration.openExternal = failingOpenExternal;
  assert(source('src/app/shared/notification-list/notification-list.component.html').includes('notifsService.getActionText(notif, action)'));
  assert(source('src/app/shared/notification/notification.html').includes('notifService.getActionText(notification, action)'));

  await rxjs.lastValueFrom(notifications.create(prompt));
  assert.equal(creates[0][1], prompt, 'Notification creation must retain the caller payload');
  const query = 'country:CN verdict:3 profile:local/raw-id';
  await notifications.performAction({ ID: '', Type: 'netquery', Text: raw, Payload: query });
  assert.deepEqual(routes.at(-1), [['/monitor'], { queryParams: { q: query } }]);
  await rxjs.lastValueFrom(notifications.execute(prompt, { ID: '', Type: 'open-url', Text: raw, Payload: 'https://example.invalid/Allow' }));
  assert.deepEqual(toasts.at(-1), ['内部错误', `执行操作失败：${raw}`]);
  assert(source('src/app/prompt-entrypoint/prompt.html').includes('selectAction(prompt, action.ID)'));
  assert(source('src/app/prompt-entrypoint/prompt.html').includes('notificationService.getActionText(prompt, action)'));

  const { ExitService } = load('src/app/shared/exit-screen/exit.service.ts', {
    '@angular/core': { ...core, inject: () => integration },
    './exit-screen': {}, 'src/app/integration': {},
  }, { window: { addEventListener() {} } });
  const connected$ = new rxjs.BehaviorSubject(false);
  let confirmation;
  const exit = new ExitService({}, { connected$, sub: () => rxjs.NEVER }, {
    confirm: config => { confirmation = config; return { onAction: id => assert.equal(id, 'shutdown') }; },
  }, {});
  let display;
  const subscription = exit.showOverlay$.subscribe(text => { display = text; });
  assert.equal(display, '正在连接 Portmaster');
  connected$.next(true);
  assert.equal(display, '');
  exit._showOverlay.next('Shutting Down Portmaster');
  connected$.next(false);
  assert.equal(exit._showOverlay.value, 'Shutting Down Portmaster', 'Disconnect must preserve shutdown state');
  assert.equal(display, '正在关闭 Portmaster');
  exit._showOverlay.next('Restarting Portmaster');
  assert.equal(display, '正在重启 Portmaster');
  exit._showOverlay.next(raw);
  assert.equal(display, raw);
  exit.shutdownPortmaster();
  assert.equal(confirmation.header, '正在关闭 Portmaster');
  assert.equal(confirmation.buttons[0].id, 'shutdown');
  assert.equal(confirmation.buttons[0].text, '关闭 Portmaster');
  subscription.unsubscribe();

  const { formatDuration, DurationPipe } = load('src/app/shared/pipes/duration.pipe.ts');
  const duration = 86400000 + 7200000 + 180000 + 4000 + 5;
  assert.equal(formatDuration(duration), '1 天 2 小时 3 分钟 4 秒 5 毫秒');
  assert.equal(formatDuration(duration, true, true), '26 小时 3 分钟 4 秒');
  assert.equal(formatDuration(-1001), '-1 秒 1 毫秒');
  assert.equal(formatDuration(0), '0');
  assert.equal(new DurationPipe().transform(0), '少于 1 秒');
  assert.equal(new DurationPipe().transform([5000, 1000]), '4 秒');
}
