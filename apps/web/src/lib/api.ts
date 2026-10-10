import type {
  CreateCheckoutParams,
  CreateCheckoutResult,
  FulfillCheckoutParams,
  FulfillCheckoutResult,
  RecordStaffPaymentParams,
  RecordCashContributionParams,
  CheckInTicketParams,
  CheckInTicketResult,
  TreasurerOverviewResult,
  MembershipTier,
  Event,
  TicketType,
  Product,
  Announcement,
  Fundraiser,
  FundraiserTask,
  ActionQueueItem,
} from '@campusone/contracts';
import { getBrowserClient } from './supabase';

/**
 * CampusOne Unified API Layer
 * Thin typed wrappers calling Supabase REST and RPC functions
 */

export const api = {
  // ─── CHECKOUT & PAYMENTS (Shared Foundation) ──────────────────────────────

  async createCheckout(params: CreateCheckoutParams): Promise<CreateCheckoutResult> {
    const supabase = getBrowserClient();
    const { data, error } = await supabase.rpc('create_checkout', {
      p_items: params.p_items,
      p_payment_method: params.p_payment_method,
      p_idempotency_key: params.p_idempotency_key,
      p_notes: params.p_notes || null,
    });

    if (error) {
      throw new Error(`Checkout creation failed: ${error.message}`);
    }
    return data as CreateCheckoutResult;
  },

  async fulfillCheckout(params: FulfillCheckoutParams): Promise<FulfillCheckoutResult> {
    const supabase = getBrowserClient();
    const { data, error } = await supabase.rpc('fulfill_checkout', {
      p_checkout_id: params.p_checkout_id,
      p_payment_id: params.p_payment_id || null,
    });

    if (error) {
      throw new Error(`Fulfilment failed: ${error.message}`);
    }
    return data as FulfillCheckoutResult;
  },

  async recordStaffPayment(params: RecordStaffPaymentParams): Promise<FulfillCheckoutResult> {
    const supabase = getBrowserClient();
    const { data, error } = await supabase.rpc('record_staff_payment', {
      p_checkout_id: params.p_checkout_id,
      p_payment_method: params.p_payment_method,
      p_amount_paise: params.p_amount_paise,
      p_reference: params.p_reference || null,
      p_notes: params.p_notes || null,
    });

    if (error) {
      throw new Error(`Staff payment record failed: ${error.message}`);
    }
    return data as FulfillCheckoutResult;
  },

  // ─── SCENE 1: MEMBERSHIP ──────────────────────────────────────────────────

  async getMembershipTiers(): Promise<MembershipTier[]> {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from('membership_tiers')
      .select('*')
      .eq('is_active', true)
      .order('fee_paise', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  },

  // ─── SCENE 2: EVENTS & TICKETS ───────────────────────────────────────────

  async getPublishedEvents(): Promise<Event[]> {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'published')
      .order('starts_at', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async getTicketTypes(eventId: string): Promise<TicketType[]> {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from('ticket_types')
      .select('*')
      .eq('event_id', eventId)
      .eq('is_active', true);

    if (error) throw new Error(error.message);
    return data || [];
  },

  async checkInTicket(params: CheckInTicketParams): Promise<CheckInTicketResult> {
    const supabase = getBrowserClient();
    const { data, error } = await supabase.rpc('check_in_ticket', {
      p_ticket_id: params.p_ticket_id,
      p_qr_token: params.p_qr_token || null,
    });

    if (error) throw new Error(error.message);
    return data as CheckInTicketResult;
  },

  // ─── SCENE 3: ANNOUNCEMENTS ──────────────────────────────────────────────

  async getAnnouncements(): Promise<Announcement[]> {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  // ─── SCENE 4: MERCHANDISE ────────────────────────────────────────────────

  async getProducts(): Promise<Product[]> {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from('products')
      .select('*, variants:product_variants(*)')
      .eq('status', 'published');

    if (error) throw new Error(error.message);
    return data || [];
  },

  // ─── SCENE 5: FUNDRAISERS & TASKS ────────────────────────────────────────

  async getActiveFundraisers(): Promise<Fundraiser[]> {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from('fundraisers')
      .select('*')
      .eq('status', 'active');

    if (error) throw new Error(error.message);
    return data || [];
  },

  async getFundraiserTasks(fundraiserId: string): Promise<FundraiserTask[]> {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from('tasks')
      .select('*, assignee:profiles(*)')
      .eq('fundraiser_id', fundraiserId)
      .order('due_at', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async recordCashContribution(params: RecordCashContributionParams) {
    const supabase = getBrowserClient();
    const { data, error } = await supabase.rpc('record_cash_contribution', {
      p_fundraiser_id: params.p_fundraiser_id,
      p_amount_paise: params.p_amount_paise,
      p_method: params.p_method || 'cash',
      p_notes: params.p_notes || null,
    });

    if (error) throw new Error(error.message);
    return data;
  },

  // ─── SCENE 6: TREASURER DASHBOARD ────────────────────────────────────────

  async getTreasurerOverview(orgId: string, startDate?: string, endDate?: string): Promise<TreasurerOverviewResult> {
    const supabase = getBrowserClient();
    const { data, error } = await supabase.rpc('get_treasurer_overview', {
      p_org_id: orgId,
      p_start_date: startDate || null,
      p_end_date: endDate || null,
    });

    if (error) throw new Error(error.message);
    return data as TreasurerOverviewResult;
  },

  // ─── DETERMINISTIC ACTION QUEUE ──────────────────────────────────────────

  async getActionQueueItems(orgId: string): Promise<ActionQueueItem[]> {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from('action_queue_items')
      .select('*')
      .eq('organization_id', orgId)
      .eq('status', 'open')
      .order('priority', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async refreshActionQueue(orgId: string): Promise<number> {
    const supabase = getBrowserClient();
    const { data, error } = await supabase.rpc('refresh_action_queue', {
      p_org_id: orgId,
    });

    if (error) throw new Error(error.message);
    return data as number;
  },
};
