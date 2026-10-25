import type { WaterlooBattle, WaterlooCampaign } from './waterloo-schema';
import { campaignTime } from './waterloo';

const escape = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (ch) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        ch
      ]!,
  );
export function waterlooBriefHtml(c: WaterlooCampaign, b: WaterlooBattle) {
  const screenNote = b.initial.some((f) => f.kind === 'detachment')
    ? '<p>Ordinary screens are stationary defensive detachments. Agree their tactical roster from their parent corps; do not count the same tactical troops twice. Record a screen as retained, recalled, eliminated or unused. No support bonus is applied automatically.</p>'
    : '';
  const mauriceRoster =
    b.maurice
      ?.map(
        (link) =>
          `<h3>${escape([...b.initial, ...b.reinforcementForces].find((f) => f.id === link.corpsId)?.name)}</h3><p>Commanders: ${link.commanders.map((f) => escape(f.displayName)).join(', ') || 'None assigned'}</p><table><thead><tr><th>Maurice unit</th><th>Type</th><th>Quality</th><th>Contingent</th></tr></thead><tbody>${link.units.map((u) => `<tr><td>${escape(u.displayName)}</td><td>${escape(u.type)}</td><td>${escape(u.quality)}</td><td>${escape(u.contingent)}</td></tr>`).join('')}</tbody></table>`,
      )
      .join('') ?? '';
  const timing = (time: number) => {
    const delay = Math.max(0, time - b.startAt);
    return `${campaignTime(c, time)} (+${delay} min${b.charts.tacticalTurnMinutes ? `, tactical turn ${1 + Math.ceil(delay / b.charts.tacticalTurnMinutes)}` : ''})`;
  };
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escape(b.title)}</title><style>body{font:14px Georgia,serif;max-width:1000px;margin:25px auto;color:#222}table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:8px;text-align:left}p{white-space:pre-wrap}tr{break-inside:avoid}@page{size:A4;margin:16mm}</style></head><body><h1>${escape(b.title)}</h1><p>${escape(c.title)} · ${c.fontenoy ? 'Maurice / Fontenoy, 1745' : 'Operational reference profile'}</p><p>Start: ${escape(campaignTime(c, b.startAt))}; planned end: ${escape(campaignTime(c, b.expectedEndAt))}. Hex ${escape(b.hexId)}. Weather: ${escape(b.charts.weather)}.</p><p>Shared battle brief with both sides' released forces. Use any tactical game. Operational ratings are context; no tactical dice, casualties or bonuses are automated. Reinforcement bounds depend on clear routes and can be manually adjudicated.</p><h2>Initial forces</h2>${screenNote}<table><thead><tr><th>Formation / army</th><th>State / origin</th><th>Roster</th></tr></thead><tbody>${b.initial.map((f) => `<tr><td>${escape(f.name)} / ${escape(f.army)}</td><td>${escape(f.formation)} / ${escape(f.hexId)}</td><td>${escape(f.roster)}</td></tr>`).join('')}</tbody></table>${mauriceRoster ? `<h2>Frozen Maurice rosters</h2>${mauriceRoster}` : ''}<h2>Committed later arrivals</h2>${b.reinforcements.length ? b.reinforcements.map((r) => `<h3>${escape(b.reinforcementForces.find((f) => f.id === r.corpsId)?.name)}</h3><p>${escape(r.entryEdge)}; route: ${escape(r.path.join(' → '))}.</p><p>Earliest ${escape(timing(r.earliest))}; likely ${escape(timing(r.likely))}; latest planning bound ${escape(timing(r.latest))}.</p><p>${escape(r.notes)}</p>`).join('') : '<p>No later forces committed.</p>'}<h2>Manual result</h2><p>Record game, actual battle end, outcome, actual arrivals, retained/retreated/blown/eliminated/unused forces and post-battle positions. Approve campaign effects separately. Corrections preserve earlier result revisions.</p>${b.results.length ? `<p>Latest recorded outcome: ${escape(b.results.at(-1)!.result.outcome)}; ${escape(b.results.at(-1)!.result.notes)}</p>` : ''}<p>Frozen initial roster and committed arrival snapshots. Profile: ${escape(c.rulesetVersion)}; charts: ${escape(b.charts.version)}.</p></body></html>`;
}
