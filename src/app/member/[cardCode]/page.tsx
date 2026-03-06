'use client'

import { useState, useEffect, use } from 'react'

interface Member {
  id: string
  cardCode: string
  name: string
  visits_total: number
  visits_used: number
  isActive?: boolean
}

export default function MemberPage({ params }: { params: Promise<{ cardCode: string }> }) {
  const resolvedParams = use(params)
  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean>(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Check admin session via API
        const sessionRes = await fetch('/api/admin/check-session');
        const sessionData = await sessionRes.json();
        setIsAdmin(sessionData.isAdmin);

        // Fetch member data
        const memberRes = await fetch(`/api/members/${resolvedParams.cardCode}`);
        if (memberRes.ok) {
          const data = await memberRes.json();
          setMember(data);
        } else {
          // Fallback to mock if API not ready or fails
          const mockMember: Member = {
            id: 'mock-id',
            cardCode: resolvedParams.cardCode,
            name: 'Anna Petrova',
            visits_total: 8,
            visits_used: 4,
            isActive: true
          }
          setMember(mockMember);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        // Fallback to mock
        setMember({
          id: 'mock-id',
          cardCode: resolvedParams.cardCode,
          name: 'Anna Petrova',
          visits_total: 8,
          visits_used: 4,
          isActive: true
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [resolvedParams.cardCode])

  const remaining = member ? member.visits_total - member.visits_used : 0
  const isExhausted = remaining <= 0

  const handleCheckIn = async () => {
    if (!member || isExhausted) return
    
    try {
      const response = await fetch(`/api/members/${resolvedParams.cardCode}/check-in`, {
        method: 'POST',
      });

      if (response.ok) {
        const updatedMember = await response.json();
        setMember(updatedMember);
      } else {
        // Mock update if API fails
        setMember(prev => prev ? { ...prev, visits_used: prev.visits_used + 1 } : null);
      }
    } catch (err) {
      console.error('Check-in error:', err);
      setMember(prev => prev ? { ...prev, visits_used: prev.visits_used + 1 } : null);
    }
  }

  const handleReset = async () => {
    if (!member) return
    
    try {
      const response = await fetch(`/api/members/${resolvedParams.cardCode}/reset`, {
        method: 'POST',
      });

      if (response.ok) {
        const updatedMember = await response.json();
        setMember(updatedMember);
      } else {
        // Mock update if API fails
        setMember(prev => prev ? { ...prev, visits_used: 0 } : null);
      }
    } catch (err) {
      console.error('Reset error:', err);
      setMember(prev => prev ? { ...prev, visits_used: 0 } : null);
    }
  }

  const handleAdminLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      setIsAdmin(false);
    } catch (err) {
      console.error('Logout error:', err);
      setIsAdmin(false);
    }
  }

  if (loading) {
    return (
      <div className="container flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <div className="loading mb-4"></div>
          <p className="text-secondary">Зареждане...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <div className="alert alert-error">
          <h3 className="mb-2">Грешка</h3>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (!member) {
    return (
      <div className="container flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <div className="alert alert-warning">
          <h3 className="mb-2">Член не е намерен</h3>
          <p>Не съществува член с код на карта: {resolvedParams.cardCode}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container flex items-center justify-center fade-in" style={{ minHeight: '100vh' }}>
      <div className="member-card" style={{ maxWidth: '420px', width: '100%' }}>
        <div className="text-center mb-6">
          <div className="text-gold mb-3" style={{ fontSize: '2.5rem' }}>♦</div>
          <h1 className="member-name">{member.name}</h1>
          {member.isActive === false && (
            <div className="badge badge-warning mb-2">Активиране на карта...</div>
          )}
        </div>

        <div className="visit-info mb-6">
          <div className="visit-item">
            <span className="visit-number">{member.visits_total}</span>
            <div className="visit-label">Карта</div>
          </div>
          <div className="visit-item">
            <span className="visit-number">{member.visits_used}</span>
            <div className="visit-label">Използвани</div>
          </div>
          <div className="visit-item">
            <span className={`visit-number ${isExhausted ? 'text-error' : 'text-gold'}`}>
              {remaining}
            </span>
            <div className="visit-label">Остават</div>
          </div>
        </div>

        {isExhausted && (
          <div className="alert alert-warning mb-6">
            <strong>Картата е изчерпана</strong>
            <p className="mt-2 mb-0">Няма оставащи посещения. Моля, свържете се с администратор.</p>
          </div>
        )}

        {/* Admin controls */}
        {isAdmin && (
          <div className="space-y-4 mb-6">
            <button
              onClick={handleCheckIn}
              disabled={isExhausted}
              className="btn btn-primary w-full"
              style={{ cursor: isExhausted ? 'not-allowed' : 'pointer' }}
            >
              Check In
            </button>
            <button
              onClick={handleReset}
              className="btn btn-outline w-full"
              style={{ 
                cursor: 'pointer',
                border: '1px solid var(--gold)',
                color: 'var(--gold)',
                background: 'transparent',
                padding: '0.75rem',
                borderRadius: 'var(--radius)'
              }}
            >
              Reset
            </button>
          </div>
        )}

        {/* Бутон за изход от администраторски режим */}
        {isAdmin && (
          <button
            onClick={handleAdminLogout}
            className="btn btn-secondary w-full mb-6"
            style={{ cursor: 'pointer' }}
          >
            Изход от администраторски режим
          </button>
        )}

        <div className="mt-6 text-center">
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>
            Dalida Dance Studio
          </p>
          <p className="text-muted" style={{ fontSize: '0.75rem' }}>
            NFC Check-in System
          </p>
        </div>
      </div>
    </div>
  )
}