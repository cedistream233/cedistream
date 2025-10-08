import { Router } from 'express';
import { supabase } from '../lib/supabase.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { user_email, payment_status } = req.query;
    if (!supabase) return res.json([]);
    let query = supabase.from('purchases').select('*');
    if (user_email) query = query.eq('user_email', user_email);
    if (payment_status) query = query.eq('payment_status', payment_status);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const payload = req.body;
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
    const { data, error } = await supabase.from('purchases').insert(payload).select('*').single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const patch = req.body;
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
    const { data, error } = await supabase.from('purchases').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

export default router;
