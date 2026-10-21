import type { FontenoyCampaign } from '../domain/campaign';
import { squareLabel } from '../domain/setup-editing';

export function SchematicMap({ campaign }: { campaign: FontenoyCampaign }) {
  const squares = new Map(
    campaign.squares.map((square) => [square.id, square]),
  );
  return (
    <section
      className="panel schematic-panel"
      aria-label="Schematic campaign map"
    >
      <div className="section-heading">
        <h2>Fontenoy region · schematic</h2>
        <span className="badge">12 × 8 · not verified geography</span>
      </div>
      <p>
        Original placeholder. Locations are approximate; no verified 1745 routes
        or river geometry are claimed.{' '}
        {campaign.settings.map.kilometresPerSquare === null
          ? 'Scale unspecified.'
          : `Player-selected scale: approximately ${campaign.settings.map.kilometresPerSquare} km per square.`}{' '}
        Dashed roads are player-entered proposals.
      </p>
      <div className="map-scroll">
        <svg
          viewBox="0 0 1200 800"
          role="img"
          aria-label="Schematic 12-column by 8-row map with eight named locations"
        >
          <title>Schematic Fontenoy campaign map, umpire view</title>
          {campaign.squares.map((square) => (
            <g key={square.id}>
              <rect
                x={square.column * 100}
                y={square.row * 100}
                width="100"
                height="100"
                className="map-square"
              />
              <text
                x={square.column * 100 + 7}
                y={square.row * 100 + 18}
                className="map-coordinate"
              >
                {squareLabel({ ...square, locationName: null })}
              </text>
              {square.locationName && (
                <text
                  x={square.column * 100 + 50}
                  y={square.row * 100 + 43}
                  className="map-location"
                  textAnchor="middle"
                >
                  {square.locationName}
                </text>
              )}
            </g>
          ))}
          {campaign.settings.map.roadEdges.map((edge) => {
            const from = squares.get(edge.from)!;
            const to = squares.get(edge.to)!;
            return (
              <line
                key={`${edge.from}:${edge.to}`}
                x1={from.column * 100 + 50}
                y1={from.row * 100 + 50}
                x2={to.column * 100 + 50}
                y2={to.row * 100 + 50}
                className="map-road"
              />
            );
          })}
          {campaign.columns.map((column, index) => {
            const square = column.squareId
              ? squares.get(column.squareId)
              : null;
            if (!square) return null;
            const side = campaign.factions.find(
              (f) => f.id === column.factionId,
            )?.side;
            const offset = campaign.columns
              .slice(0, index)
              .filter((c) => c.squareId === column.squareId).length;
            return (
              <g
                key={column.id}
                transform={`translate(${square.column * 100 + 20 + (offset % 3) * 29},${square.row * 100 + 69 + Math.floor(offset / 3) * 23})`}
              >
                <title>
                  {column.displayName}: {column.unitIds.length} units;{' '}
                  {column.concealment}
                </title>
                <circle
                  r="12"
                  className={`map-column ${side === 'french' ? 'french' : 'allied'} ${column.concealment === 'hidden' ? 'concealed' : ''}`}
                />
                <text y="4" textAnchor="middle" className="map-count">
                  {column.concealment === 'hidden'
                    ? 'H'
                    : column.unitIds.length}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="save-caption">
        Umpire/setup view: all assignments are visible here. Blue = French, red
        = Allied; H = marked hidden. Player-specific fog of war is deferred to
        Milestone D. Movement is not available yet.
      </p>
    </section>
  );
}
