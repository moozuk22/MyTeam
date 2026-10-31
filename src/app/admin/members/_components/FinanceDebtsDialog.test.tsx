import { beforeEach, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const state=vi.hoisted(()=>({search:''}));
vi.mock('react',async original=>({...await original<typeof import('react')>(),
  useEffect:()=>{},useRef:(current:unknown)=>({current}),useId:()=> 'debt-dialog-test',useState:()=>[state.search,(value:string)=>{state.search=value;}],
}));
import FinanceDebtsDialog from './FinanceDebtsDialog';
const debts=['Анна Петрова','Борис Иванов','Яна Георгиева'].map((name,index)=>({id:String(index),name,periods:['2026-10'],amount:'75.00',fee:'75.00',conflict:false,avatarUrl:null}));
type Node=ReactElement<Record<string,unknown>>;
function nodes(value:unknown):Node[]{
 if(Array.isArray(value))return value.flatMap(nodes);
 if(!isValidElement<Record<string,unknown>>(value))return [];
 return [value,...nodes(value.props.children)];
}
const draw=(onClose=vi.fn())=>FinanceDebtsDialog({debts,renderDebt:debt=><li key={debt.id}>{debt.name}</li>,onClose});
beforeEach(()=>{state.search='';});
it('shows every supplied player and an accessible search field',()=>{
 const html=renderToStaticMarkup(draw());
 expect(html).toContain('<dialog');expect(html).toContain('aria-labelledby=');
 expect(html).toContain('Търси състезател');expect(html).toContain('type="search"');
 expect(html).toContain('3 от 3 състезатели');
 for(const debt of debts)expect(html).toContain(debt.name);
});
it('filters Cyrillic names case-insensitively and restores all players when cleared',()=>{
 const change=(value:string)=>{const input=nodes(draw()).find(node=>node.type==='input')!;(input.props.onChange as (event:unknown)=>void)({target:{value}});};
 change('  ПЕТРОВА  ');
 let html=renderToStaticMarkup(draw());
 expect(html).toContain('Анна Петрова');expect(html).not.toContain('Борис Иванов');expect(html).toContain('1 от 3 състезатели');
 change('няма такъв');html=renderToStaticMarkup(draw());expect(html).toContain('Няма намерени състезатели.');
 change('');html=renderToStaticMarkup(draw());expect(html).toContain('3 от 3 състезатели');
});
it('closes through the close button and Escape',()=>{
 const close=vi.fn();const tree=draw(close);
 (nodes(tree).find(node=>node.type==='button')!.props.onClick as ()=>void)();
 expect(close).toHaveBeenCalledTimes(1);
 const preventDefault=vi.fn();(tree.props.onCancel as (event:unknown)=>void)({preventDefault});
 expect(preventDefault).toHaveBeenCalled();expect(close).toHaveBeenCalledTimes(2);
});
