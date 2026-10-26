import { applyWaterlooCommand, campaignTime, inZone } from '../domain/waterloo';
import {
  preparationIsMutable,
  validateWithdrawals,
} from '../domain/waterloo-preparation';
import type { WaterlooCampaign, WaterlooSide } from '../domain/waterloo-schema';
import type { MapView } from '../domain/operations-schema';
import { useCampaigns } from './campaign-store';

export function WaterlooPreparation({
  campaign: c,
  side,
  view,
}: {
  campaign: WaterlooCampaign;
  side: WaterlooSide;
  view: MapView;
}) {
  const state = useCampaigns(),
    p = c.preparation,
    busy =
      state.pending ||
      c.status === 'archived' ||
      !!c.fontenoy?.siege.campaign?.victory;
  const alliedLabel = c.fontenoy ? 'Allied' : 'Coalition';
  const commit = (command: Parameters<typeof state.commitWaterloo>[0]) => {
    void state.commitWaterloo(command);
  };
  if (!p)
    return (
      <section
        className="panel"
        data-helper="preparation"
        aria-label="Preparation rules"
      >
        <h2>Screening and withdrawal</h2>
        <p>
          Enable stationary screening detachments and simultaneous pre-movement
          withdrawals for this campaign. Existing movement and battle records
          are retained.
        </p>
        {view === 'umpire' && (
          <button
            disabled={
              busy ||
              !!state.waterlooDraft ||
              !preparationIsMutable(c) ||
              c.encounters.some((e) => !e.settled)
            }
            onClick={() => commit({ kind: 'enable-preparation' })}
          >
            Enable preparation rules
          </button>
        )}
      </section>
    );
  const submission = p.submissions.find((s) => s.side === side)!;
  const mutable = preparationIsMutable(c) && !busy && !state.waterlooDraft;
  const draft =
    state.waterlooDraft?.kind === 'withdrawal' ? state.waterlooDraft : null;
  const canPlan = !p.resolved && !submission.locked && !busy;
  const eligible = c.corps.filter(
    (f) =>
      f.side === side &&
      f.status === 'ready' &&
      f.kind !== 'detachment' &&
      f.hexId &&
      c.corps.some((e) => e.side !== side && inZone(c, f.hexId!, e, 1)),
  );
  const screens = c.corps.filter((f) => f.side === side && f.detachment);
  let preview: WaterlooCampaign | null = null,
    error: string | null = null;
  if (
    c.status === 'active' &&
    view === 'umpire' &&
    !p.resolved &&
    p.submissions.every((s) => s.locked)
  ) {
    try {
      preview = applyWaterlooCommand(c, {
        command: { kind: 'resolve-withdrawals' },
        recordId: '00000000-0000-4000-8000-000000000000',
        timestamp: c.updatedAt,
      });
    } catch (e) {
      error =
        e instanceof Error ? e.message : 'Withdrawal preview unavailable.';
    }
  }
  return (
    <section
      className="panel"
      data-helper="preparation"
      aria-label="Preparation rules"
    >
      <div className="section-heading">
        <h2>Screening and withdrawal</h2>
        <span className="badge">
          {p.resolved ? 'Preparation complete' : 'Before movement'}
        </span>
      </div>
      <details>
        <summary>Screening detachments</summary>
        <p>
          One placement per HQ per phase. An ordinary screen must be outside
          every friendly/enemy control and influence zone, traced through hexes
          free of enemy zones. Detachments hold position until recalled.
          Allocate their tactical troops from the parent corps when needed.
          Review HQs, due returns and charts before the first deployment.
        </p>
        <ul>
          {screens.map((f) => (
            <li key={f.id}>
              <strong>{f.name}</strong> · {f.status}
              {f.hexId ? ` at ${f.hexId}` : ''}
              {f.status === 'reserve'
                ? ` · available phase ${f.detachment!.availableFromTurn}`
                : ''}
              {f.status === 'reserve' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    commit({
                      kind: 'deploy-detachment',
                      corpsId: f.id,
                      hqId: String(form.get('hq')),
                      hexId: String(form.get('hex')),
                      source: form.get('source') as 'hq' | 'parent',
                    });
                  }}
                >
                  <fieldset
                    disabled={
                      !mutable || f.detachment!.availableFromTurn > c.turn
                    }
                  >
                    <legend>Deploy {f.name}</legend>
                    <div className="form-grid">
                      <label>
                        Deployment HQ
                        <select name="hq">
                          {c.hqs
                            .filter((h) => h.army === f.army)
                            .map((h) => (
                              <option key={h.id} value={h.id}>
                                {h.name}
                                {p.deploymentHqIds.includes(h.id)
                                  ? ' · placement used'
                                  : ''}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        Trace from
                        <select name="source">
                          <option value="hq">HQ command range</option>
                          <option value="parent">
                            Parent corps · four hexes
                          </option>
                        </select>
                      </label>
                      <label>
                        Placement hex
                        <select name="hex">
                          {c.hexes
                            .filter((h) => h.terrain !== 'water')
                            .map((h) => (
                              <option key={h.id}>{h.id}</option>
                            ))}
                        </select>
                      </label>
                    </div>
                    <button>Deploy {f.name}</button>
                  </fieldset>
                </form>
              )}
              {f.status === 'ready' && (
                <button
                  className="secondary"
                  disabled={!mutable}
                  onClick={() =>
                    commit({ kind: 'recall-detachment', corpsId: f.id })
                  }
                >
                  Recall {f.name}
                </button>
              )}
            </li>
          ))}
        </ul>
      </details>
      <h3>Simultaneous withdrawals</h3>
      <p>
        Each side saves and locks its own withdrawals, including an empty hold.
        After both lock, the umpire reviews the common result. A retreat is
        three steps in 60 minutes; blocked retreats become blown. Withdrawing
        corps cannot march or reinforce again this phase. For a trapped force,
        choose “No legal retreat”; the application checks that no legal
        three-step route exists on the current board before accepting a blown
        withdrawal.
      </p>
      <p aria-label="Withdrawal readiness">
        French:{' '}
        {p.submissions.find((s) => s.side === 'french')!.locked
          ? 'locked'
          : 'planning'}{' '}
        · {alliedLabel}:{' '}
        {p.submissions.find((s) => s.side === 'allied')!.locked
          ? 'locked'
          : 'planning'}
      </p>
      {!p.resolved && (
        <>
          <div className="button-row">
            {eligible.map((f) => (
              <button
                key={f.id}
                disabled={!canPlan || !!state.waterlooDraft}
                onClick={() => {
                  const enemy = c.corps.find(
                    (e) => e.side !== side && inZone(c, f.hexId!, e, 1),
                  )!;
                  const previous = submission.orders.find(
                    (o) => o.corpsId === f.id,
                  );
                  useCampaigns.setState({
                    waterlooDraft: {
                      kind: 'withdrawal',
                      corpsId: f.id,
                      enemyId: previous?.enemyId ?? enemy.id,
                      path:
                        previous?.path.length === 4
                          ? previous.path
                          : [f.hexId!, '', '', ''],
                      blocked: previous?.blocked,
                      priority:
                        previous?.priority ??
                        c.corps.findIndex((p) => p.id === f.id),
                    },
                    error: null,
                  });
                }}
              >
                Plan withdrawal for {f.name}
              </button>
            ))}
          </div>
          {!eligible.length && (
            <p>
              No own corps currently needs a withdrawal. Lock an empty
              submission to hold.
            </p>
          )}
          {draft && (
            <form
              aria-label="Withdrawal draft"
              onSubmit={(e) => {
                e.preventDefault();
                const order = {
                  corpsId: draft.corpsId,
                  enemyId: draft.enemyId,
                  path: draft.blocked ? [draft.path[0]!] : draft.path,
                  priority: draft.priority,
                  ...(draft.blocked ? { blocked: true } : {}),
                };
                const orders = [
                  ...submission.orders.filter(
                    (o) => o.corpsId !== draft.corpsId,
                  ),
                  order,
                ];
                try {
                  validateWithdrawals(c, side, orders);
                  commit({ kind: 'withdrawals', side, orders, lock: false });
                } catch (error) {
                  useCampaigns.setState({
                    error:
                      error instanceof Error
                        ? error.message
                        : 'Invalid withdrawal.',
                  });
                }
              }}
            >
              <fieldset disabled={busy}>
                <legend>
                  Withdrawal for{' '}
                  {c.corps.find((f) => f.id === draft.corpsId)!.name}
                </legend>
                <div className="form-grid">
                  <label>
                    Retreat away from
                    <select
                      value={draft.enemyId}
                      onChange={(e) =>
                        useCampaigns.setState({
                          waterlooDraft: { ...draft, enemyId: e.target.value },
                        })
                      }
                    >
                      {c.corps
                        .filter(
                          (f) =>
                            f.side !== side && inZone(c, draft.path[0]!, f, 1),
                        )
                        .map((f) => (
                          <option key={f.id} value={f.id}>
                            {view === 'umpire' ? f.name : `Enemy at ${f.hexId}`}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Withdrawal priority
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      value={draft.priority}
                      onChange={(e) =>
                        useCampaigns.setState({
                          waterlooDraft: {
                            ...draft,
                            priority: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={draft.blocked ?? false}
                      onChange={(e) =>
                        useCampaigns.setState({
                          waterlooDraft: {
                            ...draft,
                            blocked: e.target.checked,
                          },
                        })
                      }
                    />
                    No legal retreat — accept blown
                  </label>
                  {[1, 2, 3].map((i) => (
                    <label key={i}>
                      Retreat step {i}
                      <select
                        required={!draft.blocked}
                        disabled={!!draft.blocked}
                        value={draft.path[i] ?? ''}
                        onChange={(e) =>
                          useCampaigns.setState({
                            waterlooDraft: {
                              ...draft,
                              path: draft.path.map((v, j) =>
                                j === i ? e.target.value : v,
                              ),
                            },
                          })
                        }
                      >
                        <option value="">Choose hex</option>
                        {c.hexes
                          .filter((h) => h.terrain !== 'water')
                          .map((h) => (
                            <option key={h.id}>{h.id}</option>
                          ))}
                      </select>
                    </label>
                  ))}
                </div>
                <div className="button-row">
                  <button>Save withdrawal</button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      useCampaigns.setState({ waterlooDraft: null })
                    }
                  >
                    Cancel withdrawal edit
                  </button>
                </div>
              </fieldset>
            </form>
          )}
          <ul aria-label="Own saved withdrawals">
            {submission.orders.map((o) => (
              <li key={o.corpsId}>
                {c.corps.find((f) => f.id === o.corpsId)!.name}:{' '}
                {o.path.join(' → ')}
                {o.blocked ? ' · no legal retreat; accept blown' : ''} ·
                priority {o.priority}{' '}
                <button
                  className="secondary"
                  disabled={!canPlan || !!state.waterlooDraft}
                  onClick={() =>
                    commit({
                      kind: 'withdrawals',
                      side,
                      orders: submission.orders.filter(
                        (p) => p.corpsId !== o.corpsId,
                      ),
                      lock: false,
                    })
                  }
                >
                  Remove withdrawal
                </button>
              </li>
            ))}
          </ul>
          <div className="button-row">
            <button
              disabled={!canPlan || !!state.waterlooDraft}
              onClick={() =>
                commit({
                  kind: 'withdrawals',
                  side,
                  orders: submission.orders,
                  lock: true,
                })
              }
            >
              Lock {side === 'french' ? 'French' : alliedLabel} withdrawals
            </button>
            {view === 'umpire' && (
              <button
                className="secondary"
                disabled={busy || !!state.waterlooDraft}
                onClick={() => commit({ kind: 'reset-withdrawals' })}
              >
                Reopen both withdrawal submissions
              </button>
            )}
          </div>
        </>
      )}
      {preview && (
        <div aria-label="Withdrawal resolution preview">
          <h4>Review simultaneous withdrawal result</h4>
          <p>
            Shared clock: {campaignTime(c, c.cursor)} →{' '}
            {campaignTime(preview, preview.cursor)}. Friendly conflicts use the
            saved lower priority; no corps can pass through an occupied corps
            hex.
          </p>
          <ul>
            {preview.preparation!.withdrawnCorpsIds.map((id) => {
              const f = preview!.corps.find((f) => f.id === id)!;
              return (
                <li key={id}>
                  {f.name}:{' '}
                  {f.status === 'blown'
                    ? `blown; return phase ${f.returnSlot}`
                    : `retreats to ${f.hexId}`}
                </li>
              );
            })}
          </ul>
          <button
            disabled={busy || !!state.waterlooDraft}
            onClick={() => commit({ kind: 'resolve-withdrawals' })}
          >
            Confirm simultaneous withdrawals
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {p.resolved && (
        <p>
          Withdrawals resolved at {campaignTime(c, p.resolvedAt!)};{' '}
          {p.withdrawnCorpsIds.length} withdrawn corps hold for this phase.
        </p>
      )}
    </section>
  );
}
