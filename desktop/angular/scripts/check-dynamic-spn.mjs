import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { finalize, of, tap, throwError } from 'rxjs';
import '@angular/compiler';
import { HttpErrorResponse, HttpHeaders, HttpResponse } from '@angular/common/http';

const source = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function evaluate(text, context) {
  const compiled = ts.transpileModule(text, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const exports = {};
  runInNewContext(compiled, { exports, ...context });
  return exports;
}
function ast(file) { return ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true); }
function classMembers(file, names) {
  const fileAst = ast(file);
  const component = fileAst.statements.find(node => ts.isClassDeclaration(node) && names.every(name => node.members.some(member => member.name?.getText(fileAst) === name)));
  assert(component, `Missing regression targets ${file}#${names.join(',')}`);
  return names.map(name => {
    const members = component.members.filter(member => member.name?.getText(fileAst) === name);
    assert.equal(members.length, 1, `Duplicate regression target ${file}#${name}`);
    return members[0].getText(fileAst);
  }).join('\n');
}
function instance(file, names, context) {
  return new (evaluate(`export class Checked { ${classMembers(file, names)} }`, context).Checked)();
}

// Called with Chinese translations loaded; no Angular app or system service is started.
export function checkDynamicSpn(localize) {
  const context = { $localize: localize, finalize, tap };
  const account = evaluate(source('src/app/shared/spn-account-details/account-text.ts'), context);
  const response = account.localizeSPNAccountResponse;
  const view = account.localizeSPNAccountView;
  const goTypes = source('../../spn/access/account/types.go');
  assert.deepEqual([...account.subscriptionStateLabels.keys()], [...goTypes.matchAll(/SubscriptionState\w+\s*=\s*"([^"]*)"/g)].map(match => match[1]));
  assert.deepEqual([...account.accountStateLabels.keys()], [...goTypes.matchAll(/UserState\w+\s*=\s*"([^"]*)"/g)].map(match => match[1]));
  assert.equal(account.subscriptionStateLabels.get('active'), '有效');
  assert.equal(account.accountStateLabels.get('loggedout'), '已退出登录');

  // These errors travel unchanged from makeClientRequest through Go's http.Error.
  const goErrors = source('../../spn/access/module.go');
  for (const [name, expected] of [['ErrInvalidCredentials', '用户名或密码不正确'], ['ErrDeviceLimitReached', '已达到设备数量上限'], ['ErrDeviceIsLocked', '设备已锁定'], ['ErrNotLoggedIn', '尚未登录']]) {
    const text = goErrors.match(new RegExp(`${name}\\s*= errors.New\\("([^"]+)"\\)`))?.[1];
    assert(text, `Missing backend response ${name}`);
    assert.equal(response(text + '\n'), expected, `Untranslated backend response: ${text}`);
    assert.equal(response(text), expected);
    assert.equal(response(text + '\n\n'), text + '\n\n', 'Do not normalize unexpected whitespace');
    assert.equal(response(text + '\r\n'), text + '\r\n');
    assert.equal(response('Internal error: ' + text + '\n'), 'Internal error: ' + text + '\n');
  }
  for (const text of ['', '__proto__', 'constructor', 'new-state', 'Invalid credentials', 'invalid credentials: new server detail', 'Unexpected server response\n']) {
    assert.equal(response(text), text, 'Unknown responses must pass through unchanged');
    assert.equal(view(text), text, 'Unknown account views must pass through unchanged');
    assert.equal(account.subscriptionStateLabels.get(text) ?? text, text);
    if (text !== '') assert.equal(account.accountStateLabels.get(text) ?? text, text);
  }
  assert.equal(response('Login with your SPN account.\n'), '请使用你的 SPN 账户登录。');
  assert.equal(response('Logged out.\n'), '已退出登录。');
  assert.equal(response('Logged out and user data purged.\n'), '已退出登录并清除用户数据。');
  const username = ' user as device 用户{USERNAME} ';
  const device = '设备 as device "A"';
  const success = `Now logged in as ${username} as device ${device}`;
  assert.equal(response(success, username), `已以 ${username} 身份登录，设备为 ${device}`);
  assert.equal(response(success, 'another-user'), success, 'Do not guess a canonicalized username');
  assert.equal(response(`Now logged in as ${username} as device `, username), `Now logged in as ${username} as device `);
  assert.equal(view(null), '');
  assert.equal(view(`Your account (${username}) was suspended. Please contact support for details.`), `你的账户（${username}）已被停用。请联系支持团队了解详情。`);
  assert.equal(view('Your package My {PLAN_NAME} has ended. Extend it on the Account Page.'), '你的 My {PLAN_NAME} 套餐已到期。请前往账户页面续订。');
  const warning = 'Portmaster could not connect to the account server. The shown information may not be accurate. ';
  assert.equal(view(warning), 'Portmaster 无法连接到账户服务器。显示的信息可能不准确。');
  assert.equal(view(warning + 'Get more features. Upgrade today.'), 'Portmaster 无法连接到账户服务器。显示的信息可能不准确。 立即升级，获取更多功能。');
  assert.equal(view(warning + 'New server policy.'), warning + 'New server policy.', 'No partial translation of unknown view text');

  // Use the real HTTP body parser, not a mocked .message shortcut.
  const uai = instance('src/app/shared/action-indicator/action-indicator.service.ts', ['getErrorMessage', 'stringifyBody', 'ensureMessage'], { ...context, Error, ArrayBuffer, TextDecoder, HttpErrorResponse, HttpResponse, console });
  const indicators = [];
  uai.success = (...args) => indicators.push(['success', ...args]);
  uai.error = (...args) => indicators.push(['error', ...args]);
  const headers = new HttpHeaders({ 'content-type': 'text/plain' });
  const login = instance('src/app/shared/spn-login/spn-login.ts', ['username', 'password', 'login'], { ...context, ...account });
  const requests = [];
  login.uai = uai;
  login.spnService = { login: credentials => { requests.push(plain(credentials)); return of(new HttpResponse({ headers, body: success })); } };
  login.login();
  assert.equal(requests.length, 0, 'Empty credentials must not reach the service');
  login.username = username;
  login.password = ' p@ss:密{码} ';
  login.login();
  assert.deepEqual(requests, [{ username, password: ' p@ss:密{码} ' }]);
  assert.equal(login.password, '', 'Passwords must still be cleared');
  assert.deepEqual(indicators.pop(), ['success', 'SPN 登录', `已以 ${username} 身份登录，设备为 ${device}`]);
  for (const [raw, expected] of [['invalid credentials\n', '用户名或密码不正确'], ['unexpected reply: [500] 500 Internal Server Error\n', 'unexpected reply: [500] 500 Internal Server Error\n']]) {
    login.password = 'retry';
    login.spnService.login = () => throwError(() => new HttpErrorResponse({ error: raw }));
    login.login();
    assert.deepEqual(indicators.pop(), ['error', 'SPN 登录', expected]);
    assert.equal(login.password, '');
  }

  const logout = instance('src/app/shared/spn-account-details/spn-account-details.ts', ['logout'], { ...context, ...account });
  let closeCount = 0;
  logout.dialogRef = { close: () => closeCount++ };
  logout.uai = uai;
  logout.spnService = { logout: (...args) => { assert.deepEqual(args, []); return of(new HttpResponse({ headers, body: 'Logged out.\n' })); } };
  logout.logout();
  assert.equal(closeCount, 1);
  assert.deepEqual(indicators.pop(), ['success', 'SPN 退出登录', '已退出登录。']);
  logout.spnService.logout = () => throwError(() => new HttpErrorResponse({ error: 'new backend error\n' }));
  logout.logout();
  assert.equal(closeCount, 1, 'A failed logout must not close the dialog');
  assert.deepEqual(indicators.pop(), ['error', 'SPN 退出登录', 'new backend error\n']);

  const scoutPath = 'src/app/shared/network-scout/network-scout.ts';
  const scoutAst = ast(scoutPath);
  const enumSource = scoutAst.statements.find(ts.isEnumDeclaration).getText(scoutAst);
  const scout = evaluate(`${enumSource}\nexport class Checked { ${classMembers(scoutPath, ['sortOrder', 'sortTypeLabels', 'staticSortDescription', 'sortMethods', 'sortProfiles', 'searchProfiles', 'updateSortOrder', 'allProfiles', 'profiles', 'searchTerm'])} }`, context);
  const values = ['Static', 'A-Z', 'Z-A', 'Total Connections', 'Denied Connections', 'Allowed Connections', 'SPN Identities', 'Bytes Sent', 'Bytes Received', 'Total Bytes'];
  assert.deepEqual(Object.values(scout.SortTypes), values);
  const sorting = new scout.Checked(), writes = [];
  assert.deepEqual([...sorting.sortTypeLabels.keys()], values);
  assert.equal(sorting.sortTypeLabels.get(scout.SortTypes.static), '默认顺序');
  assert.equal(sorting.sortTypeLabels.get(scout.SortTypes.bytesReceived), '接收字节数');
  assert.equal(sorting.staticSortDescription, '默认排序方式，将新应用添加到列表底部');
  sorting.cdr = { markForCheck() {} };
  sorting.stateService = { set: (key, value) => { writes.push([key, value]); return of(undefined); } };
  for (const value of values) {
    sorting.updateSortOrder(value);
    assert.deepEqual(writes.pop(), ['netscoutSortOrder', value]);
    assert.equal(sorting.sortOrder, value);
  }
  const scoutHtml = source('src/app/shared/network-scout/network-scout.html');
  assert(scoutHtml.includes('*sfngSelectValue="sortMethod;'));
  assert(scoutHtml.includes('sortTypeLabels.get(sortMethod) ?? sortMethod'));
  assert(scoutHtml.includes('staticSortDescription'));

  const pin = instance('src/app/pages/spn/pin-details/pin-details.ts', ['notAvailable', 'pinStateLabels', 'formatPinStates'], context);
  const states = Object.freeze(['Offline', 'Reachable', '__proto__', 'constructor', 'NewBackendState']);
  assert.equal(pin.formatPinStates(states), '离线, 可达, __proto__, constructor, NewBackendState');
  assert.deepEqual([...states], ['Offline', 'Reachable', '__proto__', 'constructor', 'NewBackendState']);
  assert.equal(pin.notAvailable, '暂无');
  const goStates = source('../../spn/navigator/state.go');
  const names = [...goStates.slice(goStates.indexOf('func (pinState PinState) Name()')).matchAll(/return "([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual([...pin.pinStateLabels.keys()], names);
  const pinHtml = source('src/app/pages/spn/pin-details/pin-details.html');
  assert(pinHtml.includes('formatPinStates(pin.pin.States)'));
  const overlay = instance('src/app/pages/spn/pin-overlay/pin-overlay.ts', ['showExitConnections', 'homeNodeHelp', 'exitNodeHelp', 'transitNodeHelp'], context);
  overlay.mapPin = { pin: { ID: 'node-raw:{ID}' } };
  let navigation;
  overlay.router = { navigate: (...args) => { navigation = plain(args); } };
  overlay.showExitConnections();
  assert.deepEqual(navigation, [['/monitor'], { queryParams: { q: 'exit_node:node-raw:{ID}' } }]);
  assert(classMembers('src/app/pages/spn/pin-overlay/pin-overlay.ts', ['copyNodeID']).includes('writeToClipboard(this.mapPin?.pin.ID)'));
  const overlayHtml = source('src/app/pages/spn/pin-overlay/pin-overlay.html');
  for (const field of ['homeNodeHelp', 'exitNodeHelp', 'transitNodeHelp']) assert(overlayHtml.includes(`context: {$implicit: ${field}}`));
  assert.equal(overlay.homeNodeHelp, '此节点不知道你的连接目标，但可能知道你的位置');

  const accountHtml = source('src/app/shared/spn-account-details/spn-account-details.html');
  for (const state of ['manual', 'active', 'cancelled']) assert(accountHtml.includes(`currentUser.subscription.state === '${state}'`));
  assert(accountHtml.includes("currentUser.state !== 'loggedout'"));
  assert(accountHtml.includes("[forcedLogout]=\"currentUser?.state === 'loggedout'\""));
  assert(accountHtml.includes('subscriptionStateLabels.get(currentUser.subscription.state) ?? currentUser.subscription.state'));
  assert(accountHtml.includes('accountStateLabels.get(currentUser.state) ?? currentUser.state'));
  for (const area of ['spn-status', 'feature-scout']) {
    const html = source(`src/app/shared/${area}/${area}.html`).replace(/<!--[\s\S]*?-->/g, '');
    assert.deepEqual([...html.matchAll(/ngSwitchCase="([^"]+)"/g)].map(match => match[1]), ['disabled', 'failed', 'connecting', 'connected']);
    assert.equal([...html.matchAll(/ngSwitchDefault/g)].length, 1, 'Scout statuses must have exactly one unknown-state fallback');
    assert(html.includes('{{ spnStatus?.Status }}'), 'Unknown scout statuses must pass through');
  }
  const country = evaluate(source('src/app/shared/netquery/pipes/country-name.ts'), { $localize: localize, Intl });
  const featureScout = instance('src/app/shared/feature-scout/feature-scout.ts', ['countryName'], { getCountryName: country.getCountryName });
  const rawCountry = Object.freeze({ Code: 'CN', Name: 'China' });
  const previousLocale = localize.locale;
  try {
    localize.locale = 'zh-CN';
    assert.equal(featureScout.countryName(rawCountry.Code, rawCountry.Name, 'en-GB'), '中国');
    for (const code of ['', 'AA', 'ZZ', 'cn']) assert.equal(featureScout.countryName(code, 'Raw Country'), 'Raw Country');
    localize.locale = 'en-GB';
    assert.equal(featureScout.countryName(rawCountry.Code, rawCountry.Name), 'China');
  } finally { localize.locale = previousLocale; }
  assert.equal(rawCountry.Name, 'China');
  assert(source('src/app/shared/feature-scout/feature-scout.html').includes("countryName(spnStatus?.ConnectedCountry?.Code || '', spnStatus?.ConnectedCountry?.Name || '')"));
  const map = source('src/app/pages/spn/map.service.ts');
  for (const state of ['Offline', 'Reachable', 'ConnectivityIssues']) assert(map.includes(`pin.States.includes('${state}')`));
}
