import { memo, useState } from 'react';
import type { WaterlooCampaign } from '../domain/waterloo-schema';
import {
  fontenoyHistoricalCatalogue as catalogue,
  fontenoyApproach,
  historicalPath,
  searchHistoricalRoster,
} from '../domain/fontenoy-historical';

export const HistoricalOob = memo(function HistoricalOob({
  view,
  campaign,
  onInspect,
}: {
  view: 'umpire' | 'french' | 'allied';
  campaign?: WaterlooCampaign;
  onInspect?(corpsId: string, name: string): void;
}) {
  const [query, setQuery] = useState('');
  const [service, setService] = useState('');
  // Derive visibility on every render, including while a filter is retained.
  const services =
    view === 'french'
      ? ['french']
      : view === 'allied'
        ? ['british', 'hanoverian', 'dutch', 'austrian']
        : ['french', 'british', 'hanoverian', 'dutch', 'austrian'];
  const visibleService = services.includes(service) ? service : '';
  const rows = searchHistoricalRoster(view, query, visibleService);
  return (
    <section className="historical-oob" aria-label="Historical battle roster">
      <p className="eyebrow">Fontenoy · 11 May 1745</p>
      <h3>Historical order of battle</h3>
      <p>
        {campaign?.fontenoy?.historicalProfile
          ? 'Historical records below are linked to the active campaign formations. '
          : 'Reference roster, separate from your campaign formations. '}
        Reported battalions and squadrons are historical complements, not
        Maurice units. Campaign opening positions, siege troops and arrivals
        remain under review.
      </p>
      <label>
        Search historical roster
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Regiment, brigade or source alias"
        />
      </label>
      <label>
        Historical contingent
        <select
          value={visibleService}
          onChange={(e) => setService(e.target.value)}
        >
          <option value="">All visible contingents</option>
          {services.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <p role="status">
        {rows.length} matching roster entries · no combined army total asserted
      </p>
      {!rows.length && (
        <p>No matching entries. Clear the search or contingent filter.</p>
      )}
      {rows.map((o) => {
        const unit = campaign?.fontenoy?.units.find(
          (u) => u.historical?.organizationId === o.id,
        );
        const link =
          unit &&
          campaign?.fontenoy?.formations.find((f) =>
            f.unitIds.includes(unit.id),
          );
        const formation =
          link && campaign?.corps.find((f) => f.id === link.corpsId);
        return (
          <details className="panel" key={o.id}>
            <summary>
              {o.displayName}{' '}
              <small>
                · {o.service} · {o.arm}
              </small>
            </summary>
            <p>{historicalPath(o)}</p>
            {formation && (
              <div className="historical-assignment">
                <p>
                  Assigned to {formation.name} · {unit!.currentStatus} ·{' '}
                  {formation.hexId ?? 'off map'}
                </p>
                <button
                  onClick={() => onInspect?.(formation.id, o.displayName)}
                >
                  Inspect assigned formation
                </button>
              </div>
            )}
            <dl>
              <dt>Source complement</dt>
              <dd>
                {catalogue.claims
                  .filter(
                    (c) =>
                      c.organizationId === o.id && c.value.kind === 'strength',
                  )
                  .map((c) =>
                    c.value.kind === 'strength' ? (
                      <div key={c.id}>
                        {c.value.count} {c.value.measure} · {c.review}
                      </div>
                    ) : null,
                  )}
                {!catalogue.claims.some(
                  (c) =>
                    c.organizationId === o.id && c.value.kind === 'strength',
                ) && 'Unknown / allocation unresolved'}
              </dd>
              <dt>Organization</dt>
              <dd>
                {o.kind.replaceAll('_', ' ')}
                {o.origin && ` · source origin: ${o.origin}`}
              </dd>
              <dt>Catalogue reference</dt>
              <dd>{o.id} (application identifier)</dd>
            </dl>
            <p>{o.notes}</p>
            {o.aliases.length > 0 && (
              <p>
                Source lookup labels (dates unverified):{' '}
                {o.aliases.map((a) => a.name).join('; ')}
              </p>
            )}
            <p className="muted">
              {
                catalogue.claims.find((c) => c.id === o.designationClaimId)!
                  .locator
              }
            </p>
          </details>
        );
      })}
      <details className="panel">
        <summary>Approach to Fontenoy</summary>
        <p>
          Historical context, not orders for this campaign. The main battle
          article is listed below. Regimental assignments, distances and map
          coordinates need further evidence.
        </p>
        <ol>
          {fontenoyApproach.map((event) => (
            <li key={event.date}>
              <strong>{event.date}</strong>: {event.summary}{' '}
              <small>({event.locator})</small>
            </li>
          ))}
        </ol>
      </details>
      <details className="panel">
        <summary>Sources and unresolved questions</summary>
        {catalogue.sources.map((s) => (
          <div key={s.id}>
            <h4>{s.title}</h4>
            <p>{s.edition}</p>
            <p className="historical-source-url">{s.url}</p>
            <p>{s.notes}</p>
          </div>
        ))}
        <ul>
          {catalogue.gaps.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      </details>
    </section>
  );
});
