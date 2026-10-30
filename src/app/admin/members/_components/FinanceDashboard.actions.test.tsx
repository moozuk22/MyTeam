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

it('highlights the populated edit form and clears the effect when cancelled', () => {
 render();
 hooks.values[6] = {...data,count:1,entries:[{id:'entry',categoryId:'category',category:'Други',kind:'expense',amount:'25.00',currency:'EUR',date:'2026-10-30',description:'Описание',playerName:null,editable:true,deletable:true}]};
 let tree = render();
 const edit = nodes(tree).find(node => node.type === 'button' && text(node) === 'Редактирай')!;
 (edit.props.onClick as (event:unknown)=>void)({currentTarget:{closest:()=>({removeAttribute:vi.fn()})}});
 tree = render();
 expect(tree.props['data-editing']).toBe(true);
 expect(nodes(tree).some(node=>node.type==='h2' && text(node)==='Редактирай разход')).toBe(true);
 expect(nodes(tree).some(node=>node.type==='textarea' && node.props.value==='Описание')).toBe(true);
 const form = nodes(tree).find(node=>node.type==='form' && text(node).includes('Редактирай разход'))!;
 const cancel = nodes(form).find(node=>node.type==='button' && text(node)==='Отказ')!;
 click(cancel);
 tree = render();
 expect(tree.props['data-editing']).toBe(false);
 expect(nodes(tree).some(node=>node.type==='h2' && text(node)==='Добави разход')).toBe(true);
});

it('toggles category colors and persists the browser display preference without a request', () => {
 const storage = {getItem:vi.fn(),setItem:vi.fn()};
 vi.stubGlobal('localStorage',storage);
 const request=vi.fn();vi.stubGlobal('fetch',request);
 let tree=render();
 const toggle = (name:string) => nodes(tree).find(node => node.type === 'button' && text(node) === name)!;
 click(toggle('Изключи цветовете'));tree=render();
 expect(toggle('Включи цветовете')).toBeDefined();
 expect(storage.setItem).toHaveBeenLastCalledWith('finance-category-colors','hidden');
 click(toggle('Включи цветовете'));tree=render();
 expect(toggle('Изключи цветовете')).toBeDefined();
 expect(storage.setItem).toHaveBeenLastCalledWith('finance-category-colors','visible');
 expect(request).not.toHaveBeenCalled();
});

it('creates categories inside a separate labeled editor dialog', () => {
 let tree=render();
 const create = nodes(tree).find(node => node.type === 'button' && text(node).includes('Нова категория'))!;
 click(create);tree=render();
 const editor = nodes(tree).find(node => node.type === 'dialog' && node.props['aria-labelledby'] === 'finance-category-editor-title')!;
 expect(nodes(editor).some(node => node.type === 'form')).toBe(true);
 expect(text(editor)).toContain('Цвят (незадължително)');
 const manager = nodes(tree).find(node => node.type === 'dialog' && node.props['aria-labelledby'] === 'finance-categories-title')!;
 expect(nodes(manager).some(node => node.type === 'form')).toBe(false);
 const cancel = nodes(editor).find(node => node.type === 'button' && text(node) === 'Отказ')!;
 click(cancel);tree=render();
 expect(nodes(tree).find(node => node.type === 'dialog' && node.props['aria-labelledby'] === 'finance-category-editor-title')?.props.children).toBeDefined();
 expect(nodes(tree).filter(node => node.type === 'form')).toHaveLength(1); // Only the transaction form remains.
});
