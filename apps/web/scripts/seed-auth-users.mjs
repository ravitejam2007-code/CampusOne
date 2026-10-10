import { createClient } from '@supabase/supabase-js';
import { existsSync } from 'node:fs';

// Load .env file natively
if (existsSync('.env')) {
  process.loadEnvFile('.env');
} else if (existsSync('../../.env')) {
  process.loadEnvFile('../../.env');
}

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('CRITICAL: PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be defined in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_ORG_ID = 'a0000000-0000-0000-0000-000000000001';

const DEMO_USERS = [
  {
    email: 'admin@skyline.edu',
    password: 'SkylineDemo2026!',
    fullName: 'Aditi Rao',
    studentId: 'SKY-2026-0001',
    role: 'admin',
  },
  {
    email: 'treasurer@skyline.edu',
    password: 'SkylineDemo2026!',
    fullName: 'Devansh Verma',
    studentId: 'SKY-2026-0002',
    role: 'treasurer',
  },
  {
    email: 'door@skyline.edu',
    password: 'SkylineDemo2026!',
    fullName: 'Simran Gill',
    studentId: 'SKY-2026-0003',
    role: 'door_staff',
  },
  {
    email: 'volunteer@skyline.edu',
    password: 'SkylineDemo2026!',
    fullName: 'Karan Malhotra',
    studentId: 'SKY-2026-0004',
    role: 'volunteer',
  },
  {
    email: 'member@skyline.edu',
    password: 'SkylineDemo2026!',
    fullName: 'Rahul Sharma',
    studentId: 'SKY-2026-1042',
    role: 'member',
  },
  {
    email: 'applicant@skyline.edu',
    password: 'SkylineDemo2026!',
    fullName: 'Priya Nair',
    studentId: 'SKY-2026-4091',
    role: 'member',
  },
];

async function seedAuthUsers() {
  console.log('--- Checking & Provisioning Supabase Auth Users ---');

  const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('Failed to list users:', listError);
    return;
  }

  console.log(`Current existing users count: ${existingUsers.users.length}`);

  for (const u of DEMO_USERS) {
    let authUser = existingUsers.users.find((eu) => eu.email === u.email);

    if (!authUser) {
      console.log(`Creating auth user: ${u.email}...`);
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: {
          full_name: u.fullName,
          student_id: u.studentId,
        },
      });

      if (createError) {
        console.error(`Error creating ${u.email}:`, createError);
        continue;
      }
      authUser = created.user;
    } else {
      console.log(`Auth user ${u.email} already exists (ID: ${authUser.id}).`);
    }

    if (authUser) {
      // Upsert profile
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: authUser.id,
        full_name: u.fullName,
        email: u.email,
        student_id: u.studentId,
      }, { onConflict: 'id' });

      if (profileError) {
        console.error(`Profile upsert error for ${u.email}:`, profileError);
      } else {
        console.log(`Profile synced for ${u.email}.`);
      }

      // Upsert user_role
      const { error: roleError } = await supabase.from('user_roles').upsert({
        user_id: authUser.id,
        organization_id: DEMO_ORG_ID,
        role: u.role,
      }, { onConflict: 'user_id,organization_id,role' });

      if (roleError) {
        console.error(`User role upsert error for ${u.email}:`, roleError);
      } else {
        console.log(`Role [${u.role}] granted for ${u.email}.`);
      }
    }
  }

  console.log('--- Provisioning Complete ---');
}

seedAuthUsers();
