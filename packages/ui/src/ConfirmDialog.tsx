import { useEffect, useRef } from "react";

export interface ConfirmDialogProps {
  readonly open: boolean;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * A small, focus-trapped confirmation dialog. Pure presentation — it renders a
 * message and two callbacks, importing no engine/domain code. Accessible:
 * `role="alertdialog"` + `aria-modal`, focus moved to Cancel on open (the safe
 * default) and restored on close, Esc cancels, Tab is trapped.
 */
export function ConfirmDialog({
  open,
  message,
  confirmLabel = "Discard & continue",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmDialogProps): JSX.Element | null {
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => previouslyFocused.current?.focus();
  }, [open]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onCancel();
      return;
    }
    if (e.key !== "Tab") return;
    // Trap Tab between the two buttons.
    e.preventDefault();
    const active = document.activeElement;
    (active === cancelRef.current ? confirmRef.current : cancelRef.current)?.focus();
  };

  return (
    <div className="cbe-overlay-backdrop cbe-confirm-backdrop" onClick={onCancel}>
      <div
        className="cbe-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cbe-confirm-message"
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        <p id="cbe-confirm-message" className="cbe-confirm-message">
          {message}
        </p>
        <div className="cbe-confirm-actions">
          <button ref={cancelRef} className="cbe-btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button ref={confirmRef} className="cbe-btn cbe-btn-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
