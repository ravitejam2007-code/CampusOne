import type { RoleType, UserRole } from '@campusone/contracts';
import { getBrowserClient } from './supabase';

export interface UserSession {
  userId: string;
  email: string;
  fullName: string;
  roles: RoleType[];
}

export async function getCurrentUserSession(): Promise<UserSession | null> {
  const supabase = getBrowserClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  // Fetch roles
  const { data: rolesData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  const roles = (rolesData || []).map((r: { role: RoleType }) => r.role);

  return {
    userId: user.id,
    email: user.email || '',
    fullName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
    roles,
  };
}

export function hasRequiredRole(session: UserSession | null, requiredRole: RoleType): boolean {
  if (!session) return false;
  if (session.roles.includes('admin')) return true; // Admin has super-access
  return session.roles.includes(requiredRole);
}

export function isStaffMember(session: UserSession | null): boolean {
  if (!session) return false;
  return session.roles.some((r) => ['admin', 'treasurer', 'door_staff', 'volunteer'].includes(r));
}
