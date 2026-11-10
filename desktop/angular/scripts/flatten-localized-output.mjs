import { lstatSync, readdirSync, renameSync, rmdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// ponytail: this fork ships one locale; keep this limited to generated build output.
export function flattenLocalizedOutput(outputPath) {
  const output = resolve(outputPath);
  const localized = join(output, 'zh-CN');
  if (!lstatSync(localized).isDirectory() || !lstatSync(join(localized, 'index.html')).isFile()) {
    throw new Error(`Missing Chinese application index in ${localized}`);
  }
  const names = readdirSync(localized);
  for (const name of names) {
    if (lstatSync(join(output, name), { throwIfNoEntry: false })) {
      throw new Error(`Refusing to overwrite existing build output: ${name}`);
    }
  }
  for (const name of names) renameSync(join(localized, name), join(output, name));
  rmdirSync(localized);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 3) throw new Error('Usage: node flatten-localized-output.mjs <output-path>');
  flattenLocalizedOutput(process.argv[2]);
}
