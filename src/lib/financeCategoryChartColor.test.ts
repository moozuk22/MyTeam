import { expect, it } from 'vitest';
import { financeCategoryChartColor } from './financeCategoryChartColor';
import { CUSTOM_TRAINING_GROUP_COLOR_PALETTE } from './customTrainingGroupColors';
it('uses saved category colors and stable palette fallbacks for uncolored categories', () => {
 expect(financeCategoryChartColor({id:'a',color:'#FB8C00'})).toBe('#FB8C00');
 const fallback = financeCategoryChartColor({id:'uncolored',color:null});
 expect(CUSTOM_TRAINING_GROUP_COLOR_PALETTE).toContain(fallback);
 expect(financeCategoryChartColor({id:'uncolored'})).toBe(fallback);
 expect(new Set(Array.from({length:20},(_,i) => financeCategoryChartColor({id:String(i)}))).size).toBeGreaterThan(1);
});
