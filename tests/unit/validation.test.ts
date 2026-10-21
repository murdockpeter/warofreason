import { describe, expect, it } from 'vitest';
import {
  factionSchema,
  provenanceSchema,
  unitClassificationSchema,
} from '../../src/domain/vocabulary';
import {
  appInfoSchema,
  diagnosticSchema,
  noInput,
} from '../../src/shared/contracts';
import { isTrustedDocument } from '../../src/main/security';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

describe('initial domain vocabulary (no campaign mechanics)', () => {
  it.each(['regular_infantry', 'regular_cavalry'])(
    'accepts regular quality for %s',
    (type) => {
      for (const quality of ['elite', 'trained', 'conscript'])
        expect(
          unitClassificationSchema.safeParse({ type, quality }).success,
        ).toBe(true);
      expect(
        unitClassificationSchema.safeParse({ type, quality: null }).success,
      ).toBe(false);
    },
  );
  it.each(['artillery', 'irregular_infantry', 'irregular_cavalry'])(
    'requires null quality for %s',
    (type) => {
      expect(
        unitClassificationSchema.safeParse({ type, quality: null }).success,
      ).toBe(true);
      expect(
        unitClassificationSchema.safeParse({ type, quality: 'elite' }).success,
      ).toBe(false);
    },
  );
  it('rejects unknown unit terminology and factions', () => {
    expect(
      unitClassificationSchema.safeParse({ type: 'corps', quality: 'elite' })
        .success,
    ).toBe(false);
    expect(factionSchema.parse('french')).toBe('french');
    expect(factionSchema.parse('allied')).toBe('allied');
    expect(factionSchema.safeParse('neutral').success).toBe(false);
  });
  it('distinguishes official, historical and proposed provenance', () => {
    expect(provenanceSchema.options).toEqual([
      'official_maurice',
      'historical_scenario',
      'house_rule_v0.1',
    ]);
    expect(provenanceSchema.safeParse('official_campaign').success).toBe(false);
  });
});
describe('IPC contracts', () => {
  it('rejects arbitrary payloads, extra properties and oversized diagnostics', () => {
    expect(noInput.safeParse({ path: 'C:/' }).success).toBe(false);
    expect(
      diagnosticSchema.safeParse({
        source: 'renderer',
        message: 'oops',
        path: 'secret',
      }).success,
    ).toBe(false);
    expect(
      diagnosticSchema.safeParse({
        source: 'renderer',
        message: 'x'.repeat(1001),
      }).success,
    ).toBe(false);
    expect(
      diagnosticSchema.safeParse({ source: 'renderer', message: '  ' }).success,
    ).toBe(false);
    expect(
      diagnosticSchema.parse({ source: 'boundary', message: 'Example error' })
        .message,
    ).toBe('Example error');
  });
  it('rejects malformed app responses', () => {
    expect(
      appInfoSchema.safeParse({
        version: '0.1.0',
        platform: 'win32',
        milestone: 'unexpected',
      }).success,
    ).toBe(false);
  });
  it('trusts only the exact renderer document or development origin', () => {
    const file = path.resolve('dist/renderer/index.html');
    const url = pathToFileURL(file).href;
    expect(isTrustedDocument(`${url}#settings`, file)).toBe(true);
    expect(isTrustedDocument(`${url}?untrusted=1`, file)).toBe(false);
    expect(isTrustedDocument('file:///C:/untrusted.html', file)).toBe(false);
    expect(
      isTrustedDocument(
        'http://127.0.0.1:5173/',
        file,
        'http://127.0.0.1:5173',
      ),
    ).toBe(true);
    expect(
      isTrustedDocument(
        'http://127.0.0.1:5173/evil',
        file,
        'http://127.0.0.1:5173',
      ),
    ).toBe(false);
    expect(isTrustedDocument('https://example.com', file)).toBe(false);
    expect(isTrustedDocument('invalid', file)).toBe(false);
  });
});
