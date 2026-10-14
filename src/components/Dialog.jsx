import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Dialog({ children, title, onClose, className = '' }) {
    const ref = useRef(null);
    useEffect(() => {
        const dialog = ref.current;
        dialog.showModal();
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previousOverflow; };
    }, []);
    return (
        <dialog ref={ref} className={`app-dialog ${className}`} aria-label={title}
            onCancel={event => { event.preventDefault(); onClose(); }}
            onClick={event => { if (event.target === ref.current) onClose(); }}>
            <div className="dialog-inner">
                <div className="dialog-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="关闭弹窗"><X size={20} /></button></div>
                <div className="dialog-body">{children}</div>
            </div>
        </dialog>
    );
}
