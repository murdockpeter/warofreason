import { almaById } from '../domain/alma-roster';
import { useState } from 'react';
import type {
  KsCommand,
  KsForce,
  KsMapId,
  KsPosition,
} from '../domain/crimean-ks';
import { ksForceSchema, ksCommandSchema } from '../domain/crimean-ks';
import { ReaderDialog } from './ReaderDialog';
import { crimeanMaps, ksAllegiances } from './crimean-maps';
import { useKs } from './ks-store';
export type KsDraft =
  | { kind: 'create' | 'time' | 'note' | 'rename' | 'archive' }
  | { kind: 'force'; force: KsForce; isNew: boolean }
  | { kind: 'move'; force: KsForce; mapId: KsMapId; position: KsPosition }
  | { kind: 'intent'; force: KsForce; points: KsPosition[]; clear?: boolean };
export function KsRulingDialog({
  draft,
  onClose,
}: {
  draft: KsDraft;
  onClose(): void;
}) {
  const state = useKs(),
    c = state.library?.active;
  const [force, setForce] = useState<KsForce | null>(
    draft.kind === 'force' ? structuredClone(draft.force) : null,
  );
  const [value, setValue] = useState(
    draft.kind === 'create'
      ? 'Crimean War — Free Kriegsspiel'
      : draft.kind === 'time'
        ? (c?.campaignTime ?? '')
        : draft.kind === 'rename'
          ? (c?.title ?? '')
          : '',
  );
  const [reason, setReason] = useState(
    draft.kind === 'force' && draft.isNew
      ? 'Initial force and placement recorded by the umpire as a scenario choice.'
      : '',
  );
  const [clearIntent, setClearIntent] = useState(true);
  const title =
    draft.kind === 'create'
      ? 'New Crimean KS campaign'
      : draft.kind === 'force'
        ? draft.isNew
          ? 'Add force'
          : 'Inspect / edit force'
        : draft.kind === 'move'
          ? 'Record placement ruling'
          : draft.kind === 'intent'
            ? draft.clear
              ? 'Clear planned intent'
              : 'Record planned intent'
            : draft.kind === 'time'
              ? 'Set campaign time'
              : draft.kind === 'rename'
                ? 'Rename KS campaign'
                : draft.kind === 'archive'
                  ? 'Archive KS campaign'
                  : 'Record umpire note';
  const edit = (patch: Partial<KsForce>) =>
    setForce((f) => (f ? { ...f, ...patch } : f));
  let command: KsCommand | null = null;
  if (draft.kind === 'force' && force)
    command = { kind: draft.isNew ? 'add-force' : 'edit-force', force };
  if (draft.kind === 'move')
    command = {
      kind: 'move-force',
      forceId: draft.force.id,
      mapId: draft.mapId,
      position: draft.position,
      clearIntent,
    };
  if (draft.kind === 'intent')
    command = {
      kind: 'set-intent',
      forceId: draft.force.id,
      intent: draft.clear
        ? null
        : { mapId: draft.force.mapId, points: draft.points, text: value },
    };
  if (draft.kind === 'time')
    command = { kind: 'set-time', campaignTime: value };
  if (draft.kind === 'note') command = { kind: 'note' };
  if (draft.kind === 'rename') command = { kind: 'rename', title: value };
  if (draft.kind === 'archive') command = { kind: 'archive' };
  const auditReason =
    draft.kind === 'intent' && !draft.clear
      ? `Planned intent: ${value}`
      : reason;
  const valid =
    draft.kind === 'create'
      ? !!value.trim() && value.trim().length <= 120
      : !!command &&
        ksCommandSchema.safeParse(command).success &&
        !!auditReason.trim();
  return (
    <ReaderDialog
      title={title}
      onDismiss={() => {
        if (!state.pending) onClose();
      }}
      className="ks-ruling-dialog"
    >
      <form
        aria-label={title}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valid) return;
          const saved =
            draft.kind === 'create'
              ? await state.createCampaign(value)
              : command
                ? await state.commit(command, auditReason)
                : false;
          if (saved) onClose();
        }}
      >
        <fieldset
          disabled={
            state.pending ||
            (c?.status === 'archived' && draft.kind !== 'create')
          }
        >
          {draft.kind === 'create' && (
            <>
              <p>
                A separate umpire workspace using real period maps. Starts with
                no forces, assumed deployment, turn schedule or combat rules.
              </p>
              <label>
                Campaign title
                <input
                  maxLength={120}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  required
                />
              </label>
            </>
          )}
          {force && (
            <>
              {force.historical && (
                <aside className="ks-source-card">
                  <strong>Alma, 20 September 1854 · source identity</strong>
                  <p>{almaById.get(force.historical.organizationId)?.name}</p>
                  <p>
                    {almaById
                      .get(force.historical.organizationId)
                      ?.path.join(' / ')}
                  </p>
                  <p>
                    {almaById
                      .get(force.historical.organizationId)
                      ?.flags.join(' ? ')}
                  </p>
                  <p>{almaById.get(force.historical.organizationId)?.notes}</p>
                  <small>
                    {almaById.get(force.historical.organizationId)?.source}
                  </small>
                </aside>
              )}
              <div className="ks-force-summary">
                <strong>{ksAllegiances[force.allegiance]}</strong>
                <span>{crimeanMaps[force.mapId].title}</span>
              </div>
              <div className="form-grid">
                <label>
                  Force name
                  <input
                    value={force.name}
                    maxLength={120}
                    onChange={(e) => edit({ name: e.target.value })}
                    required
                  />
                </label>
                <label>
                  Allegiance
                  <select
                    value={force.allegiance}
                    onChange={(e) =>
                      edit({
                        allegiance: e.target.value as KsForce['allegiance'],
                      })
                    }
                  >
                    {Object.entries(ksAllegiances).map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Force type
                  <select
                    value={force.kind}
                    onChange={(e) =>
                      edit({ kind: e.target.value as KsForce['kind'] })
                    }
                  >
                    {ksForceSchema.shape.kind.options.map((kind) => (
                      <option key={kind}>{kind}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Reported strength
                  <input
                    value={force.strength}
                    maxLength={200}
                    placeholder="e.g. 2 battalions, approximately 1,400 men"
                    onChange={(e) => edit({ strength: e.target.value })}
                  />
                </label>
                <label>
                  Commander
                  <input
                    value={force.commander}
                    maxLength={120}
                    onChange={(e) => edit({ commander: e.target.value })}
                  />
                </label>
                <label>
                  Condition
                  <input
                    value={force.condition}
                    maxLength={500}
                    placeholder="Record the umpire’s assessment"
                    onChange={(e) => edit({ condition: e.target.value })}
                  />
                </label>
              </div>
              <details>
                <summary>Composition, notes and status</summary>
                <label>
                  Composition
                  <textarea
                    value={force.composition}
                    maxLength={4000}
                    onChange={(e) => edit({ composition: e.target.value })}
                  />
                </label>
                <label>
                  Force notes
                  <textarea
                    value={force.notes}
                    maxLength={4000}
                    onChange={(e) => edit({ notes: e.target.value })}
                  />
                </label>
                <label>
                  Force status
                  <select
                    value={force.status}
                    onChange={(e) =>
                      edit({ status: e.target.value as KsForce['status'] })
                    }
                  >
                    <option value="active">Active on map</option>
                    <option value="retired">
                      Retired from map; retain history
                    </option>
                  </select>
                </label>
              </details>
              {force.intent && <p>Current intent: {force.intent.text}</p>}
            </>
          )}
          {draft.kind === 'move' && (
            <>
              <p>
                Place <strong>{draft.force.name}</strong> at the point you
                selected on <strong>{crimeanMaps[draft.mapId].title}</strong>.
              </p>
              {draft.force.mapId !== draft.mapId && (
                <p>
                  This transfers the same force from{' '}
                  {crimeanMaps[draft.force.mapId].title}. Map sheets are not
                  georeferenced to one another; the selected destination is your
                  ruling.
                </p>
              )}
              <p>
                The marker stays at its saved location until you record this
                ruling. No travel cost, losses or elapsed time are inferred.
              </p>
              <label className="ks-check">
                <input
                  type="checkbox"
                  checked={clearIntent}
                  onChange={(e) => setClearIntent(e.target.checked)}
                />
                Clear the force’s previous planned intent
              </label>
            </>
          )}
          {draft.kind === 'intent' &&
            (draft.clear ? (
              <p>
                Clear the saved planned route for {draft.force.name}. Its
                position will stay the same.
              </p>
            ) : (
              <>
                <p>
                  {draft.points.length} route points for {draft.force.name}.
                  This records intent only; it does not move the force.
                </p>
                <label>
                  Order / intent
                  <textarea
                    maxLength={2000}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    required
                  />
                </label>
              </>
            ))}
          {draft.kind === 'time' && (
            <>
              <p>
                Enter the campaign date/time agreed by the umpire. This changes
                the recorded clock only; forces and outcomes are unchanged.
              </p>
              <label>
                Campaign time
                <input
                  value={value}
                  maxLength={120}
                  placeholder="e.g. 20 September 1854, 09:00"
                  onChange={(e) => setValue(e.target.value)}
                  required
                />
              </label>
            </>
          )}
          {draft.kind === 'rename' && (
            <label>
              New campaign title
              <input
                value={value}
                maxLength={120}
                onChange={(e) => setValue(e.target.value)}
                required
              />
            </label>
          )}
          {draft.kind === 'archive' && (
            <p>
              Archive {c?.title}. It will remain available for inspection and
              export, with editing disabled.
            </p>
          )}
          {draft.kind !== 'create' &&
            !(draft.kind === 'intent' && !draft.clear) && (
              <label>
                {draft.kind === 'note'
                  ? 'Umpire note / adjudication'
                  : 'Ruling and rationale'}
                <textarea
                  value={reason}
                  maxLength={4000}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </label>
            )}
          {state.error && (
            <p role="alert" className="campaign-error">
              {state.error}
            </p>
          )}
          <div className="button-row">
            <button disabled={!valid || state.pending} type="submit">
              {draft.kind === 'create' ? 'Create KS campaign' : 'Record ruling'}
            </button>
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </fieldset>
      </form>
    </ReaderDialog>
  );
}
