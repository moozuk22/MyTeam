import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement } from 'react';
const hooks = vi.hoisted(() => ({values:[] as unknown[],cursor:0}));
vi.mock('react',async original => ({
 ...await original<typeof import('react')>(),
 useState:(initial:unknown) => {
  const index=hooks.cursor++;
  if (!(index in hooks.values)) hooks.values[index]=initial;
  return [hooks.values[index],(next:unknown)=>{hooks.values[index]=typeof next === 'function' ? next(hooks.values[index]) : next;}];
 },
 useId:()=> 'finance',useRef:()=>({current:null}),useEffect:()=>{},useLayoutEffect:()=>{},
}));
import FinanceDashboard from './FinanceDashboard';
const data = {month:'all',page:1,count:0,startedAt:'2026-01-01',categories:[],entries:[],subtotals:[],totals:[],outstanding:'60',incomplete:false,debts:[{id:'player',name:'Иван',periods:['2026-10'],amount:'60',fee:'60',conflict:false,avatarUrl:null}]};
type Node = ReactElement<Record<string,unknown>>;
function nodes(value:unknown):Node[] {
 if (Array.isArray(value)) return value.flatMap(nodes);
 if (!isValidElement<Record<string,unknown>>(value)) return [];
 return [value,...nodes(value.props.children)];
}
function render() {
 hooks.cursor=0;
 return FinanceDashboard({clubId:'club',data,report:data,month:'all',filters:null,onSaved:vi.fn()});
}
function text(value:unknown):string {
 if (Array.isArray(value)) return value.map(text).join('');
 if (isValidElement<Record<string,unknown>>(value)) return text(value.props.children);
 return typeof value==='string' || typeof value==='number' ? String(value) : '';
}
function click(node:Node) { (node.props.onClick as (event:unknown) => void)({currentTarget:null}); }
function action(tree:unknown,name:string) { return nodes(tree).find(node=>node.type==='button' && String(node.props['aria-controls']).endsWith(name))!; }
beforeEach(()=>{hooks.values=[];hooks.cursor=0;vi.stubGlobal('requestAnimationFrame',vi.fn());});
afterEach(()=>vi.unstubAllGlobals());
it('opens the income form and player list as mutually exclusive dropdowns without leaving Analysis',()=>{
 let tree=render();
 click(action(tree,'-analysis'));tree=render();
 click(action(tree,'-revenue-dropdown'));tree=render();
 expect(tree.props['data-view']).toBe('analysis');
 expect(action(tree,'-revenue-dropdown').props['aria-expanded']).toBe(true);
 // The floating panel must not be a normal region element inside the card grid.
 expect(nodes(tree).some(node=>node.type==='div' && node.props.role==='region' && node.props['aria-label']==='Добави приход')).toBe(false);
 expect(nodes(tree).filter(node=>node.type==='form')).toHaveLength(1);
 expect(nodes(tree).some(node=>node.type==='h2' && node.props.children==='Добави приход')).toBe(true);
 click(action(tree,'-expense-dropdown'));tree=render();
 expect(tree.props['data-view']).toBe('analysis');
 expect(action(tree,'-revenue-dropdown').props['aria-expanded']).toBe(false);
 expect(action(tree,'-expense-dropdown').props['aria-expanded']).toBe(true);
 expect(nodes(tree).filter(node=>node.type==='form')).toHaveLength(1);
 expect(nodes(tree).some(node=>node.type==='h2' && node.props.children==='Добави разход')).toBe(true);
 expect(text(action(tree,'-debts-dropdown'))).toContain('60,00');
 expect(text(action(tree,'-debts-dropdown'))).toContain('1 състезател');
 click(action(tree,'-debts-dropdown'));tree=render();
 expect(tree.props['data-view']).toBe('analysis');
 expect(action(tree,'-revenue-dropdown').props['aria-expanded']).toBe(false);
 expect(action(tree,'-debts-dropdown').props['aria-expanded']).toBe(true);
 expect(nodes(tree).some(node=>node.props['aria-label']==='Детайли за Иван')).toBe(true);
 expect(nodes(tree).filter(node=>node.type==='form')).toHaveLength(0);
 click(action(tree,'-debts-dropdown'));tree=render();
 expect(action(tree,'-debts-dropdown').props['aria-expanded']).toBe(false);
});
