import {expect,it} from 'vitest';
import {financeCategoryAvailable,financeCategoryVisibilityLabel} from './financeCategoryVisibility';
it.each([
 [false,false,true,true,''],
 [true,false,false,true,'Скрита за разходи'],
 [false,true,true,false,'Скрита за приходи'],
 [true,true,false,false,'Неактивна'],
] as const)('filters each transaction kind independently (%s, %s)',(hiddenForExpense,hiddenForRevenue,expense,revenue,label)=>{
 const category={isActive:!(hiddenForExpense && hiddenForRevenue),hiddenForExpense,hiddenForRevenue};
 expect(financeCategoryAvailable(category,'expense')).toBe(expense);
 expect(financeCategoryAvailable(category,'revenue')).toBe(revenue);
 expect(financeCategoryVisibilityLabel(category)).toBe(label);
});
it('keeps previously inactive categories hidden without scoped fields',()=>{
 expect(financeCategoryAvailable({isActive:false},'expense')).toBe(false);
 expect(financeCategoryAvailable({isActive:false},'revenue')).toBe(false);
});
