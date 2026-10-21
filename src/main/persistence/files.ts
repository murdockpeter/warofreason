import {
  closeSync,
  fstatSync,
  fsyncSync,
  openSync,
  readSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { exportSchema } from '../../domain/campaign';
import type { CampaignExport } from '../../domain/campaign';
import { CampaignError } from './errors';

export const maxCampaignFileBytes = 20 * 1024 * 1024;
export function readCampaignFile(filename: string): CampaignExport {
  const descriptor = openSync(filename, 'r');
  let text: string;
  try {
    const stat = fstatSync(descriptor);
    if (!stat.isFile() || stat.size > maxCampaignFileBytes)
      throw new CampaignError(
        'file',
        'Choose a regular campaign JSON file no larger than 20 MiB.',
      );
    const buffer = Buffer.alloc(maxCampaignFileBytes + 1);
    let length = 0;
    while (length < buffer.length) {
      const count = readSync(
        descriptor,
        buffer,
        length,
        buffer.length - length,
        null,
      );
      if (count === 0) break;
      length += count;
    }
    if (length > maxCampaignFileBytes)
      throw new CampaignError(
        'file',
        'Campaign JSON exceeds the 20 MiB import limit.',
      );
    text = buffer.toString('utf8', 0, length).replace(/^\uFEFF/, '');
  } finally {
    closeSync(descriptor);
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new CampaignError(
      'validation',
      'This file is not valid JSON. Choose an unchanged campaign export.',
    );
  }
  return exportSchema.parse(data);
}
export function writeCampaignFile(filename: string, value: CampaignExport) {
  writeJsonFile(filename, exportSchema.parse(value));
}
export function writeJsonFile(filename: string, value: unknown) {
  if (!filename.toLowerCase().endsWith('.json'))
    throw new CampaignError(
      'file',
      'Save the campaign with a .json extension.',
    );
  const text = JSON.stringify(value, null, 2) + '\n';
  writeAtomicFile(filename, text);
}
export function writeAtomicFile(filename: string, text: string | Uint8Array) {
  if (Buffer.byteLength(text) > maxCampaignFileBytes)
    throw new CampaignError(
      'file',
      'Campaign export exceeds the 20 MiB limit. Existing files were not changed.',
    );
  const temporary = `${filename}.${randomUUID()}.tmp`;
  let owned = false;
  try {
    const descriptor = openSync(temporary, 'wx', 0o600);
    owned = true;
    try {
      writeFileSync(descriptor, text, 'utf8');
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    // Same-directory rename publishes a complete file or preserves the previous export.
    renameSync(temporary, filename);
    owned = false;
  } finally {
    if (owned) {
      try {
        unlinkSync(temporary);
      } catch {
        /* Leave the previous destination intact on write failure. */
      }
    }
  }
}
