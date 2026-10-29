import {expect,it} from 'vitest';
import {categoryDragScrollSpeed} from './categoryDragScroll';
it('scrolls near either edge, accelerates toward the edge, and stops in the middle', () => {
 expect(categoryDragScrollSpeed(490,100,500)).toBeGreaterThan(0);
 expect(categoryDragScrollSpeed(110,100,500)).toBeLessThan(0);
 expect(categoryDragScrollSpeed(300,100,500)).toBe(0);
 expect(categoryDragScrollSpeed(499,100,500)).toBeGreaterThan(categoryDragScrollSpeed(470,100,500));
 expect(categoryDragScrollSpeed(530,100,500)).toBe(600);
});
