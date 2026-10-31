'use client';
import { useLayoutEffect, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import styles from './FinanceDashboard.module.css';

export default function FinanceActionDropdown({ id, label, anchor, panelRef, children }: {
 id:string; label:string; anchor:RefObject<HTMLButtonElement | null>; panelRef:RefObject<HTMLDivElement | null>; children:ReactNode;
}) {
 useLayoutEffect(() => {
  const position = () => {
   const button = anchor.current;
   const panel = panelRef.current;
   if (!button || !panel) return;
   const bounds = button.getBoundingClientRect();
   const width = Math.min(420,window.innerWidth-32);
   const below = window.innerHeight-bounds.bottom-24;
   const above = bounds.top-24;
   const opensAbove = below < 240 && above > below;
   Object.assign(panel.style,{
    width:`${width}px`,
    left:`${Math.max(16,Math.min(bounds.right-width,window.innerWidth-width-16))}px`,
    top:opensAbove ? 'auto' : `${bounds.bottom+8}px`,
    bottom:opensAbove ? `${window.innerHeight-bounds.top+8}px` : 'auto',
    maxHeight:`${Math.max(80,Math.min(window.innerHeight*0.75,opensAbove ? above : below))}px`,
   });
  };
  position();
  window.addEventListener('resize',position);
  window.addEventListener('scroll',position,true);
  return () => { window.removeEventListener('resize',position); window.removeEventListener('scroll',position,true); };
 },[anchor,panelRef]);
 return createPortal(<div ref={panelRef} id={id} role="region" aria-label={label} className={styles.dashboard} style={{position:'fixed',zIndex:80,paddingBottom:0}}>
  <div className={styles.analysisDropdown} style={{position:'relative',inset:'auto',width:'100%',maxHeight:'inherit'}}>{children}</div>
 </div>,document.body);
}
