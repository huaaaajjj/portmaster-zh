import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import Fuse from 'fuse.js';

const source = file => readFileSync(fileURLToPath(new URL('../' + file, import.meta.url)), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const expertise = { user: 0, expert: 1, developer: 2 };
function load(file, localize) {
  const compiled = ts.transpileModule(source(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true }
  }).outputText;
  const exports = {};
  runInNewContext(compiled, {
    exports, $localize: localize,
    require(name) {
      if (name === '@angular/core') return { Pipe: () => type => type, Injectable: () => type => type };
      if (name === '@safing/portmaster-api') return { deepClone: structuredClone, ExpertiseLevelNumber: expertise };
      if (name === 'fuse.js') return { default: Fuse };
      throw new Error(`Unexpected test import: ${name}`);
    }
  });
  return exports;
}

// Called while the real zh-CN catalog is loaded by check-i18n.mjs.
export function checkSettingsLocalization(localize) {
  const { localizeSettingText, SettingTextPipe } = load('src/app/shared/config/setting-text.pipe.ts', localize);
  assert.equal(localizeSettingText('Default Network Action'), '默认网络操作');
  assert.equal(localizeSettingText('Allow'), '允许');
  assert.equal(localizeSettingText('Exclude'), '排除');
  assert.equal(localizeSettingText(undefined), '');
  assert.equal(new SettingTextPipe().transform(null), '');
  for (const value of ['', '__proto__', 'constructor', 'New server description', '+ *.example.com TCP/443', 'dot://dns.example?ip=1.2.3.4']) {
    assert.equal(localizeSettingText(value), value, `Unknown display text must pass through: ${value}`);
  }

  // Run the actual display projection and search options from the component.
  const component = source('src/app/shared/config/config-settings.ts');
  const projection = component.match(/settings = settings\.map\(setting => \(\{[\s\S]*?\}\)\);/)?.[0];
  const options = component.match(/this\.searchService\.searchList\(settings, searchTerm, (\{[\s\S]*?\n          \})\);/)?.[1];
  assert(projection && options, 'Could not locate settings display projection and search options');
  const settings = [
    {
      Key: 'filter/endpoints', Name: 'Outgoing Rules',
      Description: 'Rules that apply to outgoing network connections. Cannot overrule Network Scopes and Connection Types (see above).',
      Value: ['+ example.com TCP/443', '- *'], DefaultValue: [],
      Annotations: { 'safing/portbase:ui:category': 'Rules', 'safing/portbase:ui:quick-setting': { Name: 'Allow SSH', Action: 'merge-top', Value: ['+ * TCP/22'] } },
      PossibleValues: [{ Name: 'Allow', Value: 'permit', Description: 'Allow all connections' }],
      ValidationRegex: '^[+-] ', OptType: 2,
    },
    { Key: 'filter/blockInternet', Name: 'Force Block Internet Access', Value: false, DefaultValue: false },
    { Key: 'dns/nameservers', Name: 'DNS Servers', Value: ['dot://dns.example?ip=1.2.3.4'], DefaultValue: [] },
  ];
  const before = JSON.stringify(settings);
  const display = runInNewContext(projection + '\nsettings', { settings, localizeSettingText });
  assert.equal(JSON.stringify(settings), before, 'Localization mutated original settings');
  const machineData = rows => plain(rows.map(({ Name, Description, ...rest }) => rest));
  assert.deepEqual(machineData(display), machineData(settings), 'Localization changed configuration values or metadata');
  assert.equal(display[0].Name, '出站规则');
  const { FuzzySearchService } = load('src/app/shared/fuzzySearch/fuse.service.ts', localize);
  const search = new FuzzySearchService();
  const searchOptions = runInNewContext('(' + options + ')');
  for (const [term, key] of [['规则', 'filter/endpoints'], ['阻止', 'filter/blockInternet']]) {
    const found = search.searchList(display, term, searchOptions).map(result => result.item);
    assert.deepEqual(plain(found.map(item => item.Key)), [key], `Search failed for ${term}`);
    assert.deepEqual(machineData(found), machineData(settings.filter(item => item.Key === key)), 'Search changed configuration identity or values');
  }
  assert.equal(JSON.stringify(settings), before, 'Search highlighting mutated configuration values');

  // Execute the real refresh callback: repeated searches must not discard subsystem definitions.
  const tree = ts.createSourceFile('config-settings.ts', component, ts.ScriptTarget.Latest, true);
  let refreshNode;
  const visit = node => {
    if (ts.isArrowFunction(node) && node.parameters[0]?.getText(tree) === '[settings, searchTerm, currentReleaseLevelSetting]') refreshNode = node;
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert(refreshNode, 'Settings refresh callback was not found');
  const { subsystems } = load('src/app/shared/config/subsystems.ts', localize);
  const definitionsBefore = plain(subsystems);
  const refreshExports = {};
  runInNewContext(ts.transpileModule('exports.refresh = function([settings, searchTerm, currentReleaseLevelSetting]) ' + refreshNode.body.getText(tree), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 }
  }).outputText, {
    exports: refreshExports, subsystems, localizeSettingText,
    ExpertiseLevelNumber: expertise,
    releaseLevelFromName: name => ({ stable: 0, beta: 1, experimental: 2 }[name]),
  });
  const view = { subsystems, searchService: search, _highlightKey: null };
  const input = [
    { Key: 'filter/defaultAction', Name: 'Default Network Action', ReleaseLevel: 0, ExpertiseLevel: 0, Annotations: {} },
    { Key: 'dns/nameserverRetryRate', Name: 'Retry Failing DNS Servers', ReleaseLevel: 0, ExpertiseLevel: 2, Annotations: {} },
    { Key: 'spn/enable', Name: 'SPN Module', ReleaseLevel: 0, ExpertiseLevel: 0, Value: false, Annotations: {} },
  ];
  for (const [term, expected] of [['默认', ['filter']], ['重试', ['dns']], ['不存在的设置', []], ['', ['dns', 'filter', 'spn']]]) {
    refreshExports.refresh.call(view, [input, term, 'stable']);
    assert.deepEqual(plain(view.subsystems.map(item => item.ID).sort()), expected, `Subsystems were lost after search: ${term}`);
    assert.equal(view.others, null, 'Known settings must not fall into Other after a search');
  }
  assert.equal(view.subsystems.find(item => item.ID === 'spn').isDisabled, true);
  refreshExports.refresh.call(view, [input.map(item => item.Key === 'spn/enable' ? { ...item, Value: true } : item), '', 'stable']);
  assert.equal(view.subsystems.find(item => item.ID === 'spn').isDisabled, false, 'Re-enabling a subsystem must clear its disabled state');
  assert.deepEqual(plain(subsystems), definitionsBefore, 'A settings view mutated the shared subsystem definitions');

  const { supportTypes } = load('src/app/pages/support/pages.ts', localize);
  const pages = supportTypes.flatMap(section => section.choices).filter(page => page.type !== 'link');
  assert.deepEqual(plain(pages.map(page => [page.id, page.ghIssuePreset, page.sections.map(section => section.title)])), [
    ['report-bug', 'report-bug.md', ['What happened?', 'What did you expect to happen?', 'How did you reproduce it?', 'Additional information']],
    ['give-feedback', 'suggest-feature.md', ['What would you like to add or change?', 'Why do you and others need this?']],
    ['compatibility-report', 'report-compatibility.md', ['What worked?', 'What did not work?', 'Additional information']],
  ]);
  assert.equal(pages[0].sections[0].label, '发生了什么？');
  assert.equal(pages[0].title, '🐞 报告问题');
  const form = source('src/app/pages/support/form/support-form.html');
  assert(form.includes('{{section.label}}') && form.includes('[(ngModel)]="form[section.title]"'), 'Support labels must not become form keys');

  // Translation may change explanations, never literal examples, parameter names or URLs.
  const textSource = source('src/app/shared/config/setting-text.pipe.ts');
  const ast = ts.createSourceFile('setting-text.pipe.ts', textSource, ts.ScriptTarget.Latest, true);
  let helpCount = 0;
  const inspect = node => {
    if (ts.isArrayLiteralExpression(node) && node.elements.length === 2 && ts.isStringLiteral(node.elements[0])) {
      const english = node.elements[0].text;
      if (english.startsWith('Rules are checked') || english.startsWith('DNS servers are used')) {
        const chinese = localizeSettingText(english);
        assert.notEqual(chinese, english, 'Missing extended help translation');
        assert.deepEqual(chinese.match(/`[^`]*`/g), english.match(/`[^`]*`/g), 'Help changed literal rule/DNS syntax');
        assert.deepEqual(chinese.match(/\]\([^)]+\)/g), english.match(/\]\([^)]+\)/g), 'Help changed links');
        helpCount++;
      }
    }
    ts.forEachChild(node, inspect);
  };
  inspect(ast);
  assert.equal(helpCount, 3, 'Expected shared rule, SPN and DNS help');
}
