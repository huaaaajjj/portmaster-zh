import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as rxjs from 'rxjs';
import * as psl from 'psl';
import * as d3 from 'd3';
import '@angular/compiler';
import * as common from '@angular/common';
import zh from '@angular/common/locales/zh';
import * as coercion from '@angular/cdk/coercion';

const source = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const decorator = () => () => {};
const core = Object.fromEntries(['Component', 'Directive', 'Injectable', 'Pipe', 'Inject', 'Input', 'Output', 'HostBinding', 'HostListener', 'ViewChild', 'ViewChildren'].map(name => [name, decorator]));
Object.assign(core, { ChangeDetectionStrategy: { OnPush: 0 }, LOCALE_ID: 'locale', forwardRef: fn => fn, isDevMode: () => false, EventEmitter: rxjs.Subject, inject: () => ({}) });

// Run the real modified functions with the caller's loaded zh-CN $localize; no browser or service.
export async function checkDynamicNetquery(localize) {
  common.registerLocaleData(zh);
  function load(file, imports = {}, globals = {}) {
    const result = ts.transpileModule(source(file), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, useDefineForClassFields: false },
      reportDiagnostics: true,
    });
    assert.equal(result.diagnostics?.filter(item => item.category === ts.DiagnosticCategory.Error).length, 0, file);
    const exports = {};
    runInNewContext(result.outputText, {
      exports, $localize: localize, Date, Intl, console: { log() {}, warn() {}, error() {} }, ...globals,
      require(name) {
        const modules = { '@angular/core': core, '@angular/common': common, '@angular/cdk/coercion': coercion, rxjs, 'rxjs/operators': rxjs, ...imports };
        assert(Object.hasOwn(modules, name), `${file}: unexpected import ${name}`);
        return modules[name];
      },
    });
    return exports;
  }
  const shared = load('src/app/shared/utils.ts', { psl });
  const api = {
    ...load('projects/safing/portmaster-api/src/lib/network.types.ts'),
    ...load('projects/safing/portmaster-api/src/lib/app-profile.types.ts'),
    ...load('projects/safing/portmaster-api/src/lib/utils.ts'),
    Database: { Live: 'main', History: 'history' }, FeatureID: {}, ExpertiseLevel: { Developer: 'developer' },
  };
  const labels = load('src/app/shared/netquery/utils.ts', { '@safing/portmaster-api': api, '../utils': shared });

  const reasonText = labels.localizeConnectionReason;
  const reason = (Msg, Context = null, OptionKey = '') => Object.freeze({ Msg, Context, OptionKey, Profile: 'local/raw-profile' });
  let reasonChecks = 0;
  function checkReason(value, expected) {
    const before = JSON.stringify(value);
    assert.equal(reasonText(value), expected);
    assert.equal(JSON.stringify(value), before, 'Reason records must not be rewritten');
    reasonChecks++;
  }
  const backend = ['master', 'dns', 'prompt', 'packet_handler', 'tunnel', 'split-tunnel', 'bypassing']
    .map(file => source('../../service/firewall/' + file + '.go')).join('\n');
  const fixedReasons = [
    ["unknownProcess", "unknown process or profile", "未知进程或配置文件"],
    ["allowDNS", "allowing dns request", "允许 DNS 请求"],
    ["defaultAllow", "allowed by default action", "默认网络操作允许此连接"],
    ["defaultBlock", "blocked by default action", "默认网络操作阻止此连接"],
    ["portmaster", "connection by Portmaster", "Portmaster 自身的连接"],
    ["inboundBlocked", "inbound connections blocked", "已阻止传入连接"],
    ["p2pList", "P2P assistive infrastructure blocked based on filter list", "根据过滤列表阻止 P2P 辅助基础设施"],
    ["p2pPort", "P2P assistive infrastructure blocked based on port", "根据端口阻止 P2P 辅助基础设施"],
    ["p2pDirect", "direct connections (P2P) blocked", "已阻止直接连接（P2P）"],
    ["bootstrap", "special grant for connectivity domain during network bootstrap", "网络初始化期间特别允许连通性检测域名"],
    ["internetLAN", "Internet and LAN access blocked", "已阻止互联网和局域网访问"],
    ["internet", "Internet access blocked", "已阻止互联网访问"],
    ["lan", "LAN access blocked", "已阻止局域网访问"],
    ["localhost", "Localhost access blocked", "已阻止本机访问"],
    ["invalidIP", "invalid IP", "无效的 IP 地址"],
    ["dnsSplit", "DNS global/private split-view violation", "DNS 响应违反公网与私网隔离要求"],
    ["dnsBlockedIPs", "DNS response only contained to-be-blocked IPs", "DNS 响应只包含将被阻止的 IP 地址"],
    ["dnsGlobalHorizon", "DNS server horizon violation: global DNS server returned local IP address", "DNS 服务器范围越界：公网 DNS 服务器返回了本地 IP 地址"],
    ["dnsLANHorizon", "DNS server horizon violation: LAN DNS server returned localhost IP address", "DNS 服务器范围越界：局域网 DNS 服务器返回了本机 IP 地址"],
    ["dga", "possible DGA domain commonly used by malware", "可能是恶意软件常用的 DGA 域名"],
    ["dataTunnel", "possible data tunnel for covert communication and protection bypassing", "可能是用于隐蔽通信和绕过防护的数据隧道"],
    ["customIP", "IP address is in the custom filter list", "IP 地址在自定义过滤列表中"],
    ["customAS", "AS is in the custom filter list", "自治系统（AS）在自定义过滤列表中"],
    ["customCountry", "country is in the custom filter list", "国家/地区在自定义过滤列表中"],
    ["fastTracked", "fast-tracked", "已通过快速处理"],
    ["splitProxy", "split tunnel connection proxied by Portmaster", "由 Portmaster 代理的分流连接"],
    ["rogueDNS", "redirecting rogue dns query", "正在重定向绕过设置的 DNS 查询"],
    ["disabled", "privacy filter disabled", "隐私过滤器已禁用"],
    ["notDNS", "none DNS data on DNS port", "DNS 端口上出现非 DNS 数据"],
    ["promptAllow", "allowed via prompt", "已通过连接提示允许"],
    ["promptBlock", "blocked via prompt", "已通过连接提示阻止"],
    ["promptCanceled", "prompting canceled, waiting for new decision", "连接提示已取消，正在等待新的决定"],
    ["promptPending", "prompting in progress, please respond to prompt", "正在等待连接决定，请回应连接提示"],
    ["shutdown", "shutting down", "正在关闭"],
    ["noProfile", "no profile set", "未设置配置文件"],
    ["splitRules", "failed to check Split Tunnel rules", "检查分流规则失败"],
    ["spnRules", "failed to check SPN rules", "检查 SPN 规则失败"],
    ["spnNotReady", "SPN not ready for tunneling", "SPN 尚未准备好建立隧道"],
    ["bypassCanary", "bypass prevention: blocked canary domain to prevent enabling of DNS-over-HTTPs", "防绕过：已阻止探测域名，以防启用 DNS-over-HTTPS"],
    ["bypassDNS", "bypass prevention: blocked DNS query, manual dns setup required", "防绕过：已阻止 DNS 查询，需要手动配置 DNS"],
    ["bypassResolver", "bypass prevention: blocked rogue connection to DNS resolver", "防绕过：已阻止绕过设置连接 DNS 解析器"]
  ];
  for (const [id, text, translated] of fixedReasons) {
    assert(backend.includes(JSON.stringify(text.startsWith('bypass prevention: ') ? text.slice('bypass prevention: '.length) : text)), id + ': backend source changed');
    checkReason(reason(text), translated);
    for (const changed of ['changed ' + text, text + '\n', ' ' + text]) checkReason(reason(changed), changed);
  }
  assert(backend.includes('"bypass prevention: "'));
  const ruleSource = source('../../service/profile/endpoints/reason.go');
  assert(ruleSource.includes('prefix + r.description + " " + r.Filter[2:]'));
  const endpointSource = ['any', 'asn', 'country', 'continent', 'domain', 'ip', 'iprange', 'lists', 'scopes']
    .map(file => source('../../service/profile/endpoints/endpoint-' + file + '.go')).join('\n');
  const descriptions = [
    ["matches", "matches", "匹配"],
    ["asnMissing", "ASN data not available to match", "缺少用于匹配的 ASN 数据"],
    ["as", "IP is part of AS", "IP 属于自治系统"],
    ["countryMissing", "country data not available to match", "缺少用于匹配的国家/地区数据"],
    ["location", "IP is located in", "IP 位于"],
    ["domain", "domain matches", "域名匹配"],
    ["ip", "IP matches", "IP 匹配"],
    ["range", "IP is in", "IP 位于地址范围"],
    ["list", "filterlist contains", "过滤列表包含"],
    ["scope", "scope matches", "范围匹配"]
  ];
  for (const [id, description, translated] of descriptions) {
    assert(endpointSource.includes(JSON.stringify(description)), id + ': endpoint description changed');
    for (const permitted of [true, false]) {
      const rule = '*.example.invalid TCP/443 {{RULE}} <literal> 中文';
      const context = Object.freeze({ Filter: (permitted ? '+ ' : '- ') + rule, Permitted: permitted, Value: 'raw', Extra: {} });
      const message = (permitted ? 'allowed' : 'denied') + ' by rule: ' + description + ' ' + rule;
      checkReason(reason(message, context), (permitted ? '规则允许：' : '规则拒绝：') + rule + '（' + translated + '）');
      for (const invalid of [null, {}, [], { ...context, Filter: null }, { ...context, Permitted: !permitted },
        { ...context, Permitted: 'true' }, { ...context, Filter: context.Filter + 'changed' }]) checkReason(reason(message, invalid), message);
      checkReason(reason(message + '\n', context), message + '\n');
    }
  }
  const rawDetails = 'unknown process or profile\n<&> **raw** {$ERROR} {{TOKEN}}';
  for (const [template, translated] of [
    ['failed to request tunneling: %s', '请求建立隧道失败：'],
    ['failed to request split-tunneling: %s', '请求建立分流隧道失败：'],
  ]) {
    assert(backend.includes(JSON.stringify(template)), 'Tunneling producer changed');
    checkReason(reason(template.replace('%s', rawDetails)), translated + rawDetails);
    const incomplete = template.replace('%s', '');
    checkReason(reason(incomplete), incomplete);
  }
  for (const [template, text, expected] of [
    ['response to multi/broadcast query to %s/%s', 'response to multi/broadcast query to UDP/[2001:db8::1]:5353', '响应发送到 UDP/[2001:db8::1]:5353 的组播/广播查询'],
    ['auto allowed: domain is related to process: %s is related to %s', 'auto allowed: domain is related to process: 原始 is related to 进程 <&> {{PROCESS}}', '自动允许：域名与进程相关：原始 与 进程 <&> {{PROCESS}} 相关'],
    ['domain %s matches %s in custom filter list', 'domain 原始.test matches *.test in custom filter list', '域名 原始.test 匹配自定义过滤列表中的 *.test'],
    ['domain alias (CNAME) %s matches %s in custom filter list', 'domain alias (CNAME) alias.test matches *.test in custom filter list', '域名别名（CNAME）alias.test 匹配自定义过滤列表中的 *.test'],
  ]) {
    assert(backend.includes(JSON.stringify(template)), 'Formatted producer changed');
    checkReason(reason(text, null, 'filter/customListFile'), expected);
    checkReason(reason('changed ' + text, null, 'filter/customListFile'), 'changed ' + text);
    checkReason(reason(text + '\n', null, 'filter/customListFile'), text.startsWith('auto allowed:') ? expected.replace(/ 相关$/, '\n 相关') : text + '\n');
    if (text.includes('custom filter list')) checkReason(reason(text), text);
  }
  for (const text of ['', '__proto__', 'constructor', 'backend future response',
    'denied by rule: new description *.test',
    'auto allowed: domain is related to process: app is related to name is related to another',
    'domain a matches b matches c in custom filter list',
    'domain alias (CNAME) a matches b matches c in custom filter list']) checkReason(reason(text, null, 'filter/customListFile'), text);
  for (const value of [null, undefined, {}, { Msg: null }, { Msg: 7 }, { Msg: {} }]) checkReason(value, '');
  console.log(`Connection reasons: ${fixedReasons.length} fixed messages, ${descriptions.length} rule descriptions, ${reasonChecks} regression checks.`);

  const settings = load('src/app/shared/config/setting-text.pipe.ts');
  const copied = [], toasts = [], routes = [], saved = [];
  const rawError = 'backend error: + *.example.invalid TCP/443 ?key=Allow';
  const indicator = Object.fromEntries(['info', 'success', 'error'].map(name => [name, (...args) => toasts.push([name, ...args])]));
  indicator.getErrorMessage = indicator.getErrorMessgae = error => error?.message || String(error);
  const integration = { writeToClipboard: async value => { copied.push(value); } };
  class CountryNameToken {}
  class HttpClientToken {}
  class IndicatorToken {}
  let countryService;
  const countryResponse = Object.freeze({ CN: Object.freeze({ Name: 'China' }), US: Object.freeze({ Name: 'United States' }), AA: Object.freeze({ Name: 'Future Country' }) });
  const injectedCore = {
    ...core,
    inject: token => token === 'locale' ? 'zh-CN'
      : token === CountryNameToken ? countryService
      : token === HttpClientToken ? { get: url => { assert.equal(url, 'http://test.invalid/v1/intel/geoip/countries'); return rxjs.of(countryResponse); } }
      : token === IndicatorToken ? indicator : integration,
  };
  const helperModule = load('src/app/shared/netquery/connection-helper.service.ts', {
    '@angular/core': injectedCore, '@safing/portmaster-api': api, '../utils': shared,
    '../config/setting-text.pipe': settings, './utils': labels,
    './pipes/country-name.pipe': { CountryNameService: CountryNameToken },
    'src/app/integration': { INTEGRATION_SERVICE: 'integration' },
  }, { window: {} });
  const decoder = Object.create(helperModule.NetqueryHelper.prototype);
  decoder.spnMapPins$ = new rxjs.BehaviorSubject([]);
  for (const field of ['verdict', 'scope']) {
    const raw = [0, 3, 99, '99', '__proto__', 'constructor', 'future-value'];
    assert.deepEqual(plain(decoder.decodePrettyValues(field, raw)), raw, `${field}: raw/unknown values must survive decoding`);
  }
  assert.deepEqual(plain(decoder.decodePrettyValues('verdict', ['Block', 'Undecided'])), [3, 0]);
  assert.deepEqual(plain(decoder.decodePrettyValues('scope', ['Internet', 'Global', 'Undefined', 'LAN'])), [4, 4, 0, 3]);
  const matcher = Object.freeze({ $ne: 3 });
  assert.equal(decoder.decodePrettyValues('verdict', [matcher])[0], matcher);
  assert.deepEqual(plain(decoder.decodePrettyValues('allowed', ['yes', 'no', 'null', true, false, 'Allow'])), [true, false, null, true, false, 'Allow']);

  const countryNames = load('src/app/shared/netquery/pipes/country-name.ts');
  assert.equal(countryNames.getCountryName('CN', 'China', 'zh-CN'), '中国');
  assert.equal(countryNames.getCountryName('US', 'United States', 'zh-CN'), '美国');
  assert.equal(countryNames.getCountryName('CN', 'China', 'en-US'), 'China');
  const uiLocale = localize.locale;
  try {
    localize.locale = 'zh-CN';
    assert.equal(countryNames.getCountryName('CN', 'China', 'en-GB'), '中国', 'Country labels must follow the UI language, not the date-format setting');
    assert.equal(countryNames.getCountryName('AA', 'Future Country', 'en-GB'), 'Future Country');
    localize.locale = 'en-GB';
    assert.equal(countryNames.getCountryName('CN', 'China', 'zh-CN'), 'China');
  } finally {
    localize.locale = uiLocale;
  }
  assert.equal(countryNames.getCountryName('__', 'Anycast', 'zh-CN'), '任播');
  for (const code of ['AA', 'ZZ', 'us', '__proto__', 'constructor', '', 'Future Country']) {
    assert.equal(countryNames.getCountryName(code, 'unmodified backend name', 'zh-CN'), 'unmodified backend name');
  }
  assert.equal(countryNames.getCountryName('CN', 'China', 'not_a_locale'), 'China');
  assert.equal(load('src/app/shared/netquery/pipes/country-name.ts', {}, { Intl: {} }).getCountryName('CN', 'China', 'zh-CN'), 'China');
  const countries = load('src/app/shared/netquery/pipes/country-name.pipe.ts', {
    '@angular/core': injectedCore, '@angular/common/http': { HttpClient: HttpClientToken },
    '../../action-indicator': { ActionIndicatorService: IndicatorToken }, '../../utils': shared,
    '@safing/portmaster-api': api, './country-name': countryNames,
    'src/environments/environment': { environment: { httpAPI: 'http://test.invalid' } },
  });
  countryService = new countries.CountryNameService();
  assert.equal(countryService.resolveName('CN'), '中国');
  assert.equal(countryService.resolveName('AA'), 'Future Country');
  assert.equal(countryService.resolveName('future-code'), 'future-code');
  assert.equal(countryResponse.CN.Name, 'China');

  const original = Object.freeze({ Source: 'local', ID: 'raw-id', Name: 'Allow user app', Config: Object.freeze({
    filter: Object.freeze({ endpoints: Object.freeze(['+ *.example.invalid TCP/443', '- blocked.invalid']), serviceEndpoints: Object.freeze(['+ 192.0.2.0/24 UDP/53']) }),
  }) });
  const profileService = {
    watchProfiles: () => rxjs.of([original]), getAppProfile: id => { assert.equal(id, 'local/raw-id'); return rxjs.of(original); },
    saveProfile: profile => { saved.push(plain(profile)); return rxjs.of(undefined); },
  };
  const setting = Object.freeze({ Key: 'filter/blockInternet', Name: 'Force Block Internet Access', Value: 'Allow' });
  const helper = new helperModule.NetqueryHelper(
    { navigate: (...args) => { routes.push(plain(args)); } }, profileService, { query: () => rxjs.of([setting]) }, indicator,
    { listen: () => () => {} }, { watchPins: () => rxjs.of([{ ID: 'raw-node', Name: 'Allow node', VerifiedOwner: 'User-controlled owner' }]) }, {},
  );
  const displayedReason = Object.freeze({ Msg: 'Internet access blocked', Context: null, OptionKey: 'filter/blockInternet', Profile: 'core:profiles/local/raw-id' });
  const displayedConnection = Object.freeze({ profile: 'local/raw-id', verdict: 3, extra_data: Object.freeze({ reason: displayedReason }) });
  assert.equal(helper.reasonText(displayedReason), '已阻止互联网访问');
  await helper.dumpConnection(displayedConnection);
  assert.deepEqual(JSON.parse(copied.at(-1)), displayedConnection, 'Copied JSON must contain the original English reason');
  helper.redirectToSetting('', displayedConnection);
  assert.deepEqual(routes.at(-1), [['/', 'app', 'local', 'raw-id'], { queryParams: { tab: 'settings', setting: 'filter/blockInternet' } }]);
  assert.equal(helper.settings[setting.Key], settings.localizeSettingText(setting.Name));
  assert.notEqual(helper.settings[setting.Key], setting.Name);
  assert.equal(setting.Name, 'Force Block Internet Access');
  assert.equal(setting.Value, 'Allow');
  for (const [field, value, name] of [['verdict', 3, '阻止'], ['scope', 4, '互联网'], ['allowed', false, '否'], ['encrypted', true, '是'], ['direction', 'inbound', '传入'], ['type', 'dns', 'DNS 请求'], ['country', 'CN', '中国'], ['country', '__', '任播'], ['profile', 'local/raw-id', original.Name]]) {
    const row = Object.freeze({ [field]: value, count: 17 });
    const values = await rxjs.firstValueFrom(rxjs.of([row]).pipe(helper.encodeToPossibleValues(field)));
    assert.equal(values[0].Name, name);
    assert.equal(values[0].Value, value);
    assert.equal(values[0].count, 17);
    assert.equal(row[field], value);
  }
  for (const field of ['verdict', 'scope', 'direction', 'type', 'as_owner']) {
    const values = await rxjs.firstValueFrom(rxjs.of([{ [field]: rawError }]).pipe(helper.encodeToPossibleValues(field)));
    assert.equal(values[0].Name, rawError);
    assert.equal(values[0].Value, rawError);
  }
  assert.equal(helper.getVerdictClass({ verdict: 3 }), 'block');
  assert.equal(helper.getVerdictClass({ verdict: 99 }), 'unknown-verdict<99>');
  const pin = (await rxjs.firstValueFrom(rxjs.of([{ exit_node: 'raw-node' }]).pipe(helper.encodeToPossibleValues('exit_node'))))[0];
  assert.equal(pin.Value, 'raw-node');
  assert.equal(pin.Name, 'Allow node');
  assert.equal(pin.Description, '运营方：User-controlled owner');
  helper.spnMapPins$.next(null);
  const missingPin = (await rxjs.firstValueFrom(rxjs.of([{ exit_node: 'unknown-node' }]).pipe(helper.encodeToPossibleValues('exit_node'))))[0];
  assert.equal(missingPin.Value, 'unknown-node');
  assert.equal(missingPin.Description, '运营方：暂无');

  const token = load('src/app/shared/netquery/textql/token.ts');
  const parserHelpers = load('src/app/shared/netquery/textql/helper.ts', { './token': token });
  const input = load('src/app/shared/netquery/textql/input.ts');
  const lexer = load('src/app/shared/netquery/textql/lexer.ts', { './helper': parserHelpers, './input': input, './token': token });
  const parser = load('src/app/shared/netquery/textql/parser.ts', { './helper': parserHelpers, './lexer': lexer, './token': token });
  for (const [query, character, position] of [['?', '?', 0], ['(', '(', 0], ['country:CN ?', '?', 11], ['country:CN\n?', '?', 11], ['\r\n中', '中', 2]]) {
    assert.throws(() => parser.Parser.parse(query), { name: 'Error', message: `无法处理字符：${character}，位置 0:${position}` });
  }
  const stream = new input.InputStream('a\nb');
  stream.next(); stream.next();
  assert.throws(() => stream.croak('raw token COLON ?'), { name: 'Error', message: 'raw token COLON ?，位置 0:2' });
  assert.equal(stream.pos, 2);
  assert.equal(stream.left, 'b');
  assert.deepEqual(plain(parser.Parser.parse('app:"local/raw-id" provider:"Example Owner" ip:192.0.2.1 port:443 allowed:yes encrypted:no verdict:!3 bytes_sent:12.5 domain:"中文?.example.invalid" groupby:country orderby:started hello')), {
    groupBy: ['country'], orderBy: ['started'], textQuery: 'hello',
    conditions: { profile: ['local/raw-id'], as_owner: ['Example Owner'], remote_ip: ['192.0.2.1'], remote_port: [443], allowed: [true], encrypted: [false], verdict: [{ $ne: 3 }], bytes_sent: [12.5], domain: ['中文?.example.invalid'] },
  });
  for (const field of ['country', 'verdict', 'groupby', 'orderby']) {
    const partial = new parser.Parser(field + ':');
    assert.deepEqual(plain(partial.process()), { conditions: {}, textQuery: field });
    assert.deepEqual(plain(partial.lastUnterminatedCondition), { start: 0, type: field, value: '' });
  }
  assert.deepEqual(plain(parser.Parser.parse('verdict:!')), { conditions: {}, textQuery: 'verdict' });
  assert.deepEqual(plain(parser.Parser.parse('domain:"unterminated')), { conditions: { domain: ['unterminated'] }, textQuery: '' });
  assert.deepEqual(plain(parser.Parser.parse('country: CN')), { conditions: {}, textQuery: 'country CN' });
  const completion = new parser.Parser('country:CN domain:');
  assert.deepEqual(plain(completion.process()), { conditions: { country: ['CN'] }, textQuery: 'domain' });
  assert.deepEqual(plain(completion.lastUnterminatedCondition), { start: 11, type: 'domain', value: '' });
  const duration = load('src/app/shared/pipes/duration.pipe.ts');
  const bytes = load('src/app/shared/pipes/bytes.pipe.ts');
  const chart = load('src/app/shared/netquery/line-chart/line-chart.ts', { d3, '../../utils': shared, '../../pipes': duration, '../../pipes/bytes.pipe': bytes });
  const viewerModule = load('src/app/shared/netquery/netquery.component.ts', {
    '@angular/core': { ...injectedCore, inject: token => token === 'locale' ? 'zh-CN' : { ...integration, profile$: rxjs.of(null) } },
    '@angular/core/rxjs-interop': { takeUntilDestroyed: () => stream => stream },
    '@safing/portmaster-api': api, '@safing/ui': {}, '../utils': shared, './../animations': {},
    './connection-helper.service': helperModule, './textql': parser, './utils': labels, './line-chart/line-chart': chart,
    'src/app/integration': { INTEGRATION_SERVICE: 'integration' },
  });
  const cdr = { markForCheck() {}, detectChanges() {} };
  const viewer = new viewerModule.SfngNetqueryViewer({}, helper, { currentLevel: 'expert' }, cdr, indicator, {}, {});
  viewer.paginator = { clear() {} };
  const path = 'C:\\Allow 中文\\app.exe --domain="raw"';
  viewer.onFieldsParsed({ verdict: [3], scope: [4], country: ['CN'], direction: ['inbound'], path: [path], allowed: [false] });
  viewer.groupByKeys = ['country', 'direction'];
  viewer.orderByKeys = ['started'];
  const query = viewer.getQuery();
  assert.deepEqual(plain(query.query.verdict), [{ $in: [3] }]);
  assert.deepEqual(plain(query.query.internal), [{ $eq: false }]);
  assert.deepEqual(plain(query.groupBy), ['country', 'direction']);
  assert.deepEqual(plain(query.orderBy), ['started']);
  assert.deepEqual(plain(query.select[1].$sum.condition.verdict.$in), [2, 5, 6, 8]);
  const parsed = parser.Parser.parse(viewer.getQueryString());
  assert.equal(parsed.conditions.path[0], path);
  assert.equal(parsed.conditions.verdict[0], 3);
  assert.deepEqual(plain(parsed.groupBy), ['country', 'direction']);
  assert.deepEqual(plain(parser.Parser.parse('verdict:!3 ').conditions), { verdict: [{ $ne: 3 }] });
  viewer.useAsFilter({ country: 'US', direction: 'outbound', __profile: { Name: 'display only' } });
  assert.deepEqual(plain(viewer.models.country.searchValues), ['US']);
  assert.deepEqual(plain(viewer.models.direction.searchValues), ['outbound']);
  viewer.onTagbarChange([{ key: 'verdict', values: [{ Name: '阻止', Value: 3 }] }, { key: 'allowed', values: [{ Name: '否', Value: false }] }]);
  assert.deepEqual(plain(viewer.models.verdict.searchValues), [3]);
  assert.deepEqual(plain(viewer.models.allowed.searchValues), [false]);
  const selected = viewer.models.direction.suggestions[0];
  viewer.toggleCombinedMenuFilter('direction', selected);
  assert.deepEqual(plain(viewer.models.direction.searchValues), ['inbound']);
  for (const [name, seconds] of Object.entries({ "⏸\u00a0\u00a0Don't auto-reload": 0, '↻\u00a0\u00a0Reload every 10 seconds': 10, '↻\u00a0\u00a0Reload every 1 minute': 60, '↻\u00a0\u00a0Reload every 5 minutes': 300 })) {
    assert.equal(viewerModule.reloadIntervalValues[name].seconds, seconds);
    viewer.onAutoRefreshChange(name);
    assert.equal(viewer.autoReloadIntervalName, seconds === 0 ? '' : name);
  }
  const from = new Date(2026, 10, 10, 13, 14, 15), to = new Date(2026, 10, 11, 14, 15, 16);
  viewer.applyQuickDateSetting({ apply: () => [from, to] });
  assert.deepEqual(plain(viewer.dateFilter.map(date => date.getTime())), [from.getTime(), to.getTime()]);
  assert.equal(viewer.models.from.searchValues[0], common.formatDate(from, 'medium', 'en-US'));
  const before = viewer.getQueryString();
  viewer.getQuery();
  assert.equal(viewer.getQueryString(), before, 'Repeated date rendering must not corrupt saved filter tokens');
  const dateTag = (await rxjs.firstValueFrom(rxjs.of([{ from: viewer.models.from.searchValues[0] }]).pipe(helper.encodeToPossibleValues('from'))))[0];
  assert.equal(dateTag.Name, common.formatDate(from, 'medium', 'zh-CN'));
  assert.equal(dateTag.Value, common.formatDate(from, 'medium', 'en-US'));
  const range = viewer.getQuery().query.started[0];
  assert.equal(range.$ge, Math.floor(from.getTime() / 1000));
  assert.equal(range.$le, Math.floor(to.getTime() / 1000));

  const searchbarModule = load('src/app/shared/netquery/searchbar/searchbar.ts', {
    '@angular/cdk/a11y': {}, '@angular/cdk/overlay': {}, '@angular/core': injectedCore,
    '@angular/core/rxjs-interop': { takeUntilDestroyed: () => stream => stream }, '@angular/forms': {},
    '../../animations': {}, '@safing/ui': {}, '@safing/portmaster-api': api, '../../utils': shared,
    '../connection-helper.service': helperModule, '../textql': parser, '../utils': labels,
    '../../action-indicator': { ActionIndicatorService: IndicatorToken },
  });
  const searchbar = new searchbarModule.SfngNetquerySearchbarComponent(cdr, {}, {}, helper, indicator);
  const emitted = [];
  searchbar.fieldsParsed.subscribe(fields => emitted.push(plain(fields)));
  searchbar.applySuggestion('verdict', 3, { shiftKey: true });
  assert.equal(searchbar.textSearch, 'verdict:3 ');
  searchbar.parseAndEmit();
  assert.equal(emitted[0].verdict[0], 3, 'Shift suggestion -> textql -> decoder must keep the numeric verdict');
  searchbar.applySuggestion('country', 'CN', { shiftKey: false });
  assert.equal(emitted.at(-1).country[0], 'CN');
  const changedSearch = [];
  searchbar.registerOnChange(value => changedSearch.push(value));
  const emittedBeforeError = emitted.length;
  searchbar.textSearch = '?';
  assert.doesNotThrow(() => searchbar.parseAndEmit());
  assert.equal(searchbar.textSearch, '?');
  assert.equal(emitted.length, emittedBeforeError);
  assert.equal(changedSearch.length, 0);
  assert.deepEqual(toasts.at(-1), ['error', '搜索查询无效', '无法处理字符：?，位置 0:0']);
  assert.doesNotThrow(() => searchbar.applySuggestion('country', 'CN', { shiftKey: true }));
  assert.equal(searchbar.textSearch, '?');
  assert.equal(emitted.length, emittedBeforeError);
  const toastsBeforeWrite = toasts.length;
  assert.doesNotThrow(() => searchbar.writeValue('?'));
  assert.equal(searchbar.textSearch, '?');
  assert.equal(toasts.length, toastsBeforeWrite);
  searchbar.textSearch = 'country:? domain:old';
  assert.doesNotThrow(() => searchbar.applySuggestion('domain', 'chosen.invalid', { shiftKey: false }, 10));
  assert.equal(searchbar.textSearch, 'country:? domain:old');
  assert.equal(emitted.length, emittedBeforeError, 'An invalid stale suggestion prefix must not partially emit a new filter');
  searchbar.textSearch = 'country:CN';
  searchbar.parseAndEmit();
  assert.deepEqual(emitted.at(-1).country, ['CN']);
  assert.equal(changedSearch.at(-1), '');

  const settledSuggestions = new rxjs.Subject();
  const suggestionRequests = [];
  const suggestions = new searchbarModule.SfngNetquerySearchbarComponent(
    { markForCheck: () => settledSuggestions.next() }, { currentLevel: 'expert' },
    { query: (query, origin) => { suggestionRequests.push({ query: plain(query), origin }); return rxjs.of([]); } }, helper, indicator,
  );
  suggestions.keyManager = { setActiveItem() {} };
  suggestions.suggestionDropDown = { show() {}, close() {} };
  suggestions.ngOnInit();
  for (const value of ['country:?', 'country:CN']) {
    suggestions.textSearch = value;
    const settled = rxjs.firstValueFrom(settledSuggestions.pipe(rxjs.take(1), rxjs.timeout(5000)));
    suggestions.loadSuggestions();
    await settled;
    assert.equal(suggestions.loading, false);
    assert.deepEqual(plain(suggestions.suggestions), []);
    if (value === 'country:?') assert.equal(suggestionRequests.length, 0);
  }
  assert.equal(suggestionRequests.length, 1, 'A bad query must not terminate the suggestion stream');
  assert.equal(suggestionRequests[0].origin, 'netquery-searchbar-get-counts');
  assert.deepEqual(suggestionRequests[0].query.query.country, { $like: '%CN%' });
  suggestions.ngOnDestroy();
  settledSuggestions.complete();
  const add = load('src/app/shared/netquery/add-to-filter/add-to-filter.ts', {
    '@angular/core': injectedCore, 'src/app/integration': { INTEGRATION_SERVICE: 'integration' },
  });
  const directive = new add.SfngNetqueryAddToFilterDirective(helper, indicator, cdr);
  directive.key = 'direction'; directive.value = 'inbound';
  let filter;
  const subscription = helper.onFieldsAdded().subscribe(fields => { filter = plain(fields); });
  directive.onClick({ shiftKey: true, preventDefault() {}, stopPropagation() {} });
  assert.deepEqual(filter, { direction: ['inbound'] });
  directive.onClick({ ctrlKey: true, preventDefault() {}, stopPropagation() {} });
  await Promise.resolve();
  assert.equal(copied.at(-1), 'inbound');

  for (const direction of ['inbound', 'outbound']) {
    const conn = Object.freeze({ profile: 'local/raw-id', direction, verdict: 3, extra_data: { reason: { OptionKey: 'filter/blockInternet', Profile: 'core:profiles/local/raw-id', Msg: rawError } } });
    const key = direction === 'inbound' ? 'filter/serviceEndpoints' : 'filter/endpoints';
    helper.blockAll('example.invalid...', conn);
    assert.equal(api.getAppSetting(saved.at(-1).Config, key)[0], '- example.invalid');
    helper.unblockAll('192.0.2.1', conn);
    assert.equal(api.getAppSetting(saved.at(-1).Config, key)[0], '+ 192.0.2.1');
    helper.redirectToRules(conn);
    assert.deepEqual(routes.at(-1), [['/', 'app', 'local', 'raw-id'], { queryParams: { tab: 'settings', setting: key } }]);
    await helper.dumpConnection(conn);
    assert.deepEqual(JSON.parse(copied.at(-1)), plain(conn));
  }
  assert.deepEqual(plain(original.Config.filter.endpoints), ['+ *.example.invalid TCP/443', '- blocked.invalid']);
  integration.writeToClipboard = async () => { throw new Error(rawError); };
  await helper.dumpConnection({ profile: 'local/raw-id' });
  assert.deepEqual(toasts.at(-1), ['error', '复制到剪贴板失败', rawError]);
  const { CanUseRulesPipe } = load('src/app/shared/netquery/pipes/can-use-rules.pipe.ts', { '@safing/portmaster-api': api });
  assert.equal(new CanUseRulesPipe().transform({ verdict: 3, extra_data: { reason: { OptionKey: 'filter/blockInternet' } } }), false);
  const { ConnectionLocationPipe } = load('src/app/shared/netquery/pipes/location.pipe.ts', { '@safing/portmaster-api': api });
  const location = new ConnectionLocationPipe();
  for (const [conn, expected] of [[{ type: 'dns', country: 'CN' }, ''], [{ type: 'ip', country: 'CN' }, 'CN'], [{ type: 'ip', country: '__' }, '任播'], [{ type: 'ip', scope: 4 }, '互联网'], [{ type: 'ip', scope: 3 }, '局域网'], [{ type: 'ip', scope: 1 }, '本机'], [{ type: 'ip', country: rawError }, rawError]]) assert.equal(location.transform(conn), expected);
  const { SfngNetqueryScopeLabelComponent } = load('src/app/shared/netquery/scope-label/scope-label.ts', { '@safing/portmaster-api': api, '../utils': labels, '../../utils': shared });
  const scope = new SfngNetqueryScopeLabelComponent();
  for (const [value, expected] of [['IH', '本机传入'], ['PI', '互联网点对点']]) {
    scope.scope = value; scope.ngOnChanges({ scope: { currentValue: value } });
    assert.equal(scope.scopeTranslation.get(value), expected);
    assert.equal(scope.domain, '');
    assert.equal(scope.scope, value);
  }
  scope.ngOnChanges({ scope: { currentValue: 'www.example.com.' } });
  assert.equal(scope.domain, 'example.com'); assert.equal(scope.subdomain, 'www');
  assert.equal(scope.scopeTranslation.get('constructor'), undefined);
  assert.equal(chart.DefaultBandwidthChartConfig.valueFormat(1024, 'incoming'), '已接收：1,024 B');
  assert.equal(chart.DefaultBandwidthChartConfig.tooltipFormat({ incoming: 2000, outgoing: 0 }), '已接收：1.95 kB\n已发送：0 B');
  const template = source('src/app/shared/netquery/netquery.component.html');
  assert(template.includes('(click)="onAutoRefreshChange(value)"'));
  assert(template.includes('[appCountryFlags]="data[key]"'));
  assert(template.includes('data[key] | countryName'));
  for (const file of ['connection-details/conn-details.html', 'connection-row/conn-row.html']) {
    const html = source('src/app/shared/netquery/' + file);
    assert(html.includes('helper.blockAll(conn.domain || conn.remote_ip, conn)'));
    assert(html.includes('helper.unblockAll(conn.domain || conn.remote_ip, conn)'));
    assert(html.includes('helper.reasonText(conn.extra_data?.reason)'), 'List and detail must share the reason display function');
  }
  subscription.unsubscribe(); searchbar.ngOnDestroy(); helper.dispose();
}
