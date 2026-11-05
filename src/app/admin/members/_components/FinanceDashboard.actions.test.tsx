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
import FinanceDebtsDialog from './FinanceDebtsDialog';
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
beforeEach(()=>{hooks.values=[];hooks.cursor=0;vi.stubGlobal('requestAnimationFrame',vi.fn());vi.stubGlobal('window',{matchMedia:vi.fn(()=>({matches:true}))});});
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
 const modal = nodes(tree).find(node => node.type === 'dialog' && node.props['aria-labelledby'] === 'finance-entry-edit-title');
 expect(modal).toBeDefined();
 expect(nodes(modal).filter(node => node.type === 'form')).toHaveLength(1);
 expect(vi.mocked(requestAnimationFrame)).not.toHaveBeenCalled();
 expect(nodes(tree).some(node=>node.type==='h2' && text(node)==='Редактирай разход')).toBe(true);
 expect(nodes(tree).some(node=>node.type==='textarea' && node.props.value==='Описание')).toBe(true);
 const form = nodes(tree).find(node=>node.type==='form' && text(node).includes('Редактирай разход'))!;
 const cancel = nodes(form).find(node=>node.type==='button' && text(node)==='Отказ')!;
 click(cancel);
 tree = render();
 expect(tree.props['data-editing']).toBe(false);
 expect(nodes(tree).some(node=>node.type==='h2' && text(node)==='Добави разход')).toBe(true);
});

it('keeps desktop editing inline and scrolls to the form', () => {
 vi.stubGlobal('window',{matchMedia:vi.fn(()=>({matches:false}))});
 render();
 hooks.values[6] = {...data,count:1,entries:[{id:'entry',categoryId:'category',category:'Други',kind:'expense',amount:'25.00',currency:'EUR',date:'2026-10-30',description:'Описание',playerName:null,editable:true,deletable:true}]};
 let tree = render();
 const edit = nodes(tree).find(node => node.type === 'button' && text(node) === 'Редактирай')!;
 (edit.props.onClick as (event:unknown)=>void)({currentTarget:{closest:()=>({removeAttribute:vi.fn()})}});
 tree = render();
 expect(nodes(tree).some(node => node.type === 'dialog' && node.props['aria-labelledby'] === 'finance-entry-edit-title')).toBe(false);
 const sidebar = nodes(tree).find(node => node.type === 'aside' && String(node.props.className).includes('sidebar'))!;
 expect(text(sidebar)).toContain('Редактирай разход');
 expect(requestAnimationFrame).toHaveBeenCalledOnce();
});

it('keeps the row menu open during a touch blur so Edit can receive its click', () => {
 render();
 hooks.values[6] = {...data,count:1,entries:[{id:'entry',categoryId:'category',category:'Други',kind:'expense',amount:'25.00',currency:'EUR',date:'2026-10-30',description:'Описание',playerName:null,editable:true,deletable:true}]};
 let tree = render();
 const menu = nodes(tree).find(node => node.type === 'details' && String(node.props.className).includes('rowMenu'))!;
 const element = {open:true,contains:vi.fn(() => false)};
 // Touch browsers may blur the summary with no relatedTarget before dispatching click.
 (menu.props.onBlur as (event:unknown)=>void)({currentTarget:element,relatedTarget:null});
 expect(element.open).toBe(true);
 const edit = nodes(menu).find(node => node.type === 'button' && text(node) === 'Редактирай')!;
 (edit.props.onClick as (event:unknown)=>void)({currentTarget:{closest:()=>({removeAttribute:vi.fn()})}});
 tree = render();
 const form = nodes(tree).find(node => node.type === 'form')!;
 expect(text(form)).toContain('Редактирай разход');
 expect(String(form.props.className)).not.toContain('mobileFormClosed');
 expect(nodes(form).some(node => node.type === 'textarea' && node.props.value === 'Описание')).toBe(true);
 // Keyboard navigation to a known element outside the menu still dismisses it.
 (menu.props.onBlur as (event:unknown)=>void)({currentTarget:element,relatedTarget:{}});
 expect(element.open).toBe(false);
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

it('hides colors used by other categories when creating or editing', () => {
 const coloredData={...data,categories:[{id:'one',clubId:'club',name:'First',color:'#E53935',sortOrder:0,expenseSortOrder:0,revenueSortOrder:0,isActive:true,hiddenForExpense:false,hiddenForRevenue:false,isMembership:false},{id:'two',clubId:'club',name:'Second',color:'#1E88E5',sortOrder:1,expenseSortOrder:1,revenueSortOrder:1,isActive:true,hiddenForExpense:false,hiddenForRevenue:false,isMembership:false}]};
 const draw=()=>{hooks.cursor=0;return FinanceDashboard({clubId:'club',data:coloredData,report:coloredData,month:'all',filters:null,onSaved:vi.fn()});};
 let tree=draw();
 click(nodes(tree).find(node => node.type === 'button' && text(node).includes('Нова категория'))!);tree=draw();
 expect(nodes(tree).some(node => node.props['aria-label'] === 'Цвят #E53935')).toBe(false);
 expect(nodes(tree).some(node => node.props['aria-label'] === 'Цвят #1E88E5')).toBe(false);
 expect(nodes(tree).some(node => node.props['aria-label'] === 'Цвят #43A047')).toBe(true);
 click(nodes(tree).find(node => node.props['aria-label'] === 'Преименувай First')!);tree=draw();
 expect(nodes(tree).some(node => node.props['aria-label'] === 'Цвят #E53935' && node.props['aria-pressed'] === true)).toBe(true);
 expect(nodes(tree).some(node => node.props['aria-label'] === 'Цвят #1E88E5')).toBe(false);
});

it('opens the expense chart in the report area and switches back to History', () => {
 let tree=render();
 click(action(tree,'-chart'));tree=render();
 expect(tree.props['data-view']).toBe('chart');
 expect(nodes(tree).find(node => node.props.id === 'finance-chart')?.props.hidden).toBe(false);
 expect(nodes(tree).find(node => node.props.id === 'finance-history')?.props.hidden).toBe(true);
 expect(action(tree,'-chart').props.disabled).toBe(true);
 click(action(tree,'-history'));tree=render();
 expect(nodes(tree).find(node => node.props.id === 'finance-chart')?.props.hidden).toBe(true);
 expect(nodes(tree).find(node => node.props.id === 'finance-history')?.props.hidden).toBe(false);
});

it('selects chart segments, dims other categories, and clears selection from the legend', () => {
 const chartData={...data,categories:[{id:'one',clubId:'club',name:'First',color:'#E53935',sortOrder:0,expenseSortOrder:0,revenueSortOrder:0,isActive:true,hiddenForExpense:false,hiddenForRevenue:false,isMembership:false},{id:'two',clubId:'club',name:'Second',color:'#1E88E5',sortOrder:1,expenseSortOrder:1,revenueSortOrder:1,isActive:true,hiddenForExpense:false,hiddenForRevenue:false,isMembership:false}],totals:[{currency:'EUR',revenue:'0',expense:'100',balance:'-100'}],subtotals:[{categoryId:'one',currency:'EUR',kind:'expense' as const,amount:'25'},{categoryId:'two',currency:'EUR',kind:'expense' as const,amount:'75'}]};
 const draw=()=>{hooks.cursor=0;return FinanceDashboard({clubId:'club',data:chartData,report:chartData,month:'all',filters:null,onSaved:vi.fn()});};
 let tree=draw();
 const segments=()=>nodes(tree).filter(node=>node.type==='circle' && node.props.role==='button');
 expect(segments().map(node=>node.props.strokeDasharray)).toEqual(['75 25','25 75']);
 expect(segments()[0].props['aria-label']).toContain('Second');
 click(segments()[1]);tree=draw();
 expect(segments()[1].props['aria-pressed']).toBe(true);
 expect(segments()[0].props['data-dimmed']).toBe(true);
 const legend=nodes(tree).find(node=>node.type==='ul' && nodes(node).some(child=>text(child).includes('First')))!;
 const first=nodes(legend).find(node=>node.type==='button' && text(node).includes('First'))!;
 expect(first.props['aria-pressed']).toBe(true);
 click(first);tree=draw();
 expect(segments().every(node=>node.props['aria-pressed']===false && node.props['data-dimmed']===false)).toBe(true);
});

it('opens both mobile entry actions and expands debts from its summary card', () => {
 let tree=render();
 const mobile=()=>nodes(tree).find(node=>node.type==='div' && String(node.props.className).includes('mobileEntryActions'))!;
 click(nodes(mobile()).find(node=>node.type==='button' && text(node)==='Приход')!);tree=render();
 expect(nodes(tree).some(node=>node.type==='h2' && text(node)==='Добави приход')).toBe(true);
 click(nodes(mobile()).find(node=>node.type==='button' && text(node)==='Разход')!);tree=render();
 expect(nodes(tree).some(node=>node.type==='h2' && text(node)==='Добави разход')).toBe(true);
 const debt=()=>nodes(tree).find(node=>node.props['aria-label']==='Покажи задълженията към клуба')!;
 click(debt());tree=render();
 expect(debt().props['aria-expanded']).toBe(true);
 expect(nodes(tree).find(node=>node.type==='section' && node.props['data-mobile-open']===true)).toBeDefined();
});

it('keeps Analysis selected when mobile expense and income actions open their forms', () => {
 let tree=render();
 click(action(tree,'-analysis'));tree=render();
 const mobileButton=(name:string)=>nodes(nodes(tree).find(node=>node.type==='div' && String(node.props.className).includes('mobileEntryActions'))).find(node=>node.type==='button' && text(node)===name)!;
 click(mobileButton('Разход'));tree=render();
 expect(tree.props['data-view']).toBe('analysis');
 expect(nodes(tree).find(node=>node.type==='form')?.props['data-mobile-inline']).toBe(true);
 expect(mobileButton('Разход').props['aria-expanded']).toBe(true);
 expect(nodes(tree).some(node=>node.type==='h2' && text(node)==='Добави разход')).toBe(true);
 click(mobileButton('Приход'));tree=render();
 expect(tree.props['data-view']).toBe('analysis');
 expect(mobileButton('Приход').props['aria-expanded']).toBe(true);
 expect(nodes(tree).some(node=>node.type==='h2' && text(node)==='Добави приход')).toBe(true);
 click(mobileButton('Приход'));tree=render();
 expect(mobileButton('Приход').props['aria-expanded']).toBe(false);
});

it('preserves the open mobile income draft when switching to Analysis', () => {
 let tree=render();
 const mobile=nodes(tree).find(node=>node.type==='div' && String(node.props.className).includes('mobileEntryActions'))!;
 click(nodes(mobile).find(node=>node.type==='button' && text(node)==='Приход')!);tree=render();
 const amount=nodes(tree).find(node=>node.type==='input' && node.props.inputMode==='decimal')!;
 (amount.props.onChange as (event:unknown)=>void)({target:{value:'125'}});tree=render();
 click(action(tree,'-analysis'));tree=render();
 expect(tree.props['data-view']).toBe('analysis');
 expect(nodes(tree).find(node=>node.type==='form')?.props['data-mobile-inline']).toBe(true);
 const forms=nodes(tree).filter(node=>node.type==='form');
 expect(forms).toHaveLength(1);
 expect(text(forms[0])).toContain('Добави приход');
 expect(nodes(forms[0]).some(node=>node.type==='input' && node.props.value==='125')).toBe(true);
});

it('disables entry submission after calculator access expires',()=>{
 let tree=render();click(action(tree,'-analysis'));tree=render();click(action(tree,'-revenue-dropdown'));
 hooks.cursor=0;
 tree=FinanceDashboard({clubId:'club',calculatorEnabled:false,calculatorCanView:true,data,report:data,month:'all',filters:null,onSaved:vi.fn()});
 const submit=nodes(tree).find(node=>node.type==='button' && node.props.type==='submit' && text(node).includes('Запази прихода'))!;
 expect(submit.props.disabled).toBe(true);
});

it('disables creating a category while calculator access is inactive',()=>{
 hooks.cursor=0;
 const tree=FinanceDashboard({clubId:'club',calculatorEnabled:false,data,report:data,month:'all',filters:null,onSaved:vi.fn()});
 const button=nodes(tree).find(node=>node.type==='button' && text(node)==='Нова категория')!;
 expect(button.props.disabled).toBe(true);
});

it('keeps categories readable but disables editing, hiding and reordering while inactive',()=>{
 hooks.cursor=0;
 const category={id:'category',clubId:'club',name:'Транспорт',color:null,isMembership:false,isActive:true,hiddenForExpense:false,hiddenForRevenue:false,sortOrder:0,expenseSortOrder:0,revenueSortOrder:0};
 const view={...data,categories:[category]};
 const tree=FinanceDashboard({clubId:'club',calculatorEnabled:false,data:view,report:view,month:'all',filters:null,onSaved:vi.fn()});
 for(const label of ['Преименувай Транспорт','Скрий Транспорт','Премести Транспорт надолу']) {
  expect(nodes(tree).find(node=>node.type==='button' && node.props['aria-label']===label)?.props.disabled).toBe(true);
 }
});

it('opens a searchable modal instead of expanding the preview and sorts players alphabetically',()=>{
 const names=['Яна','Галя','Борис','Даниел','Анна','Вера'];
 const view={...data,debts:names.map((name,index)=>({...data.debts[0],id:String(index),name}))};
 const draw=()=>{hooks.cursor=0;return FinanceDashboard({clubId:'club',data:view,report:view,month:'all',filters:null,onSaved:vi.fn()});};
 let tree=draw();
 const labels=nodes(tree).filter(node=>node.type==='button'&&String(node.props['aria-label']).startsWith('Детайли за ')).map(node=>node.props['aria-label']);
 expect(labels).toEqual(['Детайли за Анна','Детайли за Борис','Детайли за Вера','Детайли за Галя','Детайли за Даниел']);
 click(nodes(tree).find(node=>node.type==='button'&&text(node)==='Виж всички 6 състезатели →')!);
 tree=draw();
 const modal=nodes(tree).find(node=>node.type===FinanceDebtsDialog)!;
 expect(modal).toBeDefined();
 expect((modal.props.debts as typeof view.debts).map(debt=>debt.name)).toEqual(['Анна','Борис','Вера','Галя','Даниел','Яна']);
 expect(view.debts.map(debt=>debt.name)).toEqual(names);
 // Selecting a modal row closes it before opening the existing player detail overlay.
 const row=(modal.props.renderDebt as (debt:typeof view.debts[number])=>Node)(view.debts[0]);
 click(nodes(row).find(node=>node.type==='button')!);
 tree=draw();
 expect(nodes(tree).some(node=>node.type===FinanceDebtsDialog)).toBe(false);
 expect(nodes(tree).some(node=>node.props.playerId==='0')).toBe(true);
});

it.each(['expense','revenue'] as const)('hides and shows directly for the selected category kind: %s', async kind => {
 const category={id:'category',clubId:'club',name:'Транспорт',color:null,isMembership:false,isActive:true,hiddenForExpense:false,hiddenForRevenue:false,sortOrder:0,expenseSortOrder:0,revenueSortOrder:0};
 const view={...data,categories:[category]};
 const request=vi.fn().mockResolvedValue({ok:true,json:async()=>({ok:true})});
 vi.stubGlobal('fetch',request);
 const saved=vi.fn(async()=>{
  const payload=JSON.parse(request.mock.calls.at(-1)![1].body);
  if (payload.kind==='expense') category.hiddenForExpense=payload.hidden;
  else category.hiddenForRevenue=payload.hidden;
  category.isActive=!(category.hiddenForExpense && category.hiddenForRevenue);
 });
 const draw=()=>{hooks.cursor=0;return FinanceDashboard({clubId:'club',data:view,report:view,month:'all',filters:null,onSaved:saved});};
 let tree=draw();
 const kinds=nodes(tree).find(node=>node.props['aria-label']==='Вид категории')!;
 expect(nodes(kinds).filter(node=>node.type==='button').map(text)).toEqual(['Разходи','Приходи']);
 click(nodes(kinds).find(node=>node.type==='button' && text(node)===(kind==='expense'?'Разходи':'Приходи'))!);tree=draw();
 click(nodes(tree).find(node=>node.props['aria-label']==='Скрий Транспорт')!);
 await vi.waitFor(()=>expect(saved).toHaveBeenCalledOnce());tree=draw();
 expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({action:'setCategoryKindVisibility',id:'category',kind,hidden:true});
 expect(nodes(tree).some(node=>node.type==='input' && node.props.type==='radio')).toBe(false);
 expect(kind==='expense'?category.hiddenForRevenue:category.hiddenForExpense).toBe(false);
 click(nodes(tree).find(node=>node.props['aria-label']==='Покажи Транспорт')!);
 await vi.waitFor(()=>expect(saved).toHaveBeenCalledTimes(2));
 expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({action:'setCategoryKindVisibility',id:'category',kind,hidden:false});
});

it('offers categories by entry kind and preselects an available category', () => {
 const view={...data,categories:[
  {id:'income',clubId:'club',name:'Само приходи',color:null,isMembership:false,isActive:true,hiddenForExpense:true,hiddenForRevenue:false,sortOrder:0,expenseSortOrder:0,revenueSortOrder:0},
  {id:'expense',clubId:'club',name:'Само разходи',color:null,isMembership:false,isActive:true,hiddenForExpense:false,hiddenForRevenue:true,sortOrder:1,expenseSortOrder:1,revenueSortOrder:1},
 ]};
 const draw=()=>{hooks.cursor=0;return FinanceDashboard({clubId:'club',data:view,report:view,month:'all',filters:null,onSaved:vi.fn()});};
 let tree=draw();
 const mobile=(label:string)=>nodes(nodes(tree).find(node=>String(node.props.className).includes('mobileEntryActions'))).find(node=>node.type==='button' && text(node)===label)!;
 click(mobile('Разход'));tree=draw();
 const select=()=>nodes(tree).find(node=>node.type==='select' && nodes(node).some(option=>option.props.value==='expense' || option.props.value==='income'))!;
 expect(select().props.value).toBe('expense');
 expect(nodes(select()).some(node=>node.type==='option' && node.props.value==='income')).toBe(false);
 click(mobile('Приход'));tree=draw();
 expect(select().props.value).toBe('income');
 expect(nodes(select()).some(node=>node.type==='option' && node.props.value==='expense')).toBe(false);
});

it.each(['expense','revenue'])('only clears the expense draft category when hidden for its kind (%s)', async kind => {
 const category={id:'category',clubId:'club',name:'Транспорт',color:null,isMembership:false,isActive:true,hiddenForExpense:false,hiddenForRevenue:false,sortOrder:0,expenseSortOrder:0,revenueSortOrder:0};
 const view={...data,categories:[category]};
 const saved=vi.fn().mockResolvedValue(undefined);
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({ok:true})}));
 const draw=()=>{hooks.cursor=0;return FinanceDashboard({clubId:'club',data:view,report:view,month:'all',filters:null,onSaved:saved});};
 let tree=draw();
 const select=nodes(tree).find(node=>node.type==='select' && nodes(node).some(option=>option.type==='option' && text(option)==='Изберете категория'))!;
 (select.props.onChange as (event:unknown)=>void)({target:{value:'category'}});tree=draw();
 const kinds=nodes(tree).find(node=>node.props['aria-label']==='Вид категории')!;
 click(nodes(kinds).find(node=>node.type==='button' && text(node)===(kind==='expense'?'Разходи':'Приходи'))!);tree=draw();
 click(nodes(tree).find(node=>node.props['aria-label']==='Скрий Транспорт')!);
 await vi.waitFor(()=>expect(saved).toHaveBeenCalledOnce());tree=draw();
 const updated=nodes(tree).find(node=>node.type==='select' && nodes(node).some(option=>option.type==='option' && text(option)==='Изберете категория'))!;
 expect(updated.props.value).toBe(kind==='expense'?'':'category');
});

it('filters active and hidden categories within the selected transaction kind',()=>{
 const view={...data,categories:[
  {id:'expense-hidden',clubId:'club',name:'A',color:null,isMembership:false,isActive:true,hiddenForExpense:true,hiddenForRevenue:false,sortOrder:0,expenseSortOrder:0,revenueSortOrder:0},
  {id:'revenue-hidden',clubId:'club',name:'B',color:null,isMembership:false,isActive:true,hiddenForExpense:false,hiddenForRevenue:true,sortOrder:1,expenseSortOrder:1,revenueSortOrder:1},
 ]};
 const draw=()=>{hooks.cursor=0;return FinanceDashboard({clubId:'club',data:view,report:view,month:'all',filters:null,onSaved:vi.fn()});};
 let tree=draw();
 const press=(group:string,label:string)=>click(nodes(nodes(tree).find(node=>node.props['aria-label']===group)).find(node=>node.type==='button' && text(node)===label)!);
 const rows=()=>nodes(tree).filter(node=>node.type==='li' && node.props['data-category-id']).map(node=>node.props['data-category-id']);
 press('Филтрирай категориите по видимост','Активни');tree=draw();
 expect(rows()).toEqual(['revenue-hidden']);
 press('Вид категории','Приходи');tree=draw();
 expect(rows()).toEqual(['expense-hidden']);
 press('Филтрирай категориите по видимост','Скрити');tree=draw();
 expect(rows()).toEqual(['revenue-hidden']);
 expect(nodes(tree).some(node=>node.props['aria-label']==='Покажи B')).toBe(true);
});

it('shows and reorders independent expense and revenue category lists',async()=>{
 const view={...data,categories:[
  {id:'a',clubId:'club',name:'A',color:null,isMembership:false,isActive:true,hiddenForExpense:false,hiddenForRevenue:false,sortOrder:0,expenseSortOrder:1,revenueSortOrder:0},
  {id:'b',clubId:'club',name:'B',color:null,isMembership:false,isActive:true,hiddenForExpense:false,hiddenForRevenue:false,sortOrder:1,expenseSortOrder:0,revenueSortOrder:1},
 ]};
 const request=vi.fn().mockResolvedValue({ok:true,json:async()=>({ok:true})});vi.stubGlobal('fetch',request);
 const saved=vi.fn(async()=>{
  const payload=JSON.parse(request.mock.calls.at(-1)![1].body);
  const field=payload.kind==='expense'?'expenseSortOrder':'revenueSortOrder';
  for(const [index,id] of payload.ids.entries()) view.categories.find(c=>c.id===id)![field]=index;
 });
 const draw=()=>{hooks.cursor=0;return FinanceDashboard({clubId:'club',data:view,report:view,month:'all',filters:null,onSaved:saved});};
 let tree=draw();
 const rows=()=>nodes(tree).filter(node=>node.type==='li' && node.props['data-category-id']).map(node=>node.props['data-category-id']);
 expect(rows()).toEqual(['b','a']);
 click(nodes(tree).find(node=>node.props['aria-label']==='Премести A нагоре')!);
 await vi.waitFor(()=>expect(saved).toHaveBeenCalledOnce());tree=draw();
 expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({action:'reorderCategoryKind',kind:'expense',ids:['a','b']});
 const kinds=nodes(tree).find(node=>node.props['aria-label']==='Вид категории')!;
 click(nodes(kinds).find(node=>node.type==='button' && text(node)==='Приходи')!);tree=draw();
 expect(rows()).toEqual(['a','b']);
 click(nodes(tree).find(node=>node.props['aria-label']==='Премести B нагоре')!);
 await vi.waitFor(()=>expect(saved).toHaveBeenCalledTimes(2));tree=draw();
 expect(rows()).toEqual(['b','a']);
 expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({action:'reorderCategoryKind',kind:'revenue',ids:['b','a']});
 const refreshedKinds=nodes(tree).find(node=>node.props['aria-label']==='Вид категории')!;
 click(nodes(refreshedKinds).find(node=>node.type==='button' && text(node)==='Разходи')!);tree=draw();
 expect(rows()).toEqual(['a','b']);
 const mobile=()=>nodes(tree).find(node=>String(node.props.className).includes('mobileEntryActions'))!;
 click(nodes(mobile()).find(node=>node.type==='button' && text(node)==='Разход')!);tree=draw();
 const options=()=>nodes(nodes(tree).find(node=>node.type==='form')).filter(node=>node.type==='option' && node.props.value).map(node=>node.props.value);
 expect(options()).toEqual(['a','b']);
 click(nodes(mobile()).find(node=>node.type==='button' && text(node)==='Приход')!);tree=draw();
 expect(options()).toEqual(['b','a']);
});

it.each(['both','expense','revenue'])('submits a new category with visibility %s',async visibility=>{
 const request=vi.fn().mockResolvedValue({ok:true,json:async()=>({ok:true})});vi.stubGlobal('fetch',request);
 let tree=render();
 click(nodes(tree).find(node=>node.type==='button' && text(node)==='Нова категория')!);tree=render();
 const editor=()=>nodes(tree).find(node=>node.type==='dialog' && node.props['aria-labelledby']==='finance-category-editor-title')!;
 const select=()=>nodes(editor()).find(node=>node.type==='select')!;
 expect(select().props.value).toBe('both');
 expect(nodes(select()).filter(node=>node.type==='option').map(node=>node.props.value)).toEqual(['both','expense','revenue']);
 (nodes(editor()).find(node=>node.type==='input')!.props.onChange as (event:unknown)=>void)({target:{value:'New category'}});tree=render();
 (select().props.onChange as (event:unknown)=>void)({target:{value:visibility}});tree=render();
 const form=nodes(editor()).find(node=>node.type==='form')!;
 (form.props.onSubmit as (event:unknown)=>void)({preventDefault:vi.fn()});
 await vi.waitFor(()=>expect(request).toHaveBeenCalledOnce());
 expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({action:'createCategory',name:'New category',color:null,visibility});
});

it('shows duplicate category errors only inside the creation modal and preserves the draft',async()=>{
 const request=vi.fn().mockResolvedValue({ok:false,json:async()=>({error:'Вече има категория с това име.'})});vi.stubGlobal('fetch',request);
 let tree=render();
 click(nodes(tree).find(node=>node.type==='button' && text(node)==='Нова категория')!);tree=render();
 const editor=()=>nodes(tree).find(node=>node.type==='dialog' && node.props['aria-labelledby']==='finance-category-editor-title')!;
 (nodes(editor()).find(node=>node.type==='input')!.props.onChange as (event:unknown)=>void)({target:{value:'Храна'}});tree=render();
 (nodes(editor()).find(node=>node.type==='form')!.props.onSubmit as (event:unknown)=>void)({preventDefault:vi.fn()});
 await vi.waitFor(()=>{
  tree=render();
  expect(nodes(editor()).some(node=>node.props.role==='alert' && text(node)==='Вече има категория с това име.')).toBe(true);
 });
 expect(nodes(tree).filter(node=>node.props.role==='alert')).toHaveLength(1);
 expect(nodes(editor()).find(node=>node.type==='input')?.props.value).toBe('Храна');
 click(nodes(editor()).find(node=>node.type==='button' && text(node)==='Отказ')!);tree=render();
 expect(nodes(tree).some(node=>node.props.role==='alert')).toBe(false);
 click(nodes(tree).find(node=>node.type==='button' && text(node)==='Нова категория')!);tree=render();
 expect(nodes(editor()).some(node=>node.props.role==='alert')).toBe(false);
});
