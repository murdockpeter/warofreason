import { useId } from 'react';
import type { WaterlooCampaign } from '../domain/waterloo-schema';
import type { MapView } from '../domain/operations-schema';

/** Saved intent only: positions change through the existing resolution commands. */
export function SavedMovementRoutes({
  campaign: c,
  view,
  at,
}: {
  campaign: WaterlooCampaign;
  view: MapView;
  at(id: string): { x: number; y: number };
}) {
  const prefix = `saved-route-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  if (!['planning', 'locked'].includes(c.phase)) return null;
  const submissions = c.submissions.filter(
    (s) => view === 'umpire' || s.side === view,
  );
  return (
    <g className="saved-movement-routes" pointerEvents="none">
      <defs>
        {submissions.map((s) => (
          <marker
            key={s.side}
            id={`${prefix}-${s.side}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="9"
            markerHeight="9"
            markerUnits="userSpaceOnUse"
            orient="auto"
          >
            <path
              d="M 0 0 L 10 5 L 0 10 Z"
              fill={s.side === 'french' ? '#315f9b' : '#a43b32'}
            />
          </marker>
        ))}
      </defs>
      {submissions.flatMap((s) =>
        s.orders.map((order) => {
          const formation = c.corps.find((f) => f.id === order.corpsId)!;
          const label = `Saved movement order for ${formation.name} · ${s.locked ? 'locked' : 'planning'}`;
          return (
            <g
              key={order.corpsId}
              role="img"
              aria-label={label}
              className={`saved-movement-order saved-order-${s.side}`}
            >
              <title>
                {label}.{' '}
                {order.segments
                  .map((segment) => segment.path.join(' → '))
                  .join('; ')}
              </title>
              {order.segments.map((segment, index) => {
                const points = segment.path
                  .map((id) => {
                    const p = at(id);
                    return `${p.x},${p.y}`;
                  })
                  .join(' ');
                const end = at(segment.path.at(-1)!);
                return (
                  <g key={index} className="saved-order-segment">
                    <polyline points={points} className="saved-order-halo" />
                    <polyline
                      points={points}
                      className="saved-order-line"
                      markerEnd={`url(#${prefix}-${s.side})`}
                    />
                    <circle
                      cx={end.x}
                      cy={end.y}
                      r="9"
                      className="saved-order-destination"
                    />
                  </g>
                );
              })}
            </g>
          );
        }),
      )}
    </g>
  );
}
