import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FinancePanel } from './ClubFinancePanel';

it('disables both period buttons and month inputs when calculator access is inactive',()=>{
 const html=renderToStaticMarkup(<FinancePanel clubId="club" calculatorEnabled={false}/>);
 const filters=html.split('aria-label="Период за приходите и разходите"')[1].split('</header>')[0];
 expect(filters.match(/<button[^>]*disabled=""/g)).toHaveLength(2);
 expect(filters.match(/<input[^>]*disabled=""/g)).toHaveLength(2);
});

it('keeps period controls enabled for admin viewing without an active calculator subscription',()=>{
 const html=renderToStaticMarkup(<FinancePanel clubId="club" calculatorEnabled={false} calculatorCanView/>);
 const filters=html.split('aria-label="Период за приходите и разходите"')[1].split('</header>')[0];
 expect(filters).not.toContain('disabled=""');
});
