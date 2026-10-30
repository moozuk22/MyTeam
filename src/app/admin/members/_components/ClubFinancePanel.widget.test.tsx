import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ClubFinancePanel from './ClubFinancePanel';

it('shows the compact overview and finance link while totals load', () => {
 const html = renderToStaticMarkup(<ClubFinancePanel clubId="club-a" compact />);
 expect(html).not.toContain('Финансов преглед');
 expect(html).not.toContain('Обобщение за клуба');
 expect(html).toContain('Баланс');
 expect(html).toContain('Задължения');
 expect(html).toContain('href="/admin/clubs/club-a/finance"');
 expect(html).toContain('Виж финансите');
 expect(html).toContain('Зареждане на финансите');
 expect(html).not.toContain('0,00');
});
