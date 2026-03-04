import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';
import type { SDDConfig } from '../types.js';

export const SDD_DIR = '.sdd';
export const CONFIG_FILENAME = 'config.yaml';

export function sddDirPath(root: string): string {
  return resolve(root, SDD_DIR);
}

export function configFilePath(root: string): string {
  return resolve(root, SDD_DIR, CONFIG_FILENAME);
}

export function isSDDProject(root: string): boolean {
  return existsSync(sddDirPath(root));
}

export async function readConfig(root: string): Promise<SDDConfig> {
  const path = configFilePath(root);
  if (!existsSync(path)) {
    return { description: '' };
  }
  const content = await readFile(path, 'utf-8');
  const parsed = yaml.load(content) as SDDConfig | null;
  return parsed ?? { description: '' };
}

export async function writeConfig(root: string, config: SDDConfig): Promise<void> {
  const dir = sddDirPath(root);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  const content = yaml.dump(config, { sortKeys: true, lineWidth: -1 });
  await writeFile(configFilePath(root), content, 'utf-8');
}
