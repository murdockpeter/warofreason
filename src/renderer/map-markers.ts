// Fit stacked columns inside their square, leaving coordinates and town labels clear.
export function markerTransform(
  square: { row: number; column: number },
  index: number,
  count: number,
) {
  const columns = Math.min(
    count,
    Math.max(3, Math.ceil(Math.sqrt(count * 1.6))),
  );
  const rows = Math.ceil(count / columns);
  const scale = Math.min(1, 88 / (columns * 29), 46 / (rows * 46));
  const x = square.column * 100 + 7 + (13 + (index % columns) * 29) * scale;
  const y =
    square.row * 100 + 49 + (24 + Math.floor(index / columns) * 46) * scale;
  return `translate(${x},${y}) scale(${scale})`;
}
