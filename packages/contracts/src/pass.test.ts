import { describe, it, expect } from 'vitest';
import type {
  StudentAllInOnePassPayload,
  StudentAllInOnePassResult,
  VerifyStudentPassResult,
} from './index.js';

describe('All-in-One Student Pass & QR Identification Contracts', () => {
  const mockActiveStudentPass: StudentAllInOnePassPayload = {
    pass_token: 'SKYPASS:v1:5607c9c7-229d-4f47-bc20-2de5146f25da:329e34b0e884523d',
    pass_version: '1.0',
    issuer: 'Skyline Student Association · CampusOne',
    generated_at: new Date().toISOString(),
    student: {
      user_id: '5607c9c7-229d-4f47-bc20-2de5146f25da',
      full_name: 'Rahul Sharma',
      email: 'member@skyline.edu',
      student_id: 'SKY-2026-1042',
    },
    membership: {
      is_member: true,
      status: 'active',
      membership_id: '63e056c9-1f9e-4cdf-b4cb-c037961fc34d',
      tier_id: 'b0000000-0000-0000-0000-000000000001',
      tier_name: 'General Student Member',
      starts_at: '2026-09-10T10:08:49Z',
      expires_at: '2027-09-10T10:08:49Z',
      days_remaining: 335,
      ticket_discount_percent: 15,
      merch_discount_percent: 10,
      benefits: ['Access to all general meetings & workshops', '15% discount on Gala tickets'],
    },
    upcoming_events: [
      {
        ticket_id: 'b718d368-b7b4-446d-aeea-a94bee22a150',
        event_id: 'c0000000-0000-0000-0000-000000000001',
        event_title: 'Spring Gala 2026',
        venue: 'Skyline Grand Ballroom, Student Activity Center',
        starts_at: '2026-10-25T04:31:54Z',
        ticket_type_name: 'General Admission Ticket',
        status: 'issued',
        qr_token: 'd838d1f8b3eea8a51e4c475946c0efb35e279a2c8b07540ea6b4c2554c326cad',
      },
    ],
    signature: '329e34b0e884523d4f829a1b',
  };

  it('validates all required student identification fields in pass payload', () => {
    expect(mockActiveStudentPass.student.user_id).toBe('5607c9c7-229d-4f47-bc20-2de5146f25da');
    expect(mockActiveStudentPass.student.full_name).toBe('Rahul Sharma');
    expect(mockActiveStudentPass.student.email).toBe('member@skyline.edu');
    expect(mockActiveStudentPass.student.student_id).toBe('SKY-2026-1042');
  });

  it('accurately represents active membership and subscription details', () => {
    const mem = mockActiveStudentPass.membership;
    expect(mem.is_member).toBe(true);
    expect(mem.status).toBe('active');
    expect(mem.tier_name).toBe('General Student Member');
    expect(mem.ticket_discount_percent).toBe(15);
    expect(mem.merch_discount_percent).toBe(10);
    expect(mem.days_remaining).toBeGreaterThan(0);
    expect(mem.benefits).toContain('15% discount on Gala tickets');
  });

  it('accurately lists upcoming registered events and ticket admissions', () => {
    expect(mockActiveStudentPass.upcoming_events).toHaveLength(1);
    const event = mockActiveStudentPass.upcoming_events[0];
    expect(event.event_title).toBe('Spring Gala 2026');
    expect(event.ticket_type_name).toBe('General Admission Ticket');
    expect(event.status).toBe('issued');
    expect(event.qr_token).toBeDefined();
  });

  it('verifies deterministic token signature format SKYPASS:v1:<user_id>:<sig>', () => {
    const token = mockActiveStudentPass.pass_token;
    expect(token.startsWith('SKYPASS:v1:')).toBe(true);
    const parts = token.split(':');
    expect(parts).toHaveLength(4);
    expect(parts[1]).toBe('v1');
    expect(parts[2]).toBe(mockActiveStudentPass.student.user_id);
    expect(parts[3]).toHaveLength(16);
  });

  it('correctly models non-member student pass without active subscription', () => {
    const nonMemberPass: StudentAllInOnePassPayload = {
      ...mockActiveStudentPass,
      membership: {
        is_member: false,
        status: 'none',
        ticket_discount_percent: 0,
        merch_discount_percent: 0,
      },
    };
    expect(nonMemberPass.membership.is_member).toBe(false);
    expect(nonMemberPass.membership.status).toBe('none');
    expect(nonMemberPass.membership.tier_name).toBeUndefined();
    expect(nonMemberPass.membership.ticket_discount_percent).toBe(0);
  });

  it('validates verification result contract for door attendants', () => {
    const verifyResult: VerifyStudentPassResult = {
      status: 'success',
      verified: true,
      data: {
        valid: true,
        pass_token: mockActiveStudentPass.pass_token,
        verified_at: new Date().toISOString(),
        verified_by: 'staff-id-123',
        student: mockActiveStudentPass.student,
        membership: mockActiveStudentPass.membership,
        upcoming_events: mockActiveStudentPass.upcoming_events,
      },
    };

    expect(verifyResult.verified).toBe(true);
    expect(verifyResult.data?.valid).toBe(true);
    expect(verifyResult.data?.student.full_name).toBe('Rahul Sharma');
    expect(verifyResult.data?.membership.is_member).toBe(true);
    expect(verifyResult.data?.upcoming_events).toHaveLength(1);
  });
});
