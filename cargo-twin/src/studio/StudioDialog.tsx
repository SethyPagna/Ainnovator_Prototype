import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './StudioIcons';

export function StudioDialog({ title, subtitle, onClose, children, notice, onDismissNotice }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; notice?: string; onDismissNotice?: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = dialogRef.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={dialogRef} className="ct-dialog" aria-labelledby="ct-dialog-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}><div className="ct-dialog-inner"><header><div><h2 id="ct-dialog-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="ct-icon-button" onClick={onClose} aria-label="Close dialog"><Icon name="close" /></button></header>{notice && <div className="ct-dialog-notice" role="status"><Icon name="help" size={18} /><span>{notice}</span><button className="ct-icon-button" onClick={onDismissNotice} aria-label="Dismiss notification"><Icon name="close" size={15} /></button></div>}{children}</div></dialog>;
}
