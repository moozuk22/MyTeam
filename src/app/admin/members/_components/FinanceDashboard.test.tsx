import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { getClubFinance } from '@/lib/clubFinance';
import FinanceDashboard from './FinanceDashboard';
type View = Awaited<ReturnType<typeof getClubFinance>>;
const base: View = {
 month:'all',page:1,count:0,startedAt:'2026-10-01T00:00:00Z',categories:[],entries:[],subtotals:[],
 totals:[{currency:'EUR',revenue:'900.00',expense:'200.00',balance:'700.00'}],
 outstanding:'300.00',debts:[],incomplete:false,
};
it('uses the selected report for income and expenses while preserving all-time balance and debt', () => {
 const report = {...base,month:'2026-10',totals:[{currency:'EUR',revenue:'120.00',expense:'40.00',balance:'80.00'}]};
 const html = renderToStaticMarkup(<FinanceDashboard clubId="club" data={base} report={report} month="2026-10" filters={<span>Filters</span>} onSaved={vi.fn()} />);
 expect(html).toContain('120,00');
 expect(html).toContain('40,00');
 expect(html).toContain('700,00');
 expect(html).toContain('300,00');
 expect(html).not.toContain('900,00');
 expect(html).not.toContain('80,00');
 expect(html).toContain('Добави разход');
 expect(html).toContain('Добави приход');
});
it('renders placeholders without invented amounts before financial data arrives', () => {
 const html = renderToStaticMarkup(<FinanceDashboard clubId="club" data={null} report={null} month="all" filters={null} onSaved={vi.fn()} />);
 expect(html).toContain('Зареждане');
 expect(html).not.toContain('<strong>0,00');
});
it('retains four summary cards, a compact category filter, and readable debt periods', () => {
 const data: View = {...base,
  categories:[{id:'category',clubId:'club',name:'Транспорт',kind:'expense',isMembership:false,sortOrder:0,isActive:true}],
  subtotals:[{categoryId:'category',currency:'EUR',amount:'35.00'}],
  debts:[{avatarUrl:'https://example.com/player.jpg',id:'player',name:'Иван Петров',periods:['2026-10','Подновяване'],amount:'300.00',fee:'150',conflict:false}],
 };
 const html = renderToStaticMarkup(<FinanceDashboard clubId="club" clubName="Тестов клуб" clubLogoUrl="https://example.com/club.png" data={data} report={data} month="all" filters={null} onSaved={vi.fn()} />);
 for(const label of ['Приходи','Разходи','Баланс','Задължения към клуба']) expect(html).toContain(`<h2>${label}</h2>`);
 expect(html).toContain('id="finance-expense-category"');
 expect(html).toContain('Всички категории');
 expect(html).toContain('октомври 2026');
 expect(html).toContain('Подновяване');
 expect(html).toContain('35,00');
 expect(html).toContain('Тестов клуб');
 expect(html).toContain('src="https://example.com/club.png"');
 expect(html).toContain('src="https://example.com/player.jpg"');
 expect(html).toContain('aria-label="Детайли за Иван Петров"');
 expect(html).toMatch(/<li><button type="button"[^>]*aria-label="Детайли за Иван Петров"/);
 expect(html).toContain('data-category-id="category"');
 expect(html).toContain('Плъзнете за подреждане');
 expect(html).toContain('Премести Транспорт нагоре');
 expect(html).toContain('Премести Транспорт надолу');
});

it('selects all transactions by default', () => {
 const html = renderToStaticMarkup(<FinanceDashboard clubId="club" data={base} report={base} month="all" filters={null} onSaved={vi.fn()} />);
 expect(html).toContain('aria-pressed="true">Всички</button>');
 expect(html).toContain('aria-pressed="false">Разходи</button>');
 expect(html).toContain('aria-pressed="false">Приходи</button>');
 expect(html).toContain('Всички записи');
});

it('keeps inactive categories manageable but hides them from new entry options', () => {
 const data: View = {...base,categories:[{id:'inactive',clubId:'club',name:'Стара категория',kind:'expense',isMembership:false,sortOrder:0,isActive:false}]};
 const html = renderToStaticMarkup(<FinanceDashboard clubId="club" data={data} report={data} month="all" filters={null} onSaved={vi.fn()} />);
 expect(html).toContain('Стара категория');
 expect(html).toContain('Неактивна');
 expect(html).toContain('Покажи Стара категория');
 const form = html.split('Изберете категория</option>')[1].split('</select>')[0];
 expect(form).not.toContain('value="inactive"');
 expect(html).toContain('id="category-status-title"');
});

it('labels range reports without changing the overall balance', () => {
 const report = {...base,month:'2026-03..2026-10',totals:[{currency:'EUR',revenue:'120.00',expense:'40.00',balance:'80.00'}]};
 const html = renderToStaticMarkup(<FinanceDashboard clubId="club" data={base} report={report} month={report.month} filters={<span>Filters</span>} onSaved={vi.fn()} />);
 expect(html).toContain('март 2026 г. – октомври 2026 г.');
 expect(html).toContain('120,00');
 expect(html).toContain('40,00');
 expect(html).toContain('700,00');
});

it('disables the selected category filter while keeping other categories available', () => {
 const data: View = {...base,categories:[{id:'category',clubId:'club',name:'Транспорт',kind:'expense',isMembership:false,sortOrder:0,isActive:true}]};
 const html = renderToStaticMarkup(<FinanceDashboard clubId="club" data={data} report={data} month="all" filters={null} onSaved={vi.fn()} />);
 const chips = html.split('aria-label="Филтрирай разходите по категория">')[1].split('</div>')[0];
 expect(chips).toMatch(/<button[^>]*disabled=""[^>]*>Всички<\/button>/);
 expect(chips).toMatch(/<button type="button" aria-pressed="false">Транспорт<\/button>/);
});

it('opens History by default and provides an empty Analysis view', () => {
 const html = renderToStaticMarkup(<FinanceDashboard clubId="club" data={base} report={base} month="all" filters={null} onSaved={vi.fn()} />);
 expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*disabled=""[^>]*>.*?История<\/button>/);
 expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*>.*?Анализ<\/button>/);
 expect(html).toMatch(/<div[^>]*hidden=""[^>]*role="region" aria-label="Анализ"><\/div>/);
 expect(html).toMatch(/role="region" aria-label="История"><header/);
});
