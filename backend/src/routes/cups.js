import { Router } from 'express';
import { scrapeCups } from '../lib/scraper.js';
import { getDb } from '../db/database.js';

const router = Router();

// GET /api/cups
router.get('/', async (req, res) => {
  try {
    const { month, dows } = req.query;
    
    let targetMonth = month ? parseInt(month, 10) : null;
    let targetDows = dows ? dows.split(',').map(d => parseInt(d, 10)) : [];
    
    const db = getDb();
    const cacheKey = `cups_${targetMonth || 'all'}_${targetDows.join('')}`;
    
    // Ensure table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS api_cache (
        key VARCHAR(255) PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Check cache (valid for 24 hours)
    const cacheRes = await db.query('SELECT data, updated_at FROM api_cache WHERE key = $1', [cacheKey]);
    if (cacheRes.rows.length > 0) {
      const ageMinutes = (new Date() - new Date(cacheRes.rows[0].updated_at)) / 1000 / 60;
      if (ageMinutes < 24 * 60) {
        return res.json(cacheRes.rows[0].data);
      }
    }

    const result = await scrapeCups(targetMonth, targetDows);
    if (!result || !result.success) {
      return res.status(500).json({ error: 'Failed to scrape cups', details: result?.debugInfo });
    }

    // Save to cache
    await db.query(`
      INSERT INTO api_cache (key, data, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP
    `, [cacheKey, JSON.stringify(result.data)]);

    res.json(result.data);
  } catch (error) {
    console.error('Cups API Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
