import {expect,it} from 'vitest';
import {financeCategoriesForKind} from './financeCategoryOrder';
it('sorts each kind independently without changing the source list',()=>{
 const categories=[{id:'a',name:'A',sortOrder:0,expenseSortOrder:1,revenueSortOrder:0},{id:'b',name:'B',sortOrder:1,expenseSortOrder:0,revenueSortOrder:1}];
 expect(financeCategoriesForKind(categories,'expense').map(c=>c.id)).toEqual(['b','a']);
 expect(financeCategoriesForKind(categories,'revenue').map(c=>c.id)).toEqual(['a','b']);
 expect(categories.map(c=>c.id)).toEqual(['a','b']);
});
it('uses shared order for older payloads and resolves ties consistently',()=>{
 const categories=[{id:'c',name:'C',sortOrder:1},{id:'b',name:'B',sortOrder:0},{id:'a',name:'A',sortOrder:0}];
 expect(financeCategoriesForKind(categories,'expense').map(c=>c.id)).toEqual(['a','b','c']);
});
