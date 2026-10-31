import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ClubFinancePanel from './ClubFinancePanel';

it('checks entitlement before loading financial totals', () => {
 const html = renderToStaticMarkup(<ClubFinancePanel clubId="club-a" compact />);
 expect(html).not.toContain('Финансов преглед');
 expect(html).not.toContain('Обобщение за клуба');
 expect(html).not.toContain('Проверка на достъпа');
 expect(html).toContain('Баланс');expect(html).toContain('Задължения');
 expect(html).toContain('Виж финансите');
 expect(html).not.toContain('0,00');
 expect(html).toContain('aria-busy="true"');expect(html).toContain('Зареждане на финансите');
 expect(html).not.toContain('🔒');expect(html).not.toContain('Балансът е заключен');
});
