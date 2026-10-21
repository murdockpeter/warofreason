import { useEffect, useRef } from 'react';
import type { FontenoyCampaign } from '../domain/campaign';
import { useCampaigns } from './campaign-store';

export function SplitFormation({ campaign }: { campaign: FontenoyCampaign }) {
  const state = useCampaigns();
  const dialog = useRef<HTMLDialogElement>(null);
  const draft =
    state.tabletopDraft?.kind === 'formation' ? state.tabletopDraft : null;
  useEffect(() => {
    if (draft && !dialog.current?.open) dialog.current?.showModal();
  }, [draft]);
  if (!draft) return null;
  const command = draft.command;
  const source = campaign.columns.find((c) => c.id === command.columnId);
  if (!source) return null;
  const transfer = (id: string, commander = false) => {
    const key = commander ? 'commanderIds' : 'unitIds';
    const ids = command[key];
    state.editTabletop({
      ...draft,
      command: {
        ...command,
        [key]: ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id],
      },
    });
  };
  const dismiss = () => {
    if (!state.pending) void state.discard();
  };
  return (
    <dialog
      ref={dialog}
      className="split-dialog"
      aria-labelledby="split-title"
      onCancel={(e) => {
        e.preventDefault();
        dismiss();
      }}
    >
      <h2 id="split-title">Split formation</h2>
      <p>
        Move units between the two panes. Both formations stay in the same
        square.
      </p>
      <label className="split-name">
        New formation name
        <input
          autoFocus
          maxLength={120}
          value={command.displayName}
          disabled={state.pending}
          onChange={(e) =>
            state.editTabletop({
              ...draft,
              command: { ...command, displayName: e.target.value },
            })
          }
        />
      </label>
      <div className="split-panes">
        {[false, true].map((destination) => (
          <section
            key={String(destination)}
            aria-label={destination ? 'New formation' : 'Original formation'}
          >
            <h3>
              {destination
                ? command.displayName || 'New formation'
                : source.displayName}
            </h3>
            <p>
              {destination
                ? command.unitIds.length
                : source.unitIds.length - command.unitIds.length}{' '}
              {(destination
                ? command.unitIds.length
                : source.unitIds.length - command.unitIds.length) === 1
                ? 'unit'
                : 'units'}
            </p>
            <div className="split-roster">
              {source.unitIds
                .filter((id) => command.unitIds.includes(id) === destination)
                .map((id) => {
                  const unit = campaign.units.find((u) => u.id === id)!;
                  return (
                    <button
                      key={id}
                      className="split-unit"
                      disabled={state.pending}
                      aria-label={`Move ${unit.displayName} to ${destination ? 'original' : 'new'} formation`}
                      onClick={() => transfer(id)}
                    >
                      <span>
                        {unit.displayName}
                        <small>
                          {unit.type.replaceAll('_', ' ')} ·{' '}
                          {unit.quality ?? 'no regular quality'} ·{' '}
                          {unit.currentStatus}
                        </small>
                      </span>
                      <span aria-hidden="true">{destination ? '←' : '→'}</span>
                    </button>
                  );
                })}
              {source.commanderIds
                .filter(
                  (id) => command.commanderIds.includes(id) === destination,
                )
                .map((id) => {
                  const officer = campaign.commanders.find((c) => c.id === id)!;
                  return (
                    <button
                      key={id}
                      className="split-unit"
                      disabled={state.pending}
                      onClick={() => transfer(id, true)}
                    >
                      <span>
                        {officer.displayName}
                        <small>
                          Commander · move{' '}
                          {destination ? 'back' : 'to new formation'}
                        </small>
                      </span>
                      <span aria-hidden="true">{destination ? '←' : '→'}</span>
                    </button>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
      {state.error && (
        <p role="alert" className="campaign-error">
          {state.error}
        </p>
      )}
      <div className="button-row">
        <button
          disabled={
            state.pending ||
            !command.displayName.trim() ||
            !command.unitIds.length ||
            command.unitIds.length === source.unitIds.length
          }
          onClick={() => {
            void state.saveTabletop();
          }}
        >
          Save split
        </button>
        <button
          className="secondary"
          disabled={state.pending}
          onClick={dismiss}
        >
          Cancel split
        </button>
      </div>
      <p className="save-caption">
        Keep at least one unit in each formation. This saves a journaled
        reorganisation, using your campaign house rules.
      </p>
    </dialog>
  );
}
