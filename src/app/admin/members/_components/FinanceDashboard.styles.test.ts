import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const css = readFileSync(new URL('./FinanceDashboard.module.css', import.meta.url), 'utf8');

it('reserves arrow space after compact form padding and gives native options readable colors', () => {
 const compactPadding = css.indexOf('.dashboard .expenseForm :is(input,select,textarea)');
 const selectOverride = css.lastIndexOf('.dashboard .selectWrap select {');
 expect(selectOverride).toBeGreaterThan(compactPadding);
 expect(css.slice(selectOverride).split('}')[0]).toContain('padding-right:34px');
 expect(css).toMatch(/\.dashboard \.selectWrap option\s*\{[^}]*color:#eee;[^}]*background:#1b1c1b;/);
});

it('keeps the mobile dialog fixed while its category list scrolls', () => {
 const mobile = css.slice(css.indexOf('/* Keep mobile controls fixed'));
 expect(mobile).toMatch(/\.categoriesDialog\[open\]\s*\{[^}]*display:flex;[^}]*flex-direction:column;/);
 expect(mobile).toMatch(/\.categoriesDialog\s*\{[^}]*overflow:hidden;/);
 expect(mobile).toMatch(/\.categoriesDialog \.categoryList\s*\{[^}]*flex:1;[^}]*min-height:0;[^}]*overflow-y:auto;/);
});

it('locks page scrolling while the mobile categories modal is open', () => {
 expect(css).toContain(':global(html):has(.categoriesDialog[open])');
 expect(css).toContain(':global(body):has(.categoriesDialog[open])');
 expect(css).toMatch(/:global\(body\):has\(\.categoriesDialog\[open\]\)[^{]*\{[^}]*overflow:hidden;/);
});
