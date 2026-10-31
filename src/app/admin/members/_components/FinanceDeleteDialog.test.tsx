import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import FinanceDeleteDialog from './FinanceDeleteDialog';

it.each(['expense','revenue'] as const)('shows the complete %s entry before deletion', kind => {
 const description = 'Първи ред\n' + 'Пълно описание на записа. '.repeat(60);
 const html = renderToStaticMarkup(<FinanceDeleteDialog entry={{id:'entry',categoryId:'category',category:'Екипировка',kind,amount:'125.50',currency:'EUR',date:'2026-10-30',description,playerName:'Иван Петров',editable:true,deletable:true}} saving={false} error="" onClose={vi.fn()} onConfirm={vi.fn()} />);
 expect(html).toContain('<dialog');
 expect(html).toContain('aria-labelledby=');
 expect(html).toContain(description);
 expect(html).toContain('125,50');
 expect(html).toContain('30.10.2026');
 expect(html).toContain('Екипировка');
 expect(html).toContain('Иван Петров');
 expect(html).toContain(kind === 'revenue' ? 'Изтрий прихода' : 'Изтрий разхода');
});
it('shows missing description and disables dismissal and confirmation while deleting', () => {
 const html = renderToStaticMarkup(<FinanceDeleteDialog entry={{id:'entry',categoryId:'category',category:'Други',kind:'expense',amount:'1.00',currency:'EUR',date:'2026-10-30',description:null,playerName:null,editable:true,deletable:true}} saving error="Грешка" onClose={vi.fn()} onConfirm={vi.fn()} />);
 expect(html).toContain('Няма добавено описание.');
 expect(html).toContain('role="alert"');
 expect(html.match(/disabled=""/g)).toHaveLength(3);
});
