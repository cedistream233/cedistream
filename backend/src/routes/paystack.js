import { Router } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { query } from '../lib/database.js';

dotenv.config();
const router = Router();
const PAYSTACK_BASE = 'https://api.paystack.co';

const paystack = axios.create({
  baseURL: PAYSTACK_BASE,
  headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY || ''}` },
});

router.post('/initialize', async (req, res, next) => {
  try {
    // Supports initializing a transaction for one item or multiple cart items
    // Body: { email, user_id, items: [{item_type,item_id,item_title,amount}], currency, reference? }
    const { email, user_id, items, amount, reference, currency = 'GHS', metadata = {}, payment_method } = req.body || {};

    if (!email && !user_id) return res.status(400).json({ error: 'email or user_id is required' });
    let cartItems = Array.isArray(items) ? items : null;
    if (!cartItems && amount) {
      // fallback to a single-amount without item breakup (not recommended)
      cartItems = [{ item_type: metadata?.item_type || 'custom', item_id: metadata?.item_id || null, item_title: metadata?.item_title || 'Purchase', amount: Number(amount) }];
    }
    if (!cartItems || !cartItems.length) return res.status(400).json({ error: 'items array is required' });

    // Validate items and enforce minimums where possible
    for (const it of cartItems) {
      if (!it?.item_type || !it?.item_id || !Number.isFinite(Number(it?.amount))) {
        return res.status(400).json({ error: 'Each item must include item_type, item_id and numeric amount' });
      }
      let minPrice = 0;
      if (it.item_type === 'album') {
        const r = await query('SELECT price FROM albums WHERE id = $1', [it.item_id]);
        if (!r.rows.length) return res.status(404).json({ error: `Album not found: ${it.item_id}` });
        minPrice = parseFloat(r.rows[0].price || 0);
      } else if (it.item_type === 'video') {
        const r = await query('SELECT price FROM videos WHERE id = $1', [it.item_id]);
        if (!r.rows.length) return res.status(404).json({ error: `Video not found: ${it.item_id}` });
        minPrice = parseFloat(r.rows[0].price || 0);
      } else if (it.item_type === 'song') {
        const r = await query('SELECT price FROM songs WHERE id = $1', [it.item_id]);
        if (!r.rows.length) return res.status(404).json({ error: `Song not found: ${it.item_id}` });
        minPrice = parseFloat(r.rows[0].price || 0);
      }
      if (Number(it.amount) < minPrice) {
        return res.status(400).json({ error: `Amount for ${it.item_title || it.item_id} must be at least GH₵ ${minPrice.toFixed(2)}` });
      }
    }

    const total = cartItems.reduce((s, it) => s + Number(it.amount || 0), 0);
    if (!Number.isFinite(total) || total <= 0) return res.status(400).json({ error: 'Total amount must be > 0' });

    const ref = reference || `CDS_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    // Create/Upsert purchase rows (pending) for each item with shared reference
    const createdIds = [];
    for (const it of cartItems) {
      const title = it.item_title || 'Untitled';
      const amt = Number(it.amount);
      // fee breakdown for recording at intent time (final will be recomputed on success)
      const platformFee = +(amt * 0.20).toFixed(2);
      const paystackFee = +(amt * 0.02).toFixed(2);
      const platformNet = +(platformFee - paystackFee).toFixed(2);
      const creatorAmount = +(amt * 0.80).toFixed(2);

      const ins = await query(
        `INSERT INTO purchases (user_id, item_type, item_id, item_title, amount, currency, payment_status, payment_reference, payment_method, gateway, platform_fee, paystack_fee, platform_net, creator_amount)
         VALUES ($1,$2,$3,$4,$5,$6,'pending',$7, $8, 'paystack', $9, $10, $11, $12)
         ON CONFLICT (user_id, item_type, item_id, payment_reference) DO NOTHING
         RETURNING id`,
        [user_id || null, it.item_type, it.item_id, title, amt, currency, ref, payment_method || null, platformFee, paystackFee, platformNet, creatorAmount]
      );
      if (ins?.rows?.[0]?.id) createdIds.push(ins.rows[0].id);
    }

    const enrichedMeta = {
      ...metadata,
      reference: ref,
      user_id: user_id || null,
      items: cartItems,
      purchase_ids: createdIds
    };

    // Build callback URL to the frontend without requiring APP_URL; prefer client-provided/base origin
    const baseFromClient = (req.body?.callback_base_url || req.headers.origin || '').toString().replace(/\/$/, '');
    const base = baseFromClient || (process.env.APP_URL ? String(process.env.APP_URL).replace(/\/$/, '') : 'http://localhost:3000');
  const callback_url = `${base}/purchase/success`;

    const resp = await paystack.post('/transaction/initialize', {
      email,
      amount: Math.round(Number(total) * 100),
      reference: ref,
      metadata: enrichedMeta,
      callback_url,
      channels: ['card', 'mobile_money']
    });
    res.json(resp.data);
  } catch (err) {
    if (err.response) return res.status(err.response.status).json(err.response.data);
    next(err);
  }
});

router.get('/verify/:reference', async (req, res, next) => {
  try {
    const { reference } = req.params;
    const resp = await paystack.get(`/transaction/verify/${reference}`);
    const status = resp.data?.data?.status;

    if (status === 'success') {
      // Update all purchases with this reference to completed with fee breakdowns
      const tx = resp.data?.data || {};
      const ref = tx.reference;
      const amountKobo = tx.amount; // kobo/pesewas
      const totalAmount = Number(amountKobo) / 100;

      // Load purchases by reference
      const pRes = await query('SELECT * FROM purchases WHERE payment_reference = $1', [ref]);
      const rows = pRes.rows || [];

      if (rows.length > 0) {
        // Distribute paystack fee proportional to item amounts
        const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
        const paystackFeeTotal = +(total * 0.02).toFixed(2);
        for (const r of rows) {
          const amt = Number(r.amount || 0);
          const share = total > 0 ? amt / total : 0;
          const platformFee = +(amt * 0.20).toFixed(2);
          const paystackFee = +(paystackFeeTotal * share).toFixed(2);
          const platformNet = +(platformFee - paystackFee).toFixed(2);
          const creatorAmount = +(amt * 0.80).toFixed(2);
          await query(
            `UPDATE purchases SET payment_status = 'completed', gateway_data = $2, paystack_fee = $3, platform_fee = $4, platform_net = $5, creator_amount = $6, updated_at = NOW()
             WHERE id = $1`,
            [r.id, tx, paystackFee, platformFee, platformNet, creatorAmount]
          );

          // Optional: increment creator earnings and sales
          let creatorId = null;
          if (r.item_type === 'song') {
            const c = await query('SELECT user_id FROM songs WHERE id = $1', [r.item_id]);
            creatorId = c.rows?.[0]?.user_id || null;
          } else if (r.item_type === 'video') {
            const c = await query('SELECT user_id FROM videos WHERE id = $1', [r.item_id]);
            creatorId = c.rows?.[0]?.user_id || null;
          } else if (r.item_type === 'album') {
            const c = await query('SELECT user_id FROM albums WHERE id = $1', [r.item_id]);
            creatorId = c.rows?.[0]?.user_id || null;
          }
          if (creatorId) {
            await query(
              `UPDATE creator_profiles SET total_earnings = COALESCE(total_earnings,0) + $2, total_sales = COALESCE(total_sales,0) + 1, updated_at = NOW()
               WHERE user_id = $1`,
              [creatorId, creatorAmount]
            );
          }
        }
      }

      res.json({ ok: true, data: resp.data?.data });
      return;
    }

    res.status(400).json(resp.data);
  } catch (err) {
    if (err.response) return res.status(err.response.status).json(err.response.data);
    next(err);
  }
});

// Exportable webhook handler to be mounted with raw body parser in server.js
export async function paystackWebhookHandler(req, res) {
  try {
    const signature = req.headers['x-paystack-signature'];
    const secret = process.env.PAYSTACK_SECRET_KEY || '';
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));
    const computed = crypto.createHmac('sha512', secret).update(raw).digest('hex');
    if (signature !== computed) return res.status(401).send('Invalid signature');

    const payload = JSON.parse(raw.toString('utf8'));
    const event = payload?.event;
    const data = payload?.data;
    if (event === 'charge.success' && data?.reference) {
      const ref = data.reference;
      const pRes = await query('SELECT id, payment_status FROM purchases WHERE payment_reference = $1', [ref]);
      const anyCompleted = pRes.rows.some(r => r.payment_status === 'completed');
      if (!anyCompleted) {
        const totalRowsRes = await query('SELECT * FROM purchases WHERE payment_reference = $1', [ref]);
        const rows = totalRowsRes.rows || [];
        const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
        const paystackFeeTotal = +(total * 0.02).toFixed(2);
        for (const r of rows) {
          const amt = Number(r.amount || 0);
          const share = total > 0 ? amt / total : 0;
          const platformFee = +(amt * 0.20).toFixed(2);
          const paystackFee = +(paystackFeeTotal * share).toFixed(2);
          const platformNet = +(platformFee - paystackFee).toFixed(2);
          const creatorAmount = +(amt * 0.80).toFixed(2);
          await query(
            `UPDATE purchases SET payment_status = 'completed', gateway_data = $2, paystack_fee = $3, platform_fee = $4, platform_net = $5, creator_amount = $6, updated_at = NOW()
             WHERE id = $1`,
            [r.id, data, paystackFee, platformFee, platformNet, creatorAmount]
          );
        }
      }
    }
    res.json({ received: true });
  } catch (e) {
    console.error('Paystack webhook error', e);
    res.status(500).json({ error: 'webhook error' });
  }
}

export default router;
