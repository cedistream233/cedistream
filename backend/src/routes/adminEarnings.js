import express from 'express';
import QueryStream from 'pg-query-stream';
import { getPool } from '../lib/database.js';
import { authenticateToken, requireRole } from '../lib/auth.js';

const router = express.Router();

// /api/admin/earnings-export?mode=daily|monthly|yearly&from=YYYY-MM-DD&to=ISO
router.get('/earnings-export', authenticateToken, requireRole(['admin']), async (req, res) => {
  let client;
  try {
    const { mode = 'daily', from, to } = req.query;
    const pool = getPool();
    client = await pool.connect();

    // Build period column depending on mode
    let periodExpr = "to_char(p.created_at, 'YYYY-MM-DD')"; // daily
    if (mode === 'monthly') periodExpr = "to_char(p.created_at, 'YYYY-MM')";
    if (mode === 'yearly') periodExpr = "to_char(p.created_at, 'YYYY')";

    // Base SQL: aggregate sums per period
    let sql = `
      SELECT ${periodExpr} AS period,
        COALESCE(SUM(p.amount),0) AS gross,
        COALESCE(SUM(p.platform_fee),0) AS platform_fee,
        COALESCE(SUM(p.paystack_fee),0) AS paystack_fee,
        COALESCE(SUM(p.platform_net),0) AS platform_net,
        COALESCE(SUM(p.creator_amount),0) AS creator_amount
      FROM purchases p
      WHERE p.payment_status = 'completed'
    `;
    const params = [];
    let idx = 1;
    if (from) {
      sql += ` AND p.created_at >= $${idx}`; params.push(from); idx++;
    }
    if (to) {
      sql += ` AND p.created_at <= $${idx}`; params.push(to); idx++;
    }
    sql += ` GROUP BY period ORDER BY period DESC`;

    const qs = new QueryStream(sql, params);
    const stream = client.query(qs);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="platform-earnings-${mode}.csv"`);
    // header
    res.write('Period,Gross (GHS),Platform fee (GHS),Paystack fee (GHS),Platform net (GHS),Creator amount (GHS)\n');

    const esc = v => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    stream.on('data', row => {
      const line = [row.period, parseFloat(row.gross).toFixed(2), parseFloat(row.platform_fee).toFixed(2), parseFloat(row.paystack_fee).toFixed(2), parseFloat(row.platform_net).toFixed(2), parseFloat(row.creator_amount).toFixed(2)].map(esc).join(',') + '\n';
      const ok = res.write(line);
      if (!ok) {
        stream.pause();
        res.once('drain', () => stream.resume());
      }
    });

    stream.on('end', () => {
      res.end();
      client.release();
    });
    stream.on('error', err => {
      console.error('admin earnings-export stream error', err);
      try { res.status(500).end(); } catch (e) {}
      client.release();
    });

  } catch (err) {
    console.error('admin earnings-export error', err);
    if (client) client.release();
    return res.status(500).json({ error: 'Failed to stream earnings' });
  }
});

export default router;
