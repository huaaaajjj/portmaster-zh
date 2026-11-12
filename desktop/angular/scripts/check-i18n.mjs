import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HtmlParser, XmlParser } from '@angular/compiler';
import '@angular/localize/init';
import { clearTranslations, loadTranslations } from '@angular/localize';
import ts from 'typescript';
import yaml from 'js-yaml';
import { runInNewContext } from 'node:vm';
import { flattenLocalizedOutput } from './flatten-localized-output.mjs';
import { checkSettingsLocalization } from './check-settings-localization.mjs';
import { checkDynamicSpn } from './check-dynamic-spn.mjs';
import { checkDynamicNetquery } from './check-dynamic-netquery.mjs';
import { checkDynamicGeneralLocalization } from './check-dynamic-general.mjs';
import { checkNotifications } from './check-notifications.mjs';

const workspace = fileURLToPath(new URL('../', import.meta.url));
function* elements(nodes, name) {
  for (const node of nodes) {
    if (node.name === name) yield node;
    if (node.children) yield* elements(node.children, name);
  }
}
const attribute = (node, name) => node.attrs.find(attr => attr.name === name)?.value;
const canonical = nodes => nodes.map(node => node.name
  ? { name: node.name, attrs: Object.fromEntries(node.attrs.map(attr => [attr.name, attr.value])), children: canonical(node.children) }
  : node.value);
function catalog(filename) {
  const parsed = new XmlParser().parse(readFileSync(join(workspace, filename), 'utf8'), filename);
  assert.equal(parsed.errors.length, 0, parsed.errors.join('\n'));
  const units = new Map();
  for (const unit of elements(parsed.rootNodes, 'trans-unit')) {
    const id = attribute(unit, 'id');
    assert(id && !units.has(id), `Duplicate or empty message ID: ${id}`);
    units.set(id, unit);
  }
  assert(units.size > 0, `${filename}: empty catalog`);
  return { nodes: parsed.rootNodes, units };
}
function icuStructure(text) {
  if (!/\{VAR_/.test(text)) return [];
  const parsed = new HtmlParser().parse(text, 'ICU message', { tokenizeExpansionForms: true });
  assert.equal(parsed.errors.length, 0, parsed.errors.join('\n'));
  const structure = nodes => nodes.filter(node => node.cases).map(node => ({
    variable: node.switchValue, type: node.type,
    cases: node.cases.map(item => ({ value: item.value, nested: structure(item.expression) }))
      .sort((a, b) => a.value.localeCompare(b.value))
  }));
  return structure(parsed.rootNodes);
}
assert.notDeepEqual(
  icuStructure('{VAR_SELECT, select, true {Yes} other {No}}'),
  icuStructure('{VAR_SELECT, select, false {是} other {否}}'),
  'ICU checks must detect changed branch keys'
);
const source = catalog('src/i18n/messages.source.xlf');
const chinese = catalog('src/i18n/messages.zh-CN.xlf');
assert.equal(attribute([...elements(chinese.nodes, 'file')][0], 'target-language'), 'zh-CN');
assert.deepEqual([...source.units.keys()].sort(), [...chinese.units.keys()].sort(), 'Translation IDs differ from the source catalog');
for (const [id, original] of source.units) {
  const translated = chinese.units.get(id);
  const sourceMessage = [...elements(original.children, 'source')][0];
  const copiedSource = [...elements(translated.children, 'source')][0];
  const target = [...elements(translated.children, 'target')];
  assert(sourceMessage && copiedSource, `Missing English source for ${id}`);
  assert.equal(target.length, 1, `Expected one translation for ${id}`);
  assert.deepEqual(canonical(sourceMessage.children), canonical(copiedSource.children), `Stale English source for ${id}`);
  assert(target[0].children.some(node => node.name || node.value?.trim()), `Empty translation for ${id}`);
  const placeholders = node => [...elements(node.children, 'x')].map(item => attribute(item, 'id')).sort();
  assert.deepEqual(placeholders(sourceMessage), placeholders(target[0]), `Placeholder mismatch for ${id}`);
  const text = node => node.children.map(child => child.name ? '' : child.value).join('');
  assert.deepEqual(icuStructure(text(sourceMessage)), icuStructure(text(target[0])), `ICU branch mismatch for ${id}`);
}

const sourceHelp = yaml.load(readFileSync(join(workspace, 'src/i18n/helptexts.yaml'), 'utf8'));
const chineseHelp = yaml.load(readFileSync(join(workspace, 'src/i18n/helptexts.zh-CN.yaml'), 'utf8'));
function helpMachineData(data) {
  const copy = structuredClone(data);
  for (const entry of Object.values(copy)) {
    for (const field of ['title', 'content', 'urlText']) delete entry[field];
    for (const button of entry.buttons || []) delete button.name;
  }
  return copy;
}
assert.deepEqual(helpMachineData(sourceHelp), helpMachineData(chineseHelp), 'Help keys, links or actions differ');
for (const key of Object.keys(sourceHelp)) {
  const tags = content => (content.match(/<\/?[A-Za-z][^>]*>/g) || []).map(tag => tag.replace(/\s+/g, ' '));
  assert.deepEqual(tags(sourceHelp[key].content), tags(chineseHelp[key].content), `Changed help markup for ${key}`);
}

const runtimeTranslations = Object.fromEntries([...chinese.units].map(([id, unit]) => {
  const target = [...elements(unit.children, 'target')][0];
  return [id, target.children.map(node => node.name === 'x' ? '{$' + attribute(node, 'id') + '}' : node.value || '').join('')];
}));
loadTranslations(runtimeTranslations);
try {
  checkSettingsLocalization(globalThis.$localize);
  checkDynamicSpn(globalThis.$localize);
  await checkDynamicNetquery(globalThis.$localize);
  await checkDynamicGeneralLocalization(globalThis.$localize);
  checkNotifications(globalThis.$localize);
  const clock = Date.parse('2026-11-09T12:00:00Z');
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
  }
  const compiled = ts.transpileModule(readFileSync(join(workspace, 'src/app/shared/pipes/time-ago.pipe.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true }
  }).outputText;
  const exports = {};
  runInNewContext(compiled, {
    exports, Date: FixedDate, $localize: globalThis.$localize,
    require(name) { assert.equal(name, '@angular/core'); return { Pipe: () => type => type }; }
  });
  for (const [delta, expected] of [[-90, '1 分钟前'], [-7200, '2 小时前'], [7200, '2 小时后'], [-86400, '1 天前']]) {
    const timestamp = (clock + delta * 1000) / 1000;
    assert.equal(exports.timeAgo(timestamp), expected);
    assert.equal(exports.timeAgo(new FixedDate(timestamp * 1000)), expected);
    assert.equal(exports.timeAgo(new Date(timestamp * 1000).toISOString()), expected);
  }
  assert.equal(exports.timeAgo((clock - 30_000) / 1000), '不到 1 分钟前');
  assert.equal(exports.timeAgo((clock + 30_000) / 1000), '不到 1 分钟后');
} finally {
  clearTranslations();
}

const sandbox = mkdtempSync(join(tmpdir(), 'portmaster-i18n-'));
try {
  for (const mode of ['success', 'missing-index', 'collision']) {
    const output = join(sandbox, mode);
    const locale = join(output, 'zh-CN');
    mkdirSync(locale, { recursive: true });
    writeFileSync(join(locale, 'main.js'), 'new output');
    if (mode !== 'missing-index') writeFileSync(join(locale, 'index.html'), '<html lang="zh-CN"></html>');
    if (mode === 'collision') writeFileSync(join(output, 'main.js'), 'existing output');
    if (mode === 'success') {
      mkdirSync(join(output, 'tauri-builtin'));
      writeFileSync(join(output, 'tauri-builtin/keep.txt'), 'keep');
      flattenLocalizedOutput(output);
      assert(existsSync(join(output, 'index.html')) && !existsSync(locale));
      assert.equal(readFileSync(join(output, 'main.js'), 'utf8'), 'new output');
      assert.equal(readFileSync(join(output, 'tauri-builtin/keep.txt'), 'utf8'), 'keep');
    } else {
      assert.throws(() => flattenLocalizedOutput(output));
      assert(existsSync(join(locale, 'main.js')), 'Failure must not move localized files');
      if (mode === 'collision') assert.equal(readFileSync(join(output, 'main.js'), 'utf8'), 'existing output');
    }
  }
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}

assert(readFileSync(join(workspace, 'projects/portmaster-chrome-extension/src/polyfills.ts'), 'utf8').includes("import '@angular/localize/init'"));
const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 1 && args[0] === '--built'), 'Only --built is supported');
if (args.includes('--built')) {
  for (const [folder, baseHref, samples] of [
    ['dist', '/ui/modules/portmaster/', ['网络活动', '上一页', '有应用请求建立网络连接：', '允许域名', '允许 IP', '阻止域名', '阻止 IP', '传入', '传出', '默认网络操作', '导入设置', '发生了什么？', '先前合并的配置文件', '无法处理字符：', '，位置 ', 'CTRL + 空格', 'Ctrl + 空格', 'Shift + 回车', 'Shift + 点击', '知道了', '不再显示', '打开设置', '加快网站加载速度', '安装文件损坏', '无法启用 SPN：', '已阻止互联网访问', '规则拒绝：', '请求建立隧道失败：']],
    ['dist/tauri-builtin', '/', ['正在连接系统服务', '未知错误：']],
    ['dist-extension', '/', ['Portmaster 浏览器扩展', '授权', '重试']]
  ]) {
    const output = join(workspace, folder);
    const html = readFileSync(join(output, 'index.html'), 'utf8');
    assert(/<html\b[^>]*\blang="zh-CN"/i.test(html), `${folder}: wrong document language`);
    assert(html.includes(`<base href="${baseHref}"`), `${folder}: wrong base href`);
    assert(!existsSync(join(output, 'zh-CN')), `${folder}: locale directory was not flattened`);
    const bundles = readdirSync(output).filter(name => name.endsWith('.js')).map(name => readFileSync(join(output, name), 'utf8')).join('\n')
      .replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    for (const sample of samples) assert(bundles.includes(sample), `${folder}: missing compiled sample ${sample}`);
  }
  const extension = join(workspace, 'dist-extension');
  const manifest = JSON.parse(readFileSync(join(extension, 'manifest.json'), 'utf8'));
  assert(existsSync(join(extension, manifest.browser_action.default_popup)), 'Missing extension popup');
  for (const script of manifest.background.scripts) assert(existsSync(join(extension, script)), `Missing extension background script: ${script}`);
}
console.log(`i18n: ${source.units.size} message IDs, placeholders and ICU branches match; settings, SPN, connection/query, notification/duration and output safety checks passed${args.includes('--built') ? '; all three Chinese build roots verified' : ''}.`);
