import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { FinanceAnalysisTable } from './FinanceAnalysis';
it('renders every category as a column, annual totals first, and distinct income and expenses', () => {
 const html = renderToStaticMarkup(<FinanceAnalysisTable data={{year:2026,currentMonth:'2026-02',categories:[{id:'a',name:'Обща',color:null},{id:'b',name:'Без записи',color:null}],rows:[
  {key:'year',label:'Текуща година',values:[{categoryId:'a',kind:'revenue',currency:'EUR',amount:'150.00'},{categoryId:'a',kind:'expense',currency:'EUR',amount:'35.00'}]},
  {key:'2026-02',label:'февруари 2026 г.',values:[]},
  {key:'2026-01',label:'януари 2026 г.',values:[]},
 ]}} />);
 expect(html).toContain('<th scope="col">Обща</th><th scope="col">Без записи</th>');
 expect(html).toContain('Текуща година');
 expect(html.indexOf('Текуща година')).toBeLessThan(html.indexOf('февруари 2026 г.'));
 expect(html.indexOf('февруари 2026 г.')).toBeLessThan(html.indexOf('януари 2026 г.'));
 expect(html).toContain('>Приход</th>');
 expect(html).toContain('>Разход</th>');
 expect(html).toContain('115,00');
 expect(html).toContain('150,00');
 expect(html).toContain('35,00');
 expect(html).toContain('0,00');
 expect(html).toContain('февруари 2026 г. (Общо)');
 expect(html).toContain('tabindex="0"');
});

it('shows net revenue minus expenses followed by income and expense rows, keeping currencies separate', () => {
 const html = renderToStaticMarkup(<FinanceAnalysisTable data={{year:2026,currentMonth:'2026-10',categories:[{id:'a',name:'Обща',color:null}],rows:[
  {key:'2026-10',label:'октомври 2026 г.',values:[{categoryId:'a',kind:'expense',currency:'EUR',amount:'14044.41'},{categoryId:'a',kind:'revenue',currency:'USD',amount:'0.30'},{categoryId:'a',kind:'expense',currency:'USD',amount:'0.10'}]},
 ]}} />);
 const rows = html.split('<tbody')[1].split('<tr').slice(1);
 expect(rows).toHaveLength(3);
 const plain = (value: string) => value.replace(/<[^>]*>/g,'').replace(/\s|&nbsp;/g,'');
 expect(rows[0]).toContain('октомври 2026 г. (Общо)');
 expect(plain(rows[0])).toContain('-14044,41');
 expect(plain(rows[0])).toContain('0,20');
 expect(rows[1]).toContain('>Приход</th>');
 expect(plain(rows[1])).toContain('0,00');
 expect(plain(rows[1])).toContain('0,30');
 expect(rows[2]).toContain('>Разход</th>');
 expect(plain(rows[2])).toContain('14044,41');
 expect(plain(rows[2])).toContain('0,10');
});
