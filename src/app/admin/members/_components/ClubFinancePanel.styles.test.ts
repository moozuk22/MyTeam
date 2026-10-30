import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('layers the period dropdown above the analysis action buttons', () => {
 const panel = readFileSync(new URL('./ClubFinancePanel.module.css',import.meta.url),'utf8');
 const dashboard = readFileSync(new URL('./FinanceDashboard.module.css',import.meta.url),'utf8');
 const dropdownLayer = Number(panel.match(/\.rangeControls\s*\{[^}]*z-index:(\d+)/)?.[1]);
 const actionLayer = Number(dashboard.match(/\.dashboard\[data-view="analysis"\] \.analysisActions\s*\{[^}]*z-index:(\d+)/)?.[1]);
 expect(dropdownLayer).toBeGreaterThan(actionLayer);
});

it('stacks period fields on phones and constrains iOS native month controls', () => {
 const css=readFileSync(new URL('./ClubFinancePanel.module.css',import.meta.url),'utf8');
 expect(css).toMatch(/@media\(max-width:700px\)\s*\{\s*\.rangeControls\s*\{[^}]*grid-template-columns:minmax\(0,1fr\);/);
 expect(css).toContain('.rangeControls input::-webkit-date-and-time-value');
 expect(css).toMatch(/\.rangeControls input\s*\{[^}]*max-width:100%;[^}]*appearance:none;/);
});

it('keeps compact totals intact beside a fixed-size finance link', () => {
 const css=readFileSync(new URL('./ClubFinancePanel.module.css',import.meta.url),'utf8');
 expect(css).toMatch(/\.panel \.link\s*\{[^}]*flex:0 0 52px;/);
 expect(css).toMatch(/\.panel \.widgetMetrics strong\s*\{[^}]*white-space:nowrap;[^}]*overflow-wrap:normal;/);
});
