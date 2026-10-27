import type { WaterlooCampaign } from '../domain/waterloo-schema';
import type { MapView } from '../domain/operations-schema';
import { canRegroupHistorical } from '../domain/historical-profile';
import {
  historicalFormationGroups,
  historicalGroupingVersion,
} from '../domain/historical-grouping';
import { useCampaigns } from './campaign-store';

export function HistoricalForceOverview({
  c,
  view,
}: {
  c: WaterlooCampaign;
  view: MapView;
}) {
  const state = useCampaigns();
  const profile = c.fontenoy?.historicalProfile;
  if (!profile) return null;
  const old = profile.groupingVersion !== historicalGroupingVersion;
  return (
    <section aria-label="Formation grouping">
      <h4>Formation grouping</h4>
      <table>
        <thead>
          <tr>
            <th>Side</th>
            <th>Map formations</th>
            <th>Roster records</th>
          </tr>
        </thead>
        <tbody>
          {(['french', 'allied'] as const)
            .filter((side) => view === 'umpire' || side === view)
            .map((side) => (
              <tr key={side}>
                <th>{side === 'french' ? 'French' : 'Allied'}</th>
                <td>{c.corps.filter((f) => f.side === side).length}</td>
                <td>
                  {
                    c.fontenoy!.units.filter(
                      (u) =>
                        c.fontenoy!.factions.find((f) => f.id === u.factionId)
                          ?.side === side,
                    ).length
                  }
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      <p>
        {old
          ? 'This setup groups records by national service and arm, producing very different counter sizes.'
          : 'Both sides use provisional groups targeting 12 reported battalions or 24 reported squadrons, preserving source-listed brigades. Uncertain complements stay separate.'}
      </p>
      <p>
        Counter badges: b = reported battalions, s = reported squadrons, +? =
        additional unspecified complements, rec = artillery records. These are
        source complements, not current headcounts or combat-power ratings.
      </p>
      {old &&
        view === 'umpire' &&
        (canRegroupHistorical(c) ? (
          <>
            <p>
              Regrouping produces{' '}
              {
                historicalFormationGroups.filter((f) => f.side === 'french')
                  .length
              }{' '}
              French and{' '}
              {
                historicalFormationGroups.filter((f) => f.side === 'allied')
                  .length
              }{' '}
              Allied formations. It resets provisional deployment and
              headquarters positions, while preserving regiment identities and
              grades. Review this new deployment before play.
            </p>
            <button
              disabled={state.pending || !!state.waterlooDraft}
              onClick={() =>
                void state.commitWaterloo({
                  kind: 'historical-regroup',
                  regroup: {
                    corpsIds: historicalFormationGroups.map(() =>
                      crypto.randomUUID(),
                    ),
                    notes:
                      'Regroup untouched setup using the common reported-subunit basis; provisional deployment reset.',
                  },
                })
              }
            >
              Regroup this historical setup
            </button>
          </>
        ) : (
          <>
            <p>
              This campaign has already progressed. Create a separate setup to
              use the revised grouping.
            </p>
            <button
              disabled={state.pending || !!state.waterlooDraft}
              onClick={() => void state.createHistoricalFontenoy()}
            >
              Create regrouped historical campaign
            </button>
          </>
        ))}
    </section>
  );
}
