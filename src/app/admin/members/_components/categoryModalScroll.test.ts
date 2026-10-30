import { expect, it, vi } from 'vitest';
import { lockCategoryPageScroll } from './categoryModalScroll';
it('freezes the background at its current position and restores it on close', () => {
 const body = { style: { cssText: 'color:red', position:'', top:'', left:'', right:'', width:'', overflow:'' } };
 const root = { style: { overflow:'auto' } };
 const scrollTo = vi.fn();
 const unlock = lockCategoryPageScroll(body as unknown as HTMLElement, root as unknown as HTMLElement, {scrollY:240, scrollTo} as unknown as Window);
 expect(body.style.position).toBe('fixed');
 expect(body.style.top).toBe('-240px');
 expect(body.style.overflow).toBe('hidden');
 expect(root.style.overflow).toBe('hidden');
 unlock();
 expect(body.style.cssText).toBe('color:red');
 expect(root.style.overflow).toBe('auto');
 expect(scrollTo).toHaveBeenCalledWith({top:240,behavior:'instant'});
});
