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
  });
  const searchbar = new searchbarModule.SfngNetquerySearchbarComponent(cdr, {}, {}, helper);
  const emitted = [];
  searchbar.fieldsParsed.subscribe(fields => emitted.push(plain(fields)));
  searchbar.applySuggestion('verdict', 3, { shiftKey: true });
  assert.equal(searchbar.textSearch, 'verdict:3 ');
  searchbar.parseAndEmit();
  assert.equal(emitted[0].verdict[0], 3, 'Shift suggestion -> textql -> decoder must keep the numeric verdict');
  searchbar.applySuggestion('country', 'CN', { shiftKey: false });
  assert.equal(emitted.at(-1).country[0], 'CN');
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
    assert(html.includes('conn.extra_data?.reason?.Msg') || html.includes('conn.extra_data?.reason as reason'));
  }
  subscription.unsubscribe(); searchbar.ngOnDestroy(); helper.dispose();
}
