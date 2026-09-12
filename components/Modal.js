'use client';

import { CloseIcon } from '@/components/icons';

export default function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            <CloseIcon width={16} height={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
