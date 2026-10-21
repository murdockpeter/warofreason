/** Original generic infantry artwork: a column emblem, not a composition indicator. */
export function ColumnMarker({
  side,
  concealed,
  count,
}: {
  side: 'french' | 'allied' | undefined;
  concealed: boolean;
  count: number | '?';
}) {
  return (
    <g aria-hidden="true" className="column-marker">
      <rect
        x="-13"
        y="-24"
        width="26"
        height="42"
        rx="4"
        className={`map-column ${side ?? 'unknown'} ${concealed ? 'concealed' : ''}`}
      />
      <g className="map-infantry" transform="translate(-12,-23)">
        {/* Tricorn, head, long coat, marching legs and shouldered musket. */}
        <path d="M6 6 8 2l3 1 3-1 2 4-5-1Z M8 6h6v3l-2 2-3-1Z M9 11l4-1 3 4-2 2-1-2 2 7H6l2-7-3 3-2-2 5-4Z M7 21h4l-2 6H4v-2h2Z M11 21h3l3 5-1 2h-5v-2h2Z" />
        <path d="m18 2 2 .3-3 19-3-.5.5-3 1.5.2Z M15 12l4 1-.5 2-4-1Z" />
      </g>
      <path
        d="M-12 5h24v9a3 3 0 0 1-3 3H-9a3 3 0 0 1-3-3Z"
        className={`map-marker-band ${side ?? 'unknown'}`}
      />
      <text y="14" textAnchor="middle" className="map-count">
        {count}
      </text>
    </g>
  );
}
