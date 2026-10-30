'use client';
import { createPortal } from 'react-dom';
import FinanceSkeleton, { SkeletonLine } from './FinanceSkeleton';
import '../page.css';

export default function FinancePlayerSkeleton({ onClose }: { onClose: () => void }) {
 return createPortal(<div className="amp-overlay" onClick={onClose}>
  <div className="amp-modal" role="dialog" aria-modal="true" aria-label="Детайли за състезател" onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
   <div className="amp-modal-tint" aria-hidden="true" />
   <div className="amp-modal-title"><SkeletonLine wide /><button type="button" className="amp-modal-close" aria-label="Затвори" autoFocus onClick={onClose}>×</button></div>
   <div className="amp-modal-body"><FinanceSkeleton variant="profile" /></div>
  </div>
 </div>,document.body);
}
