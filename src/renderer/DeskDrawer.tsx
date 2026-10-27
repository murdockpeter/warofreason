import { useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

/** Non-modal: the map remains usable while a route or scouting draft is open. */
export function DeskDrawer({
  title,
  children,
  edge = 'side',
  openWhen = false,
  className = '',
  inline = false,
}: {
  title: string;
  children: ReactNode;
  edge?: 'side' | 'bottom';
  openWhen?: boolean | number;
  className?: string;
  inline?: boolean;
}) {
  const drawer = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const requested = useRef(false);
  const position = useCallback(() => {
    const scope =
      drawer.current?.closest('.app-shell') ?? drawer.current?.parentElement;
    const map = scope?.querySelector('.desk-map, .schematic-panel');
    if (map)
      drawer.current?.style.setProperty(
        '--drawer-top',
        `${Math.min(Math.max(65, map.getBoundingClientRect().top), window.innerHeight - 220)}px`,
      );
  }, []);
  useEffect(position);
  useEffect(() => {
    window.addEventListener('resize', position);
    return () => window.removeEventListener('resize', position);
  }, [position]);
  useEffect(() => {
    if (openWhen) drawer.current!.open = true;
    else if (edge === 'bottom' && requested.current)
      drawer.current!.open = false;
    requested.current = !!openWhen;
  }, [openWhen, edge]);
  const close = () => {
    drawer.current!.open = false;
    summary.current?.focus();
  };
  return (
    <details
      ref={drawer}
      className={`desk-drawer ${className}`}
      data-inline={inline || undefined}
      data-drawer={title}
      data-edge={edge}
      onToggle={(e) => {
        if (!e.currentTarget.open) return;
        position();
        const desk =
          e.currentTarget.closest('.app-shell') ??
          e.currentTarget.closest('.waterloo-desk, .operational-layout');
        desk
          ?.querySelectorAll<HTMLDetailsElement>(
            `.desk-drawer[data-edge="${edge}"][open]`,
          )
          .forEach((other) => {
            if (other !== drawer.current) other.open = false;
          });
      }}
      onKeyDown={(e) => {
        if (
          e.key === 'Escape' &&
          drawer.current?.open &&
          !document.querySelector('dialog[open]')
        ) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      }}
    >
      <summary ref={summary}>{title}</summary>
      <section className="desk-drawer-sheet" aria-label={`${title} drawer`}>
        <header className="desk-drawer-header">
          <h2>{title}</h2>
          <button
            className="secondary"
            onClick={close}
            aria-label={`Close ${title}`}
          >
            Back to map <span aria-hidden="true">×</span>
          </button>
        </header>
        <div className="desk-drawer-content">{children}</div>
      </section>
    </details>
  );
}
