import { describe, expect, it } from 'vitest';
import { campaignSchema, exportSchema } from '../../src/domain/campaign';
import { campaignFixture, exportFixture, testId } from '../fixtures/campaign';

describe('campaign integrity', () => {
  it('accepts a consistent aggregate without operational rules', () => {
    expect(campaignSchema.parse(campaignFixture()).turn).toBe(0);
  });
  it.each(['units', 'commanders', 'columns'] as const)(
    'rejects missing faction references in %s',
    (key) => {
      const data = campaignFixture();
      data[key][0]!.factionId = testId(200);
      expect(campaignSchema.safeParse(data).success).toBe(false);
    },
  );
  it('rejects assigning opposing units or commanders to a column', () => {
    const data = campaignFixture();
    data.columns[0]!.factionId = testId(4);
    expect(campaignSchema.safeParse(data).success).toBe(false);
  });
  it('rejects duplicate assignments within and across columns', () => {
    const data = campaignFixture();
    data.columns.push({ ...structuredClone(data.columns[0]!), id: testId(10) });
    expect(campaignSchema.safeParse(data).success).toBe(false);
    data.columns.pop();
    data.columns[0]!.unitIds.push(testId(5));
    expect(campaignSchema.safeParse(data).success).toBe(false);
  });
  it('rejects dangling assignments, duplicate identities and map coordinates', () => {
    const data = campaignFixture();
    data.columns[0]!.squareId = testId(200);
    expect(campaignSchema.safeParse(data).success).toBe(false);
    data.columns[0]!.squareId = testId(7);
    data.units[0]!.id = testId(3);
    expect(campaignSchema.safeParse(data).success).toBe(false);
    const other = campaignFixture();
    other.squares.push({ ...other.squares[0]!, id: testId(10) });
    expect(campaignSchema.safeParse(other).success).toBe(false);
  });
  it('rejects non-UUIDs, illegal quality and speculative rule configuration', () => {
    const data = campaignFixture();
    data.units[0]!.type = 'artillery';
    expect(campaignSchema.safeParse(data).success).toBe(false);
    expect(
      campaignSchema.safeParse({ ...campaignFixture(), id: 'friendly-name' })
        .success,
    ).toBe(false);
    expect(
      campaignSchema.safeParse({
        ...campaignFixture(),
        settings: { roadMovement: 3 },
      }).success,
    ).toBe(false);
    expect(
      campaignSchema.safeParse({ ...campaignFixture(), date: '1745-05-01' })
        .success,
    ).toBe(false);
  });
});
describe('portable journal integrity', () => {
  it('accepts the supported version and rejects a mismatched final snapshot', () => {
    const data = exportFixture();
    expect(exportSchema.safeParse(data).success).toBe(true);
    data.campaign.title = 'Changed without an event';
    expect(exportSchema.safeParse(data).success).toBe(false);
  });
  it('rejects unsupported file/module versions and missing journal history', () => {
    expect(
      exportSchema.safeParse({ ...exportFixture(), formatVersion: 99 }).success,
    ).toBe(false);
    expect(
      exportSchema.safeParse({ ...exportFixture(), events: [] }).success,
    ).toBe(false);
    const data = exportFixture();
    Reflect.set(data.campaign, 'moduleVersion', 'official-v1');
    expect(exportSchema.safeParse(data).success).toBe(false);
  });
  it('rejects a broken before/after chain, foreign campaign and duplicate event IDs', () => {
    const data = exportFixture();
    const first = data.events[0]!;
    const after = { ...data.campaign, revision: 2, title: 'New title' };
    data.events.push({
      ...first,
      category: 'renamed',
      before: data.campaign,
      after,
    });
    data.campaign = after;
    expect(exportSchema.safeParse(data).success).toBe(false);
    data.events[1]!.id = testId(100);
    expect(exportSchema.safeParse(data).success).toBe(true);
    data.events[1]!.before = null;
    expect(exportSchema.safeParse(data).success).toBe(false);
    data.events[1]!.before = first.after;
    data.events[1]!.campaignId = testId(500);
    expect(exportSchema.safeParse(data).success).toBe(false);
  });
});
