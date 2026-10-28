import { useEffect, useRef, useState } from 'react';
import type {
  KsForce,
  KsMapId,
  KsPosition,
  KsStagedForce,
} from '../domain/crimean-ks';
import { crimeanMaps, ksColors } from './crimean-maps';
type Camera = { x: number; y: number; width: number; height: number };
export function KsMapCanvas({
  mapId,
  forces,
  selected,
  route,
  deploymentPreview = [],
  onPoint,
  onMapMenu,
  onForceMenu,
  onSelect,
}: {
  mapId: KsMapId;
  forces: KsForce[];
  selected: string | null;
  route: KsPosition[];
  deploymentPreview?: { force: KsStagedForce; position: KsPosition }[];
  onPoint(p: KsPosition): void;
  onMapMenu(p: KsPosition, client: { x: number; y: number }): void;
  onForceMenu(f: KsForce, client: { x: number; y: number }): void;
  onSelect(f: KsForce): void;
}) {
  const map = crimeanMaps[mapId],
    initial = { x: 0, y: 0, width: map.width, height: map.height };
  const [camera, setCamera] = useState<Camera>(initial),
    [viewport, setViewport] = useState({ width: 1100, height: 650 });
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    camera: Camera;
    moved: boolean;
  } | null>(null);
  const constrain = (c: Camera) => ({
    ...c,
    x: Math.min(map.width - c.width, Math.max(0, c.x)),
    y: Math.min(map.height - c.height, Math.max(0, c.y)),
  });
  const changeZoom = (
    c: Camera,
    factor: number,
    point = { x: c.x + c.width / 2, y: c.y + c.height / 2 },
  ) => {
    const width = Math.max(
        map.width / 12,
        Math.min(map.width, c.width / factor),
      ),
      height = (width * map.height) / map.width;
    return constrain({
      x: point.x - ((point.x - c.x) * width) / c.width,
      y: point.y - ((point.y - c.y) * height) / c.height,
      width,
      height,
    });
  };
  useEffect(() => {
    const element = svg.current!;
    const resize = () => {
      const box = element.getBoundingClientRect();
      if (box.width && box.height)
        setViewport({ width: box.width, height: box.height });
    };
    resize();
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, []);
  useEffect(() => {
    const element = svg.current!;
    function wheel(e: WheelEvent) {
      const matrix = element.getScreenCTM();
      if (!matrix) return;
      e.preventDefault();
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
        matrix.inverse(),
      );
      setCamera((c) => {
        const width = Math.max(
            map.width / 12,
            Math.min(map.width, c.width / (e.deltaY < 0 ? 1.2 : 1 / 1.2)),
          ),
          height = (width * map.height) / map.width;
        return {
          x: Math.min(
            map.width - width,
            Math.max(0, p.x - ((p.x - c.x) * width) / c.width),
          ),
          y: Math.min(
            map.height - height,
            Math.max(0, p.y - ((p.y - c.y) * height) / c.height),
          ),
          width,
          height,
        };
      });
    }
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [map.width, map.height]);
  const worldPerPixel = Math.max(
    camera.width / viewport.width,
    camera.height / viewport.height,
  );
  const point = (client: {
    clientX: number;
    clientY: number;
  }): KsPosition | null => {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return null;
    const p = new DOMPoint(client.clientX, client.clientY).matrixTransform(
        matrix.inverse(),
      ),
      x = p.x / map.width,
      y = p.y / map.height;
    return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
  };
  const focus = forces.find((f) => f.id === selected && f.mapId === mapId);
  const points = (p: KsPosition[]) =>
    p.map((p) => `${p.x * map.width},${p.y * map.height}`).join(' ');
  const active = forces.filter(
    (f) => f.mapId === mapId && f.status === 'active',
  );
  return (
    <div className="ks-map-canvas">
      <div
        className="map-navigation"
        role="toolbar"
        aria-label="Crimean map navigation"
      >
        <button
          aria-label="Zoom out"
          disabled={camera.width >= map.width}
          onClick={() => setCamera((c) => changeZoom(c, 1 / 1.5))}
        >
          −
        </button>
        <output aria-label="Crimean map zoom">
          {Math.round((map.width / camera.width) * 100)}%
        </output>
        <button
          aria-label="Zoom in"
          disabled={camera.width <= map.width / 12}
          onClick={() => setCamera((c) => changeZoom(c, 1.5))}
        >
          +
        </button>
        <button onClick={() => setCamera(initial)}>Fit sheet</button>
        <button
          disabled={!focus}
          onClick={() => {
            if (focus)
              setCamera(
                constrain({
                  width: map.width / 4,
                  height: map.height / 4,
                  x: focus.position.x * map.width - map.width / 8,
                  y: focus.position.y * map.height - map.height / 8,
                }),
              );
          }}
        >
          Find selected force
        </button>
        <small>Drag to pan · scroll to zoom · right-click for actions</small>
      </div>
      <svg
        ref={svg}
        className="ks-period-map"
        aria-label={`Crimean KS map: ${map.title}`}
        viewBox={`${camera.x} ${camera.y} ${camera.width} ${camera.height}`}
        tabIndex={0}
        onPointerDown={(e) => {
          if (e.button === 0 || e.button === 1) {
            drag.current = {
              id: e.pointerId,
              x: e.clientX,
              y: e.clientY,
              camera,
              moved: false,
            };
            if (e.button === 1) e.preventDefault();
          }
        }}
        onPointerMove={(e) => {
          const start = drag.current;
          if (
            !start ||
            start.id !== e.pointerId ||
            !e.buttons ||
            Math.hypot(e.clientX - start.x, e.clientY - start.y) < 5
          )
            return;
          const matrix = svg.current!.getScreenCTM();
          if (!matrix) return;
          start.moved = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          setCamera(
            constrain({
              ...start.camera,
              x: start.camera.x - (e.clientX - start.x) / matrix.a,
              y: start.camera.y - (e.clientY - start.y) / matrix.d,
            }),
          );
        }}
        onPointerUp={(e) => {
          if (
            drag.current?.moved &&
            e.currentTarget.hasPointerCapture(e.pointerId)
          )
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onClickCapture={(e) => {
          if (drag.current?.moved) {
            e.stopPropagation();
            e.preventDefault();
            drag.current = null;
          }
        }}
        onClick={(e) => {
          const p = point(e);
          if (p) onPoint(p);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          const p = point(e);
          if (p) onMapMenu(p, { x: e.clientX, y: e.clientY });
        }}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          const d = {
            ArrowLeft: [-1, 0],
            ArrowRight: [1, 0],
            ArrowUp: [0, -1],
            ArrowDown: [0, 1],
          }[e.key];
          if (d) {
            e.preventDefault();
            setCamera((c) =>
              constrain({
                ...c,
                x: c.x + (d[0]! * c.width) / 8,
                y: c.y + (d[1]! * c.height) / 8,
              }),
            );
          }
        }}
      >
        <image
          href={map.image}
          x={0}
          y={0}
          width={map.width}
          height={map.height}
          aria-hidden="true"
        />
        {forces
          .filter((f) => f.intent?.mapId === mapId && f.status === 'active')
          .map((f) => (
            <polyline
              key={f.id}
              role="img"
              aria-label={`Planned intent for ${f.name}`}
              points={points(f.intent!.points)}
              fill="none"
              stroke={ksColors[f.allegiance]}
              strokeWidth={3 * worldPerPixel}
              strokeDasharray={`${8 * worldPerPixel} ${5 * worldPerPixel}`}
              pointerEvents="none"
            />
          ))}
        {route.length > 0 && (
          <polyline
            aria-label="Unsaved Crimean route"
            role="img"
            points={points(route)}
            fill="none"
            stroke="#cf9136"
            strokeWidth={4 * worldPerPixel}
            strokeDasharray={`${6 * worldPerPixel} ${3 * worldPerPixel}`}
            pointerEvents="none"
          />
        )}
        {deploymentPreview.map(({ force: f, position }, i) => (
          <g
            key={f.id}
            role="img"
            aria-label={`Deployment preview ${f.name}`}
            pointerEvents="none"
            opacity={0.8}
          >
            <rect
              x={position.x * map.width - 16 * worldPerPixel}
              y={position.y * map.height - 12 * worldPerPixel}
              width={32 * worldPerPixel}
              height={24 * worldPerPixel}
              fill={ksColors[f.allegiance]}
              stroke="#ffda7b"
              strokeWidth={2 * worldPerPixel}
              strokeDasharray={`${4 * worldPerPixel} ${2 * worldPerPixel}`}
            />
            <text
              x={position.x * map.width}
              y={position.y * map.height + 4 * worldPerPixel}
              textAnchor="middle"
              fill="white"
              fontSize={11 * worldPerPixel}
            >
              {i + 1}
            </text>
            <title>{f.name} (preview, not saved)</title>
          </g>
        ))}
        {active.map((f) => {
          const x = f.position.x * map.width,
            y = f.position.y * map.height,
            size = 32 * worldPerPixel;
          const label = {
            infantry: 'INF',
            cavalry: 'CAV',
            artillery: 'ART',
            naval: 'SHIP',
            supply: 'LOG',
            hq: 'HQ',
            other: '•',
          }[f.kind];
          return (
            <g
              key={f.id}
              role="button"
              aria-label={`Force ${f.name}`}
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(f);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onForceMenu(f, { x: e.clientX, y: e.clientY });
              }}
              onKeyDown={(e) => {
                drag.current = null;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelect(f);
                }
              }}
            >
              <title>
                {f.name} · {f.strength || 'Strength unrecorded'} ·{' '}
                {f.condition || 'Condition unrecorded'}
              </title>
              <rect
                x={x - size / 2}
                y={y - size / 3}
                width={size}
                height={(size * 2) / 3}
                rx={3 * worldPerPixel}
                fill={ksColors[f.allegiance]}
                stroke={selected === f.id ? '#ffda7b' : '#f6efe0'}
                strokeWidth={(selected === f.id ? 3 : 1.5) * worldPerPixel}
              />
              <text
                x={x}
                y={y + 4 * worldPerPixel}
                fill="white"
                fontSize={10 * worldPerPixel}
                fontWeight="bold"
                textAnchor="middle"
                pointerEvents="none"
              >
                {label}
              </text>
              <text
                x={x}
                y={y + 26 * worldPerPixel}
                className="ks-force-label"
                fontSize={11 * worldPerPixel}
                textAnchor="middle"
                pointerEvents="none"
              >
                {f.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
