import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemberDetailModal } from './members-page-components';
import { normalizeMember } from '../_utils/members-page-utils';

const render = (cards:{cardCode:string;isActive:boolean}[], nfcTagId = '') => renderToStaticMarkup(<MemberDetailModal member={{...normalizeMember({id:'player',fullName:'Иван',status:'paid',cards,coachGroupIds:[],paymentLogs:[]}),nfcTagId}} onClose={vi.fn()} onRequestEdit={vi.fn()} onRequestDelete={vi.fn()} showManagementActions={false} showProfileLink />);
it('links to the active card profile without showing management actions', () => {
 const html = render([{cardCode:'OLD',isActive:false},{cardCode:'CARD /1',isActive:true}]);
 expect(html).toContain('href="/member/CARD%20%2F1"');
 expect(html).toContain('Виж профила');
 expect(html).not.toContain('Премахни състезател');
});
it('falls back to the NFC code and hides the profile link if there is no code', () => {
 expect(render([],'NFC123')).toContain('href="/member/NFC123"');
 expect(render([])).not.toContain('Виж профила');
});
