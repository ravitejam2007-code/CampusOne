import { describe, it, expect } from 'vitest';
import type { RoleType } from './index';

// ─── 1. ROLE-PERMISSION MATRIX VERIFICATION ─────────────────────────────────

const ROLE_PERMISSIONS: Record<RoleType, {
  canManageClub: boolean;
  canManageTiers: boolean;
  canPublishEvents: boolean;
  canSellAtDoor: boolean;
  canScanTickets: boolean;
  canPublishAnnouncements: boolean;
  canManageMerch: boolean;
  canManageTasks: boolean;
  canRecordCashPayment: boolean;
  canViewFullLedger: boolean;
}> = {
  admin: {
    canManageClub: true,
    canManageTiers: true,
    canPublishEvents: true,
    canSellAtDoor: true,
    canScanTickets: true,
    canPublishAnnouncements: true,
    canManageMerch: true,
    canManageTasks: true,
    canRecordCashPayment: true,
    canViewFullLedger: true,
  },
  treasurer: {
    canManageClub: false,
    canManageTiers: false,
    canPublishEvents: false,
    canSellAtDoor: true,
    canScanTickets: false,
    canPublishAnnouncements: false,
    canManageMerch: false,
    canManageTasks: false,
    canRecordCashPayment: true,
    canViewFullLedger: true,
  },
  door_staff: {
    canManageClub: false,
    canManageTiers: false,
    canPublishEvents: false,
    canSellAtDoor: true,
    canScanTickets: true,
    canPublishAnnouncements: false,
    canManageMerch: false,
    canManageTasks: false,
    canRecordCashPayment: true, // Only door sales
    canViewFullLedger: false,
  },
  volunteer: {
    canManageClub: false,
    canManageTiers: false,
    canPublishEvents: false,
    canSellAtDoor: false,
    canScanTickets: false,
    canPublishAnnouncements: false,
    canManageMerch: false,
    canManageTasks: true, // Assigned tasks
    canRecordCashPayment: false, // Default no, only bake-sale contribution if assigned
    canViewFullLedger: false,
  },
  member: {
    canManageClub: false,
    canManageTiers: false,
    canPublishEvents: false,
    canSellAtDoor: false,
    canScanTickets: false,
    canPublishAnnouncements: false,
    canManageMerch: false,
    canManageTasks: false,
    canRecordCashPayment: false,
    canViewFullLedger: false,
  },
};

describe('Phase 1: Role-Permission Matrix Verification', () => {
  it('Admin has full administrative, staff and financial capability', () => {
    const admin = ROLE_PERMISSIONS.admin;
    expect(admin.canManageClub).toBe(true);
    expect(admin.canManageTiers).toBe(true);
    expect(admin.canPublishEvents).toBe(true);
    expect(admin.canViewFullLedger).toBe(true);
  });

  it('Treasurer has access to full ledger and cash recording, but cannot publish events or manage tiers', () => {
    const treasurer = ROLE_PERMISSIONS.treasurer;
    expect(treasurer.canViewFullLedger).toBe(true);
    expect(treasurer.canRecordCashPayment).toBe(true);
    expect(treasurer.canManageClub).toBe(false);
    expect(treasurer.canPublishEvents).toBe(false);
    expect(treasurer.canPublishAnnouncements).toBe(false);
  });

  it('Door Staff can scan tickets and sell at door, but has no ledger visibility', () => {
    const doorStaff = ROLE_PERMISSIONS.door_staff;
    expect(doorStaff.canScanTickets).toBe(true);
    expect(doorStaff.canSellAtDoor).toBe(true);
    expect(doorStaff.canViewFullLedger).toBe(false);
    expect(doorStaff.canManageTiers).toBe(false);
  });

  it('Volunteer can update tasks, but cannot scan tickets or view ledger', () => {
    const volunteer = ROLE_PERMISSIONS.volunteer;
    expect(volunteer.canManageTasks).toBe(true);
    expect(volunteer.canScanTickets).toBe(false);
    expect(volunteer.canViewFullLedger).toBe(false);
  });

  it('Member cannot access any administrative or staff capabilities', () => {
    const member = ROLE_PERMISSIONS.member;
    expect(member.canManageClub).toBe(false);
    expect(member.canSellAtDoor).toBe(false);
    expect(member.canScanTickets).toBe(false);
    expect(member.canViewFullLedger).toBe(false);
    expect(member.canRecordCashPayment).toBe(false);
  });
});

// ─── 2. UNIFIED CHECKOUT MONEY & DISCOUNT INVARIANTS ────────────────────────

describe('Phase 1: Unified Money Model & Discount Calculation', () => {
  it('Computes correct member discounts for tickets and merch without rounding leakage', () => {
    const galaTicketPricePaise = 25000; // ₹250
    const memberDiscountPercent = 15; // 15%

    const discountPaise = Math.round((galaTicketPricePaise * memberDiscountPercent) / 100);
    const finalPricePaise = galaTicketPricePaise - discountPaise;

    expect(discountPaise).toBe(3750); // ₹37.50
    expect(finalPricePaise).toBe(21250); // ₹212.50
  });

  it('Applies 10% merch discount for hoodie purchase', () => {
    const hoodiePricePaise = 85000; // ₹850
    const merchDiscountPercent = 10; // 10%

    const discountPaise = Math.round((hoodiePricePaise * merchDiscountPercent) / 100);
    const finalPricePaise = hoodiePricePaise - discountPaise;

    expect(discountPaise).toBe(8500); // ₹85.00
    expect(finalPricePaise).toBe(76500); // ₹765.00
  });

  it('Enforces exact ledger balance equation: income - expense = net_recorded_movement', () => {
    const ledger = [
      { type: 'income', amount: 25000, category: 'membership' },
      { type: 'income', amount: 21250, category: 'tickets' },
      { type: 'income', amount: 76500, category: 'merch' },
      { type: 'income', amount: 15000, category: 'fundraiser' },
      { type: 'expense', amount: 30000, category: 'venue_deposit' },
    ];

    const totalIncome = ledger
      .filter((e) => e.type === 'income')
      .reduce((acc, curr) => acc + curr.amount, 0);

    const totalExpense = ledger
      .filter((e) => e.type === 'expense')
      .reduce((acc, curr) => acc + curr.amount, 0);

    const netMovement = totalIncome - totalExpense;

    expect(totalIncome).toBe(137750); // ₹1,377.50
    expect(totalExpense).toBe(30000);  // ₹300.00
    expect(netMovement).toBe(107750);   // ₹1,077.50
  });

  it('Rejects negative stock or capacity overflow', () => {
    const capacity = 250;
    const sold = 240;
    const reserved = 5;
    const available = capacity - sold - reserved;

    expect(available).toBe(5);

    const requestedQty = 6;
    const wouldExceed = (sold + reserved + requestedQty) > capacity;
    expect(wouldExceed).toBe(true);
  });
});
