import { useEffect, useRef } from 'react';

export function FormationMenu({
  x,
  y,
  title,
  actions,
  dismiss,
}: {
  x: number;
  y: number;
  title: string;
  actions: { label: string; disabled?: boolean; run(): void }[];
  dismiss(): void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = menu.current!;
    element.style.left = `${Math.max(8, Math.min(x, window.innerWidth - 250))}px`;
    element.style.top = `${Math.max(8, Math.min(y, window.innerHeight - element.offsetHeight - 8))}px`;
    element.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const close = (e: PointerEvent) => {
      if (!element.contains(e.target as Node)) dismiss();
    };
    document.addEventListener('pointerdown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      previous?.focus();
    };
  }, [x, y, dismiss]);
  return (
    <div
      className="formation-menu"
      ref={menu}
      role="menu"
      aria-label={`${title} actions`}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === 'Escape' || e.key === 'Tab') {
          dismiss();
          return;
        }
        const buttons = [
          ...menu.current!.querySelectorAll<HTMLButtonElement>(
            'button:not(:disabled)',
          ),
        ];
        const index = buttons.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
          e.preventDefault();
          const target =
            e.key === 'Home'
              ? 0
              : e.key === 'End'
                ? buttons.length - 1
                : (index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) %
                  buttons.length;
          buttons[target]?.focus();
        }
      }}
    >
      <strong>{title}</strong>
      {actions.map((action) => (
        <button
          role="menuitem"
          key={action.label}
          disabled={action.disabled}
          onClick={() => {
            dismiss();
            action.run();
          }}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
