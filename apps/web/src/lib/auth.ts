import type { RoleType } from '@campusone/contracts';
import { getBrowserClient } from './supabase';

export interface UserSession {
  userId: string;
  email: string;
  fullName: string;
  studentId?: string;
  roles: RoleType[];
}

export const DEMO_ACCOUNTS: Record<string, {
  email: string;
  password: string;
  role: RoleType;
  label: string;
  fullName: string;
  studentId: string;
}> = {
  admin: {
    email: 'admin@skyline.edu',
    password: 'SkylineDemo2026!',
    role: 'admin',
    label: 'Executive / Admin',
    fullName: 'Aditi Rao',
    studentId: 'SKY-2026-0001',
  },
  treasurer: {
    email: 'treasurer@skyline.edu',
    password: 'SkylineDemo2026!',
    role: 'treasurer',
    label: 'Treasurer',
    fullName: 'Devansh Verma',
    studentId: 'SKY-2026-0002',
  },
  door_staff: {
    email: 'door@skyline.edu',
    password: 'SkylineDemo2026!',
    role: 'door_staff',
    label: 'Door Staff',
    fullName: 'Simran Gill',
    studentId: 'SKY-2026-0003',
  },
  volunteer: {
    email: 'volunteer@skyline.edu',
    password: 'SkylineDemo2026!',
    role: 'volunteer',
    label: 'Volunteer Lead',
    fullName: 'Karan Malhotra',
    studentId: 'SKY-2026-0004',
  },
  member: {
    email: 'member@skyline.edu',
    password: 'SkylineDemo2026!',
    role: 'member',
    label: 'Active Member',
    fullName: 'Rahul Sharma',
    studentId: 'SKY-2026-1042',
  },
  applicant: {
    email: 'applicant@skyline.edu',
    password: 'SkylineDemo2026!',
    role: 'member',
    label: 'Student Applicant',
    fullName: 'Priya Nair',
    studentId: 'SKY-2026-4091',
  },
};

/**
 * Get current authenticated user session from Supabase Auth
 */
export async function getCurrentUserSession(): Promise<UserSession | null> {
  const supabase = getBrowserClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  // Fetch real authoritative roles from database
  const { data: rolesData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  const roles = (rolesData || []).map((r: { role: RoleType }) => r.role);

  return {
    userId: user.id,
    email: user.email || '',
    fullName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
    studentId: user.user_metadata?.student_id,
    roles,
  };
}

/**
 * Sign in using email & password against Supabase Auth
 */
export async function signInWithPassword(email: string, password: string): Promise<UserSession> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    throw new Error(error?.message || 'Authentication failed');
  }

  const { data: rolesData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', data.user.id);

  const roles = (rolesData || []).map((r: { role: RoleType }) => r.role);

  return {
    userId: data.user.id,
    email: data.user.email || '',
    fullName: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'User',
    studentId: data.user.user_metadata?.student_id,
    roles,
  };
}

/**
 * Instant sign in as one of the pre-provisioned demo accounts
 */
export async function signInAsDemoRole(roleKey: string): Promise<UserSession> {
  const creds = DEMO_ACCOUNTS[roleKey];
  if (!creds) {
    throw new Error(`Unknown demo role: ${roleKey}`);
  }
  return signInWithPassword(creds.email, creds.password);
}

/**
 * Register a new student account with Supabase Auth
 */
export async function signUp(params: {
  email: string;
  password: string;
  fullName: string;
  studentId?: string;
}): Promise<UserSession> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      data: {
        full_name: params.fullName,
        student_id: params.studentId,
      },
    },
  });

  if (error || !data.user) {
    throw new Error(error?.message || 'Registration failed');
  }

  // Create public profile row
  await supabase.from('profiles').upsert({
    id: data.user.id,
    full_name: params.fullName,
    email: params.email,
    student_id: params.studentId || null,
  });

  return {
    userId: data.user.id,
    email: data.user.email || '',
    fullName: params.fullName,
    studentId: params.studentId,
    roles: ['member'],
  };
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<void> {
  const supabase = getBrowserClient();
  await supabase.auth.signOut();
}

/**
 * Listen for auth state transitions (sign in, sign out, token refresh)
 */
export function onAuthStateChange(callback: (session: UserSession | null) => void) {
  const supabase = getBrowserClient();
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!session?.user) {
      callback(null);
      return;
    }

    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id);

    const roles = (rolesData || []).map((r: { role: RoleType }) => r.role);

    callback({
      userId: session.user.id,
      email: session.user.email || '',
      fullName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
      studentId: session.user.user_metadata?.student_id,
      roles,
    });
  });

  return subscription;
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
