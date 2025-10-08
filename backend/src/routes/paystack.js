import { Router } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import { supabase } from '../lib/supabase.js';

dotenv.config();
const router = Router();
const PAYSTACK_BASE = 'https://api.paystack.co';

const paystack = axios.create({
  baseURL: PAYSTACK_BASE,
  headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY || ''}` },
});

router.post('/initialize', async (req, res, next) => {
  try {
    const { email, amount, reference, metadata } = req.body;
    const resp = await paystack.post('/transaction/initialize', {
      email,
      amount: Math.round(Number(amount) * 100),
      reference,
      metadata,
      callback_url: `${process.env.APP_URL || 'http://localhost:3000'}/checkout`,
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

    // Optional: Update purchase status in DB when successful
    if (status === 'success' && resp.data?.data?.metadata?.purchase_id) {
      const id = resp.data.data.metadata.purchase_id;
      await supabase.from('purchases').update({ payment_status: 'completed' }).eq('id', id);
    }

    res.json(resp.data);
  } catch (err) {
    if (err.response) return res.status(err.response.status).json(err.response.data);
    next(err);
  }
});

export default router;
