import type { ReactNode } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmProps {
  open: boolean;
  title: string;
  /** 需要用户确认的后果描述，如“将把 XX 移出群聊” */
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * 统一危险操作确认弹窗（踢人 / 退群 / 清空记录等）。
 * danger 模式确认按钮为红色。
 */
export function Confirm({
  open,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  loading = false,
  onConfirm,
  onClose,
}: ConfirmProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      width={360}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmText}
          </Button>
        </div>
      }
    >
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{description}</p>
    </Modal>
  );
}
