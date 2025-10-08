import { Router } from 'express';
import { supabase } from '../lib/supabase.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { orderBy = 'created_at', direction = 'desc' } = req.query;
    if (!supabase) return res.json([]);
    const { data, error } = await supabase.from('albums').select('*').order(orderBy, { ascending: direction !== 'desc' });
    if (error) throw error;
    res.json(data || []);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from('albums').select('*').eq('id', id).single();
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

export default router;
