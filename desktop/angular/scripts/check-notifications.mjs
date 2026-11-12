import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
export const notificationCatalog = JSON.parse(source('src/i18n/notifications.zh-CN.json'));
const token = /\{\{([A-Z_]+)\}\}/g;
const plain = value => JSON.parse(JSON.stringify(value));
const substitute = (text, values) => text.replace(token, (_, name) => values[name]);
const rawText = n => ({ title: n.Title, message: n.Message });
const matchEvent = (events, id) => events.some(e => e.endsWith('*') ? id.startsWith(e.slice(0, -1)) : id === e);
const mockNotification = (EventID, Title = 'MOCKED title', Message = 'MOCKED body') => ({
  EventID, GUID: 'mock-notification', Type: 0, Title, Message, Category: '', EventData: null,
  Expires: 0, State: 'active', SelectedActionID: '', ShowOnSystem: true, AvailableActions: [],
});
const mockAction = (ID = 'ack', Text = 'OK') => ({ ID, Text, Type: '', Payload: null, Visibility: '' });

export function loadNotificationText() {
  const exports = {};
  runInNewContext(ts.transpileModule(source('src/app/services/notification-text.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, {
    exports, $localize: { locale: 'zh-CN' },
    require(name) {
      assert.equal(name, '../../i18n/notifications.zh-CN.json');
      return notificationCatalog;
    }
  });
  return exports;
}

function validateCatalog() {
  assert.equal(notificationCatalog.version, 1);
  const ids = new Set();
  const goStrings = code => [...code.matchAll(/`([^`]*)`|"((?:[^"\\]|\\.)*)"/g)].flatMap(match => {
    try { return [match[1] ?? JSON.parse('"' + match[2] + '"')]; } catch { return []; }
  });
  for (const rule of notificationCatalog.messages) {
    assert(!ids.has(rule.id), 'Duplicate notification key: ' + rule.id);
    ids.add(rule.id);
    assert(rule.events.length && rule.events.every(e => typeof e === 'string' && e !== '*' && !e.startsWith('broadcasts:')));
    const placeholders = pair => [...new Set([...pair.matchAll(token)].map(m => m[1]))].sort();
    assert.deepEqual(placeholders(rule.title[0] + rule.message[0]), placeholders(rule.title[1] + rule.message[1]), rule.id + ': placeholders');
    for (const text of [...rule.title, ...rule.message]) assert(!/\}\}\{\{/.test(text), rule.id + ': adjacent ambiguous parameters');
    for (const name of rule.numbers || []) assert(placeholders(rule.title[0] + rule.message[0]).includes(name));
    const links = value => value.match(/https?:\/\/[^\s)]+/g) || [];
    assert.deepEqual(links(rule.message[0]), links(rule.message[1]), rule.id + ': changed documentation URL');
    const code = readFileSync(new URL('../../../' + rule.origin, import.meta.url), 'utf8');
    const literals = goStrings(code);
    // Source wrappers must still occur in the actual producer, not only in our tests.
    // These three families compose known literals; their combinations are checked separately below.
    if (!rule.id.startsWith('paused-') && !rule.id.startsWith('package-expiry-') && !rule.id.startsWith('spn-account-')) {
      for (const text of [rule.title[0], rule.message[0]]) {
        for (const fragment of text.split(/\{\{[A-Z_]+\}\}/).filter(s => s.trim())) {
          assert(literals.some(value => value.includes(fragment)), rule.id + ': source fragment changed: ' + JSON.stringify(fragment));
        }
      }
    }
  }
  const signatures = new Set();
  for (const rule of notificationCatalog.actions) {
    assert(rule.events.length && rule.source && rule.target && typeof rule.ID === 'string' && typeof rule.Type === 'string' && typeof rule.Visibility === 'string');
    const signature = JSON.stringify(rule);
    assert(!signatures.has(signature)); signatures.add(signature);
  }
}

export function notificationCases() {
  const cases = [];
  for (const rule of notificationCatalog.messages) {
    const params = Object.fromEntries([...new Set([...((rule.title[0] + rule.message[0]).matchAll(token))].map(m => m[1]))]
      .map(name => [name, (rule.numbers || []).includes(name) ? '7' : `原始_${name}_<&>"'\\{{LITERAL}}`]));
    // These values are not interpreted/reformatted: they simulate backend-produced display text.
    if ('TIME' in params) params.TIME = '23:59:58';
    if ('VERSION' in params) params.VERSION = '2.2.8-beta.1';
    if ('IP' in params) params.IP = '2001:db8::1';
    if ('DOMAIN' in params) params.DOMAIN = 'example.test';
    if (rule.id.startsWith('package-expiry-named-')) params.PLAN = 'Named Package';
    const n = mockNotification(rule.events[0].replace(/\*$/, 'test'), substitute(rule.title[0], params), substitute(rule.message[0], params));
    if (rule.requiredAction) { n.Type = 2; n.AvailableActions = [mockAction(rule.requiredAction, 'Allow')]; }
    cases.push({ name: rule.id, n, expected: { title: substitute(rule.title[1], params), message: substitute(rule.message[1], params) } });
    cases.push({ name: rule.id + '/broadcast', n: { ...n, EventID: 'broadcasts:remote' }, expected: rawText(n), labels: n.AvailableActions.map(a => a.Text) });
    cases.push({ name: rule.id + '/unknown', n: { ...n, EventID: 'future:event' }, expected: rawText(n), labels: n.AvailableActions.map(a => a.Text) });
    cases.push({ name: rule.id + '/changed-title', n: { ...n, Title: 'changed ' + n.Title }, expected: { title: 'changed ' + n.Title, message: n.Message } });
  }
  for (const [index, rule] of notificationCatalog.actions.entries()) {
    const n = mockNotification(rule.events[0].replace(/\*$/, 'test'));
    n.Type = rule.notificationType ?? 0;
    const action = { ID: rule.ID, Type: rule.Type, Text: rule.source, Visibility: rule.Visibility, Payload: plain(rule.Payload ?? null) };
    if (rule.payloadFrom) { n.EventData = { [rule.payloadFrom]: 'https://portal.test/login?q=原始' }; action.Payload = n.EventData[rule.payloadFrom]; }
    if (rule.settingFromEvent) action.Payload = { Key: n.EventID.slice(rule.settingFromEvent.length), Profile: '' };
    if (rule.profileIndex) {
      n.EventID = 'profiles:match-conflict:local/raw-a:local/raw-b';
      n.AvailableActions = [1, 2].map(i => ({ ...mockAction('', `Change (${i})`), Type: 'open-profile', Payload: i === 1 ? 'local/raw-a' : 'local/raw-b' }));
      action.Payload = n.AvailableActions[rule.profileIndex - 1].Payload;
      n.AvailableActions[rule.profileIndex - 1] = action;
    } else n.AvailableActions = [action];
    const labels = rule.profileIndex ? ['更改（1）', '更改（2）'] : [rule.target];
    cases.push({ name: 'action-' + index, n, expected: rawText(n), labels });
    cases.push({ name: 'action-' + index + '/broadcast', n: { ...n, EventID: 'broadcasts:remote' }, expected: rawText(n), labels: n.AvailableActions.map(a => a.Text) });
    for (const [field, value] of [['ID', 'future-action'], ['Type', 'future-type'], ['Visibility', 'future-visibility'], ['Text', 'changed label']]) {
      const changed = { ...n, AvailableActions: [{ ...action, [field]: value }] };
      cases.push({ name: 'action-' + index + '/' + field, n: changed, expected: rawText(n), labels: [field === 'Visibility' && rule.ignoreVisibility ? rule.target : changed.AvailableActions[0].Text] });
    }
    if (action.Type) {
      const changed = { ...n, AvailableActions: [{ ...action, Payload: null }] };
      cases.push({ name: 'action-' + index + '/missing-payload', n: changed, expected: rawText(n), labels: [action.Text] });
    }
  }
  const ambiguous = mockNotification('core:authorize-app-test', 'An app requests access to the Portmaster', 'Allow App (other (Profile) to query and modify the Portmaster?\n\nBinary: C:\\app.exe');
  cases.push({ name: 'ambiguous-authorization', n: ambiguous, expected: rawText(ambiguous) });
  const changed = mockNotification('missing-resolvers', 'No DNS Servers Configured', 'Future backend message with <tags>, domains and arbitrary details');
  cases.push({ name: 'changed-body', n: changed, expected: rawText(changed) });
  const missing = mockNotification('resolver:suggest-using-stale-cache', 'Speed Up Website Loading', 'Incomplete notification');
  cases.push({ name: 'incomplete-message', n: missing, expected: rawText(missing) });
  return cases;
}

export function checkNotifications(localize) {
  validateCatalog();
  const { localizeNotificationText, localizeNotificationAction } = loadNotificationText();
  const cases = notificationCases();
  for (const { name, n, expected, labels } of cases) {
    const before = JSON.stringify(n);
    assert.deepEqual(plain(localizeNotificationText(n)), expected, name);
    const actualLabels = n.AvailableActions.map(a => localizeNotificationAction(n, a));
    if (labels) assert.deepEqual(actualLabels, labels, name + ': labels');
    assert.deepEqual(plain(localizeNotificationText(n, false, 'en-GB')), rawText(n), name + ': English build');
    assert.deepEqual(plain(localizeNotificationText(n, false, 'zh-TW')), rawText(n), name + ': unsupported locale');
    assert.equal(JSON.stringify(n), before, name + ': mutated raw notification');
  }
  const special = cases.find(c => c.name === 'secure-dns-bypass');
  const markdown = localizeNotificationText(special.n, true);
  assert(markdown.message.includes('&lt;&amp;&gt;') && !markdown.message.includes('<&>'));
  assert(markdown.message.includes('\\{\\{LITERAL\\}\\}'), 'Parameter contents must not become template syntax');
  assert.equal(markdown.title, special.expected.title, 'Plain titles must not receive Markdown escapes');
  for (const locale of ['zh', 'zh-CN', 'zh-Hans']) assert.deepEqual(plain(localizeNotificationText(special.n, false, locale)), special.expected);
  if (localize) {
    const exports = {};
    runInNewContext(ts.transpileModule(source('src/app/shared/spn-account-details/account-text.ts'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText, { exports, $localize: localize });
    for (const c of cases.filter(c => c.name.startsWith('spn-account-') && !c.name.includes('/') && c.name !== 'spn-account-fallback')) {
      assert.equal(c.expected.message, '无法启用 SPN：' + exports.localizeSPNAccountView(c.n.Message.slice('Cannot enable SPN: '.length)), c.name + ': existing account translations');
    }
  }
  return cases;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const cases = checkNotifications();
  if (process.argv[2] === '--native') {
    const results = JSON.parse(execFileSync(process.argv[3], { input: JSON.stringify(cases.map(c => c.n)), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
    assert.equal(results.length, cases.length);
    const helper = loadNotificationText();
    for (const [index, c] of cases.entries()) {
      const result = results[index];
      assert.deepEqual({ title: result.title, message: result.message }, c.expected, c.name + ': native text');
      assert.deepEqual(result.actions, c.n.AvailableActions.map(a => helper.localizeNotificationAction(c.n, a)), c.name + ': native labels');
      assert.deepEqual(result.systemActions, c.n.AvailableActions.map((a, i) => [a, i]).filter(([a]) => !a.Visibility).map(([a, i]) => [a.ID, result.actions[i]]), c.name + ': native visibility/IDs');
      assert.deepEqual(result.record, c.n, c.name + ': native mutated record');
    }
  } else assert.equal(process.argv.length, 2, 'Only --native <binary> is supported');
  console.log(`Notifications: ${notificationCatalog.messages.length} source templates, ${notificationCatalog.actions.length} action rules, ${cases.length} checks${process.argv[2] ? '; actual Rust/TypeScript outputs match' : ''}.`);
}
