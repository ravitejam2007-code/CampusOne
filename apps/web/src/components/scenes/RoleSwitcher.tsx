import { useState, useEffect } from 'react';

const ROLES = [
  { id: 'admin', label: 'Admin' },
  { id: 'treasurer', label: 'Treasurer' },
  { id: 'door_staff', label: 'Door Staff' },
  { id: 'volunteer', label: 'Volunteer' },
  { id: 'member', label: 'Active Member' },
  { id: 'applicant', label: 'Applicant' },
] as const;

export default function RoleSwitcher() {
  const [currentRole, setCurrentRole] = useState<string>('admin');

  useEffect(() => {
    const saved = localStorage.getItem('campusone_demo_role');
    if (saved) setCurrentRole(saved);

    const onRoleChange = (e: CustomEvent) => {
      setCurrentRole(e.detail);
    };

    window.addEventListener('campusone:role_changed' as any, onRoleChange);
    return () => window.removeEventListener('campusone:role_changed' as any, onRoleChange);
  }, []);

  const handleSelect = (roleId: string) => {
    setCurrentRole(roleId);
    localStorage.setItem('campusone_demo_role', roleId);
    window.dispatchEvent(new CustomEvent('campusone:role_changed', { detail: roleId }));
  };

  return (
    <div className="bg-[var(--color-ink-deep)] text-white py-2 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-[13px]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--color-success)] animate-pulse" />
          <span className="font-bold tracking-tight text-white/90">CampusOne Role View:</span>
          <span className="text-[var(--color-hairline)] hidden sm:inline">Switch persona to test permissions</span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {ROLES.map((r) => {
            const active = currentRole === r.id;
            return (
              <button
                key={r.id}
                onClick={() => handleSelect(r.id)}
                className={`px-3 py-1 rounded-full text-[12px] font-bold transition-all whitespace-nowrap ${
                  active
                    ? 'bg-white text-[var(--color-ink-deep)] shadow-sm'
                    : 'bg-white/10 text-white/80 hover:bg-white/20'
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
