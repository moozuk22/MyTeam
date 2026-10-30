'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MemberDetailModal } from './members-page-components';
import { normalizeMember } from '../_utils/members-page-utils';
import type { Member } from '../_types/members-page-types';
import '../page.css';

export default function FinancePlayerDetails({ playerId, clubId, onClose }: { playerId: string; clubId: string; onClose: () => void }) {
  const [member, setMember] = useState<Member | null>(null);
  const [isCoach,setIsCoach] = useState(false);
  const [coachGroups,setCoachGroups] = useState<{id:string;name:string;playerCount:number}[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const trigger = document.activeElement;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      if (trigger instanceof HTMLElement) trigger.focus();
    };
  }, [onClose]);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const [response,sessionResponse,groupsResponse] = await Promise.all([
          fetch(`/api/admin/members/${encodeURIComponent(playerId)}`, { signal: controller.signal, cache: 'no-store' }),
          fetch('/api/admin/check-session', { signal: controller.signal, cache: 'no-store' }),
          fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/coach-groups`, { signal: controller.signal, cache: 'no-store' }),
        ]);
        if (sessionResponse.ok) {
          const session = await sessionResponse.json();
          if (!controller.signal.aborted) setIsCoach(Boolean(session.isCoach) || session.roles?.includes('coach') === true);
        }
        if (groupsResponse.ok) {
          const groups = await groupsResponse.json();
          if (!controller.signal.aborted && Array.isArray(groups)) setCoachGroups(groups);
        }
        if (!response.ok) throw new Error('Неуспешно зареждане на състезателя.');
        const player = await response.json();
        if (player.clubId !== clubId) throw new Error('Състезателят не е намерен в клуба.');
        if (!controller.signal.aborted) setMember(normalizeMember({ ...player, coachGroupIds: player.coachGroups?.map((group: {id:string}) => group.id) ?? player.coachGroupIds, club: { ...player.club, id: clubId } }));
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Неуспешно зареждане.');
      }
    }
    void load();
    return () => controller.abort();
  }, [playerId, clubId]);
  if (!member) return createPortal(<div className="amp-overlay" onClick={onClose}>
    <div className="amp-modal" role="dialog" aria-modal="true" aria-label="Детайли за състезател" onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
      <p role={error ? 'alert' : 'status'}>{error || 'Зареждане…'}</p>
      <button type="button" autoFocus onClick={onClose}>Затвори</button>
    </div>
  </div>, document.body);
  return createPortal(<MemberDetailModal member={member} onClose={onClose} isCoach={isCoach} coachGroups={coachGroups} onCoachGroupAssigned={(_,ids) => setMember(current => current ? {...current,coachGroupIds:ids} : current)} showManagementActions={false} onRequestEdit={() => {}} onRequestDelete={() => {}} />, document.body);
}
