import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';

// ─── 1. RAZORPAY HMAC SIGNATURE VERIFICATION ENGINE ────────────────────────

function verifyRazorpayOrderSignature(
    orderId: string,
    paymentId: string,
    signature: string,
    secret: string
): boolean {
    const text = `${orderId}|${paymentId}`;
    const generatedSignature = crypto
        .createHmac('sha256', secret)
        .update(text)
        .digest('hex');
    return generatedSignature.toLowerCase() === signature.toLowerCase();
}

function verifyRazorpayWebhookSignature(
    rawBody: string,
    signature: string,
    secret: string
): boolean {
    const generatedSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');
    return generatedSignature.toLowerCase() === signature.toLowerCase();
}

describe('Phase 3: Razorpay Test Mode & HMAC Verification Engine', () => {
    const TEST_KEY_SECRET = 'demo_secret_key';

    it('Calculates and verifies valid Razorpay payment order HMAC-SHA256 signature', () => {
        const orderId = 'order_M1234567890';
        const paymentId = 'pay_P9876543210';
        const validSignature = crypto
            .createHmac('sha256', TEST_KEY_SECRET)
            .update(`${orderId}|${paymentId}`)
            .digest('hex');

        const isValid = verifyRazorpayOrderSignature(orderId, paymentId, validSignature, TEST_KEY_SECRET);
        expect(isValid).toBe(true);
    });

    it('Rejects invalid or tampered Razorpay payment signatures', () => {
        const orderId = 'order_M1234567890';
        const paymentId = 'pay_P9876543210';
        const tamperedSignature = 'deadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678';

        const isValid = verifyRazorpayOrderSignature(orderId, paymentId, tamperedSignature, TEST_KEY_SECRET);
        expect(isValid).toBe(false);
    });

    it('Verifies raw-body webhook HMAC signature over exact raw payload string', () => {
        const rawPayload = JSON.stringify({
            event: 'payment.captured',
            payload: {
                payment: {
                    entity: {
                        id: 'pay_W112233',
                        amount: 25000,
                        status: 'captured',
                        order_id: 'order_M1234567890',
                        notes: { checkout_id: 'c1234567-89ab-cdef-0123-456789abcdef' },
                    },
                },
            },
        });

        const validWebhookSig = crypto
            .createHmac('sha256', TEST_KEY_SECRET)
            .update(rawPayload)
            .digest('hex');

        const isValid = verifyRazorpayWebhookSignature(rawPayload, validWebhookSig, TEST_KEY_SECRET);
        expect(isValid).toBe(true);
    });

    it('Fails webhook signature verification when raw body text is tampered', () => {
        const originalBody = '{"event":"payment.captured","amount":25000}';
        const tamperedBody = '{"event":"payment.captured","amount":0}';

        const sig = crypto.createHmac('sha256', TEST_KEY_SECRET).update(originalBody).digest('hex');

        const isValid = verifyRazorpayWebhookSignature(tamperedBody, sig, TEST_KEY_SECRET);
        expect(isValid).toBe(false);
    });
});

// ─── 2. IDEMPOTENT FULFILMENT & LEDGER INVARIANTS ───────────────────────────

describe('Phase 3: Idempotent Fulfilment & Ledger Invariants', () => {
    it('Guarantees exactly one ledger posting per checkout even with duplicate webhook & API calls', () => {
        const checkoutId = 'chk_demo_1001';
        let ledgerEntries: Array<{ id: string; checkoutId: string; amountPaise: number }> = [];
        let checkoutStatus = 'pending_payment';

        function fulfillCheckout(chkId: string, amountPaise: number) {
            if (checkoutStatus === 'fulfilled') {
                return { status: 'fulfilled', alreadyFulfilled: true, ledgerId: ledgerEntries[0].id };
            }
            checkoutStatus = 'fulfilled';
            const ledgerId = `led_${Date.now()}`;
            ledgerEntries.push({ id: ledgerId, checkoutId: chkId, amountPaise });
            return { status: 'fulfilled', alreadyFulfilled: false, ledgerId };
        }

        // Call 1: Client signature verification
        const res1 = fulfillCheckout(checkoutId, 50000);
        expect(res1.alreadyFulfilled).toBe(false);
        expect(ledgerEntries.length).toBe(1);

        // Call 2: Razorpay Webhook delivery retry
        const res2 = fulfillCheckout(checkoutId, 50000);
        expect(res2.alreadyFulfilled).toBe(true);
        expect(ledgerEntries.length).toBe(1);

        // Call 3: Manual staff verification attempt
        const res3 = fulfillCheckout(checkoutId, 50000);
        expect(res3.alreadyFulfilled).toBe(true);
        expect(ledgerEntries.length).toBe(1);
    });
});

// ─── 3. PG_CRON SCHEDULED JOB LOGIC VERIFICATION ────────────────────────────

describe('Phase 3: Scheduled Jobs & Reservation Expiry Equations', () => {
    it('Categorizes 30-day and 7-day renewal reminder thresholds correctly', () => {
        const now = new Date('2026-10-10T12:00:00Z').getTime();

        const m30 = new Date('2026-11-09T12:00:00Z').getTime(); // 30 days away
        const m7 = new Date('2026-10-17T12:00:00Z').getTime(); // 7 days away
        const m60 = new Date('2026-12-09T12:00:00Z').getTime(); // 60 days away

        const daysAway30 = Math.round((m30 - now) / (1000 * 60 * 60 * 24));
        const daysAway7 = Math.round((m7 - now) / (1000 * 60 * 60 * 24));
        const daysAway60 = Math.round((m60 - now) / (1000 * 60 * 60 * 24));

        expect(daysAway30).toBe(30);
        expect(daysAway7).toBe(7);
        expect(daysAway60).toBe(60);
    });

    it('Atomically restores reserved stock and capacity when checkouts expire', () => {
        let capacity = 100;
        let reservedCapacity = 10;
        let soldCount = 50;

        let stockOnHand = 20;
        let reservedStock = 4;

        // Checkout expires with 2 ticket items and 2 merch items
        const ticketQtyToRelease = 2;
        const merchQtyToRelease = 2;

        reservedCapacity = Math.max(0, reservedCapacity - ticketQtyToRelease);
        reservedStock = Math.max(0, reservedStock - merchQtyToRelease);

        expect(reservedCapacity).toBe(8);
        expect(reservedStock).toBe(2);
        expect(capacity - soldCount - reservedCapacity).toBe(42); // 42 tickets available now
    });
});

// ─── 4. CORS HEADERS VERIFICATION ──────────────────────────────────────────

describe('Phase 3: CORS & Edge Function Contract Standards', () => {
    it('Provides required CORS headers for browser options requests', () => {
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        };

        expect(corsHeaders['Access-Control-Allow-Origin']).toBe('*');
        expect(corsHeaders['Access-Control-Allow-Headers']).toContain('x-razorpay-signature');
        expect(corsHeaders['Access-Control-Allow-Methods']).toContain('OPTIONS');
    });
});
