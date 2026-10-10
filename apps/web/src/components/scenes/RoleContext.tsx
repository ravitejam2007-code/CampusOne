import React, { createContext, useContext, useState, useEffect } from 'react';
import type { RoleType } from '@campusone/contracts';

export type DemoRole = RoleType | 'guest' | 'applicant';

interface RoleContextValue {
  role: DemoRole;
  setRole: (r: DemoRole) => void;
  roleLabel: string;
}

const RoleContext = createContext<RoleContextValue>({
  role: 'admin',
  setRole: () => {},
  roleLabel: 'Admin / Executive',
});

const ROLE_LABELS: Record<DemoRole, string> = {
  admin: 'Executive / Admin',
  treasurer: 'Treasurer',
  door_staff: 'Door Staff',
  volunteer: 'Volunteer Lead',
  member: 'Active Member (Rahul)',
  applicant: 'Student Applicant (Priya)',
  guest: 'Campus Guest',
};

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<DemoRole>('admin');

  useEffect(() => {
    const saved = localStorage.getItem('campusone_demo_role') as DemoRole;
    if (saved && ROLE_LABELS[saved]) {
      setRoleState(saved);
    }
  }, []);

  const setRole = (newRole: DemoRole) => {
    setRoleState(newRole);
    localStorage.setItem('campusone_demo_role', newRole);
    window.dispatchEvent(new CustomEvent('campusone:role_changed', { detail: newRole }));
  };

  return (
    <RoleContext.Provider value={{ role, setRole, roleLabel: ROLE_LABELS[role] }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useDemoRole() {
  return useContext(RoleContext);
}
