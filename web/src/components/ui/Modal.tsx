import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from '../icons';
import { IconButton } from './IconButton';

export interface ModalProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  footer?: ReactNode;
}

/**
 * 统一弹窗：遮罩 + 居中面板 + 标题栏，支持 Esc / 点遮罩关闭。
 */
export function Modal({ open, title, onClose, children, width = 420, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="ui-modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="ui-modal-panel" style={{ width }}>
        {title && (
          <div className="ui-modal-head">
            <h3 className="ui-modal-title">{title}</h3>
            <IconButton label="关闭" size="sm" onClick={onClose}>
              <CloseIcon size={14} />
            </IconButton>
          </div>
        )}
        <div className="ui-modal-body">{children}</div>
        {footer && <div className="ui-modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
