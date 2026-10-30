import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const css = readFileSync(new URL('./FinanceDashboard.module.css', import.meta.url), 'utf8');

it('removes rectangular focus outlines from chart segments while highlighting keyboard focus with stroke width', () => {
 expect(css).toMatch(/\.chartView \.chartSegment:focus\s*\{[^}]*outline:none;/);
 expect(css).toMatch(/\.chartView \.chartSegment:focus-visible\s*\{[^}]*stroke-width:17;/);
});

it('reserves the debts overlap space beside the expense chart on desktop', () => {
 expect(css).toMatch(/@media\(min-width:1101px\)\s*\{\s*\.chartView\s*\{[^}]*padding-right:108px;/);
});

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

it('keeps analysis summary cards at their own height when the action column grows', () => {
 expect(css).toMatch(/\.dashboard\[data-view="analysis"\] \.cards>\.card\s*\{[^}]*align-self:start;/);
});

it('blurs the viewport behind the blue editing form and keeps the form above it', () => {
 expect(css).toMatch(/\.editBackdrop\s*\{[^}]*position:fixed;[^}]*inset:0;[^}]*z-index:1000;[^}]*backdrop-filter:blur\(5px\);/);
 expect(css).toMatch(/\.dashboard \.expenseForm\.editingForm\s*\{[^}]*z-index:1001;[^}]*border-color:#62aaff;[^}]*background:linear-gradient\(145deg,#172e49,#101c2e\);/);
});

it('contains desktop category scrolling inside the list rather than the outer dialog', () => {
 const desktop = css.slice(css.indexOf('/* Desktop category scroll containment. */'));
 expect(desktop).toMatch(/\.categoriesDialog:not\(\.categoryConfirmation\)\s*\{[^}]*overflow:hidden;/);
 expect(desktop).toMatch(/\.categoriesDialog:not\(\.categoryConfirmation\)\[open\]\s*\{[^}]*display:flex;[^}]*flex-direction:column;/);
 expect(desktop).toMatch(/\.categoryList\s*\{[^}]*flex:1;[^}]*min-height:0;[^}]*max-height:none;[^}]*overflow-y:auto;/);
});

it('sizes the category editor to its content instead of stretching between mobile inset edges', () => {
 expect(css).toMatch(/\.categoriesDialog\.categoryEditor\s*\{[^}]*height:fit-content;[^}]*min-height:0;/);
});
