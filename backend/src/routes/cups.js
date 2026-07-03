import { Router } from 'express';
import { scrapeCups } from '../lib/scraper.js';

const router = Router();

// GET /api/cups
router.get('/', async (req, res) => {
  try {
    const { month, dows } = req.query;
    
    let targetMonth = month ? parseInt(month, 10) : null;
    let targetDows = dows ? dows.split(',').map(d => parseInt(d, 10)) : [];

    const result = await scrapeCups(targetMonth, targetDows);
    if (!result || !result.success) {
      return res.status(500).json({ error: 'Failed to scrape cups', details: result?.debugInfo });
    }

    res.json(result.data);
  } catch (error) {
    console.error('Cups API Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
