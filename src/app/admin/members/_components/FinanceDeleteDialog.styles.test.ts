import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('centers the delete dialog in the viewport despite the global margin reset', () => {
 const css = readFileSync(new URL('./FinanceDeleteDialog.module.css',import.meta.url),'utf8');
 const rule = css.match(/\.dialog\s*\{([^}]+)\}/)?.[1];
 expect(rule).toContain('position:fixed;');
 expect(rule).toContain('inset:0;');
 expect(rule).toContain('margin:auto;');
 expect(rule).toContain('max-height:calc(100dvh - 48px);');
});
