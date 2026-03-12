/**
 * 公众号搜索路由
 */
const express = require('express');
const router = express.Router();
const { searchBlogger } = require('../services/sogou');

// GET /api/search?q=XX财经
router.get('/', async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: '请输入至少2个字的公众号名称' });
  }
  
  try {
    const results = await searchBlogger(q.trim());
    res.json({ results });
  } catch (e) {
    console.error('搜索失败:', e.message);
    if (e.message.includes('RATE_LIMITED')) {
      return res.status(429).json({ error: '搜索繁忙，请稍后重试' });
    }
    res.status(500).json({ error: '搜索失败，请稍后重试' });
  }
});

module.exports = router;
