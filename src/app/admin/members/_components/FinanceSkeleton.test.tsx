import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import FinanceSkeleton from './FinanceSkeleton';

it.each(['history','analysis','debts','chart','profile','form','categoryChips','categories'] as const)('renders an accessible %s skeleton without fake data or visible loading text', variant => {
 const html = renderToStaticMarkup(<FinanceSkeleton variant={variant} />);
 expect(html).toContain('role="status"');
 expect(html).toContain('aria-busy="true"');
 expect(html).toContain('aria-hidden="true"');
 expect(html).not.toContain('0,00');
 expect(html).not.toContain('Зареждане…');
 expect(html).not.toContain('<svg');
});
