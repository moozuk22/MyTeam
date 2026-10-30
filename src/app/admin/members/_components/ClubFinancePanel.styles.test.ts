import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('layers the period dropdown above the analysis action buttons', () => {
 const panel = readFileSync(new URL('./ClubFinancePanel.module.css',import.meta.url),'utf8');
 const dashboard = readFileSync(new URL('./FinanceDashboard.module.css',import.meta.url),'utf8');
 const dropdownLayer = Number(panel.match(/\.rangeControls\s*\{[^}]*z-index:(\d+)/)?.[1]);
 const actionLayer = Number(dashboard.match(/\.dashboard\[data-view="analysis"\] \.analysisActions\s*\{[^}]*z-index:(\d+)/)?.[1]);
 expect(dropdownLayer).toBeGreaterThan(actionLayer);
});
