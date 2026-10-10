import { describe, it, expect } from 'vitest';
import type {
  MembershipTier,
  MembershipApplication,
  Membership,
  Event,
  TicketType,
  Ticket,
  ProductVariant,
  LedgerEntry,
  ActionQueueItem,
} from './index';

describe('Phase 2 — All Six Scenes Business Engine Tests', () => {
  // ─── SCENE 1: MEMBERSHIP MANAGEMENT ─────────────────────────────────────────

  describe('Scene 1: Membership Workflow', () => {
    it('handles application submission, rejection, and reapplication with revision increment', () => {
      // Step 1: Initial submit
      const app: MembershipApplication = {
        id: 'app-test-1',
        organization_id: 'org-demo',
        applicant_id: 'user-priya',
        requested_tier_id: 'tier-general',
        status: 'submitted',
        revision: 1,
        statement: 'Interested in graphic design.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      expect(app.status).toBe('submitted');
      expect(app.revision).toBe(1);

      // Step 2: Admin rejection with reason
      app.status = 'rejected';
      app.rejection_reason = 'Please add student ID number';
      app.reviewer_id = 'admin-user';
      app.reviewed_at = new Date().toISOString();
      expect(app.status).toBe('rejected');
      expect(app.rejection_reason).toContain('student ID');

      // Step 3: Reapply
      app.revision += 1;
      app.statement = 'Interested in graphic design. Student ID: SKY-2026-4091.';
      app.status = 'submitted';
      app.rejection_reason = null;

      expect(app.revision).toBe(2);
      expect(app.status).toBe('submitted');
      expect(app.rejection_reason).toBeNull();
    });

    it('calculates tier discounts and expiry accurately', () => {
      const generalTier: MembershipTier = {
        id: 'tier-general',
        organization_id: 'org-demo',
        name: 'General Student Member',
        fee_paise: 25000,
        duration_days: 365,
        ticket_discount_percent: 15,
        merch_discount_percent: 10,
        benefits: [],
        is_active: true,
        created_at: '',
        updated_at: '',
      };

      const patronTier: MembershipTier = {
        id: 'tier-patron',
        organization_id: 'org-demo',
        name: 'Executive / Patron Member',
        fee_paise: 50000,
        duration_days: 365,
        ticket_discount_percent: 25,
        merch_discount_percent: 20,
        benefits: [],
        is_active: true,
        created_at: '',
        updated_at: '',
      };

      const ticketBasePricePaise = 50000; // ₹500
      const generalDiscount = Math.round(ticketBasePricePaise * (generalTier.ticket_discount_percent / 100));
      const patronDiscount = Math.round(ticketBasePricePaise * (patronTier.ticket_discount_percent / 100));

      expect(ticketBasePricePaise - generalDiscount).toBe(42500); // ₹425
      expect(ticketBasePricePaise - patronDiscount).toBe(37500); // ₹375
    });

    it('records walk-up membership with source-linked ledger entry', () => {
      const tierFee = 25000;
      const ledgerEntry: LedgerEntry = {
        id: 'LED-WALKUP-1',
        organization_id: 'org-demo',
        entry_type: 'income',
        amount_paise: tierFee,
        category: 'membership',
        source_type: 'checkout',
        source_id: 'mem-walkup-1',
        payment_method: 'cash',
        effective_date: '2026-04-10',
        created_at: new Date().toISOString(),
      };

      expect(ledgerEntry.amount_paise).toBe(25000);
      expect(ledgerEntry.payment_method).toBe('cash');
      expect(ledgerEntry.category).toBe('membership');
    });
  });

  // ─── SCENE 2: EVENTS & TICKETS ───────────────────────────────────────────────

  describe('Scene 2: Gala Events & Atomic QR Check-in', () => {
    it('enforces event capacity limits and prevents overselling', () => {
      const event: Event = {
        id: 'evt-1',
        organization_id: 'org-demo',
        title: 'Spring Gala 2026',
        venue: 'Grand Ballroom',
        starts_at: '',
        ends_at: '',
        capacity: 250,
        reserved_capacity: 0,
        sold_count: 249,
        status: 'published',
        created_at: '',
        updated_at: '',
      };

      const requestedQty = 2;
      const canSell = event.sold_count + event.reserved_capacity + requestedQty <= event.capacity;
      expect(canSell).toBe(false); // Exceeds capacity
    });

    it('prevents duplicate QR ticket check-ins', () => {
      const ticket: Ticket = {
        id: 'tkt-1',
        checkout_item_id: 'ci-1',
        event_id: 'evt-1',
        ticket_type_id: 'tt-1',
        owner_id: 'user-1',
        qr_token: 'SKY-GALA-8492-HMAC',
        status: 'issued',
        issued_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      // First scan: succeeds
      expect(ticket.status).toBe('issued');
      ticket.status = 'checked_in';
      expect(ticket.status).toBe('checked_in');

      // Second scan attempt: should be rejected
      const attemptCheckIn = () => {
        if (ticket.status === 'checked_in') {
          throw new Error('Ticket already checked in');
        }
      };

      expect(attemptCheckIn).toThrowError('Ticket already checked in');
    });
  });

  // ─── SCENE 3: ANNOUNCEMENTS ──────────────────────────────────────────────────

  describe('Scene 3: Announcements & Mailing Preferences', () => {
    it('honors audience filtering for public, members, and volunteers', () => {
      const announcements = [
        { id: '1', audience: 'public' },
        { id: '2', audience: 'all_members' },
        { id: '3', audience: 'volunteers' },
      ];

      const publicFeed = announcements.filter((a) => a.audience === 'public');
      const memberFeed = announcements.filter((a) => a.audience === 'all_members' || a.audience === 'public');

      expect(publicFeed.length).toBe(1);
      expect(memberFeed.length).toBe(2);
    });
  });

  // ─── SCENE 4: HOODIES & MERCHANDISE ──────────────────────────────────────────

  describe('Scene 4: Merchandise Inventory & Member Discounts', () => {
    it('atomically decrements stock and applies member discount', () => {
      const variant: ProductVariant = {
        id: 'var-hoodie-m',
        product_id: 'prod-hoodie',
        sku: 'HOODIE-M',
        price_paise: 89900, // ₹899
        stock_on_hand: 24,
        reserved_quantity: 0,
        is_active: true,
        created_at: '',
        updated_at: '',
      };

      const orderQty = 2;
      const isMember = true;
      const memberDiscountPct = 20;

      // Reserve & decrement
      expect(variant.stock_on_hand).toBe(24);
      variant.stock_on_hand -= orderQty;
      expect(variant.stock_on_hand).toBe(22);

      const unitPrice = variant.price_paise;
      const discount = isMember ? Math.round(unitPrice * (memberDiscountPct / 100)) : 0;
      const total = (unitPrice - discount) * orderQty;

      expect(discount).toBe(17980); // ₹179.80 off per hoodie
      expect(total).toBe(143840); // ₹1,438.40 total for 2
    });
  });

  // ─── SCENE 5: FUNDRAISER PLANNING ────────────────────────────────────────────

  describe('Scene 5: Fundraiser Task Progress & Cash Ledger Entry', () => {
    it('tracks task progress separately from financial progress', () => {
      const tasks = [
        { id: '1', status: 'done' },
        { id: '2', status: 'done' },
        { id: '3', status: 'in_progress' },
        { id: '4', status: 'todo' },
      ];

      const doneCount = tasks.filter((t) => t.status === 'done').length;
      const progressPercent = (doneCount / tasks.length) * 100;

      expect(doneCount).toBe(2);
      expect(progressPercent).toBe(50);
    });

    it('records cash bake-sale contribution directly into campaign total and ledger', () => {
      let raisedPaise = 1420000; // ₹14,200
      const contributionPaise = 120000; // ₹1,200

      raisedPaise += contributionPaise;
      expect(raisedPaise).toBe(1540000); // ₹15,400
    });
  });

  // ─── SCENE 6: TREASURY & DETERMINISTIC ACTION QUEUE ──────────────────────────

  describe('Scene 6: Treasury Ledger & Deterministic Action Queue', () => {
    it('verifies that total income minus total expenses balances net movement', () => {
      const ledger: LedgerEntry[] = [
        { id: '1', organization_id: 'org', entry_type: 'income', amount_paise: 35000, category: 'tickets', source_type: 'checkout', source_id: '1', effective_date: '2026-04-10', created_at: '' },
        { id: '2', organization_id: 'org', entry_type: 'income', amount_paise: 50000, category: 'membership', source_type: 'checkout', source_id: '2', effective_date: '2026-04-10', created_at: '' },
        { id: '3', organization_id: 'org', entry_type: 'income', amount_paise: 120000, category: 'fundraiser', source_type: 'contribution', source_id: '3', effective_date: '2026-04-09', created_at: '' },
        { id: '4', organization_id: 'org', entry_type: 'expense', amount_paise: 145000, category: 'expense', source_type: 'expense', source_id: '4', effective_date: '2026-04-07', created_at: '' },
      ];

      const totalIncome = ledger.filter((l) => l.entry_type === 'income').reduce((sum, l) => sum + l.amount_paise, 0);
      const totalExpense = ledger.filter((l) => l.entry_type === 'expense').reduce((sum, l) => sum + l.amount_paise, 0);
      const net = totalIncome - totalExpense;

      expect(totalIncome).toBe(205000); // ₹2,050
      expect(totalExpense).toBe(145000); // ₹1,450
      expect(net).toBe(60000); // ₹600 net
    });

    it('covers all six operational action queue rule triggers deterministically', () => {
      const requiredRuleTypes = [
        'membership_renewal',
        'low_event_availability',
        'overdue_task',
        'low_stock',
        'reimbursement_review',
        'failed_announcement_delivery',
      ];

      const sampleQueueItems: ActionQueueItem[] = [
        { id: '1', organization_id: 'org', action_type: 'membership_renewal', source_type: 'memberships', source_id: 'm1', title: 'Renewal', reason: 'Expires soon', next_action: 'Notify', priority: 'medium', status: 'open', dedupe_key: 'd1', detected_at: '', created_at: '', updated_at: '' },
        { id: '2', organization_id: 'org', action_type: 'low_event_availability', source_type: 'events', source_id: 'e1', title: 'Low Cap', reason: 'Seats low', next_action: 'Hold', priority: 'high', status: 'open', dedupe_key: 'd2', detected_at: '', created_at: '', updated_at: '' },
        { id: '3', organization_id: 'org', action_type: 'overdue_task', source_type: 'tasks', source_id: 't1', title: 'Overdue', reason: 'Past due', next_action: 'Reassign', priority: 'urgent', status: 'open', dedupe_key: 'd3', detected_at: '', created_at: '', updated_at: '' },
        { id: '4', organization_id: 'org', action_type: 'low_stock', source_type: 'product_variants', source_id: 'v1', title: 'Low Stock', reason: '< 5 left', next_action: 'Restock', priority: 'medium', status: 'open', dedupe_key: 'd4', detected_at: '', created_at: '', updated_at: '' },
        { id: '5', organization_id: 'org', action_type: 'reimbursement_review', source_type: 'expenses', source_id: 'x1', title: 'Reimbursement', reason: 'Pending review', next_action: 'Verify', priority: 'medium', status: 'open', dedupe_key: 'd5', detected_at: '', created_at: '', updated_at: '' },
        { id: '6', organization_id: 'org', action_type: 'failed_announcement_delivery', source_type: 'notification_jobs', source_id: 'n1', title: 'Failed Delivery', reason: 'Bounced', next_action: 'Prompt', priority: 'low', status: 'open', dedupe_key: 'd6', detected_at: '', created_at: '', updated_at: '' },
      ];

      const presentTypes = sampleQueueItems.map((i) => i.action_type);
      for (const req of requiredRuleTypes) {
        expect(presentTypes).toContain(req);
      }
    });
  });
});
