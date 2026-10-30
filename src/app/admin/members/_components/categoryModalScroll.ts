/** Freeze the background even on browsers that allow root scrolling with a dialog open. */
export function lockCategoryPageScroll(body: HTMLElement, root: HTMLElement, viewport: Window) {
 const bodyStyles = body.style.cssText;
 const rootOverflow = root.style.overflow;
 const scrollY = viewport.scrollY;
 Object.assign(body.style, {position:'fixed',top:`-${scrollY}px`,left:'0',right:'0',width:'100%',overflow:'hidden'});
 root.style.overflow = 'hidden';
 return () => {
  body.style.cssText = bodyStyles;
  root.style.overflow = rootOverflow;
  viewport.scrollTo({top:scrollY,behavior:'instant'});
 };
}
