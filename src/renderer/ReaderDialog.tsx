import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

/** Read-only dialogs leave all campaign drafts and saved state untouched. */
export function ReaderDialog({
  title,
  className = '',
  children,
  onDismiss,
}: {
  title: string;
  className?: string;
  children: ReactNode;
  onDismiss(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current!;
    element.showModal();
    return () => {
      element.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`reader-dialog ${className}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
    >
      <header className="reader-header">
        <h2>{title}</h2>
        <button
          className="secondary"
          autoFocus
          onClick={onDismiss}
          aria-label={`Close ${title}`}
        >
          Close <span aria-hidden="true">×</span>
        </button>
      </header>
      <div className="reader-body">{children}</div>
    </dialog>
  );
}
