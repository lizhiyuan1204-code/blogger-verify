/**
 * 分享路由
 * GET /api/share/:shareId - 获取分享页数据
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { calcDistribution } = require('../services/report');

router.get('/:shareId', (req, res) => {
  const task = db.getTaskByShare.get(req.params.shareId);
  if (!task) return res.status(404).json({ error: '分享不存在或已过期' });
  
  const stats = db.getTaskStats(task.id);
  const articles = db.getArticlesByTask.all(task.id);
  const distribution = calcDistribution(stats.recommendations);
  
  res.json({
    blogger_name: task.blogger_name,
    date_range: task.date_range,
    hold_days: task.hold_days,
    created_at: task.created_at,
    stats: {
      ...stats,
      distribution,
      recommendations: undefined,
    },
    articles: articles.map(a => ({ title: a.title, publish_date: a.publish_date, stocks_found: a.stocks_found })),
    recommendations: stats.recommendations.map(r => ({
      stock_name: r.stock_name,
      stock_code: r.stock_code,
      direction: r.direction,
      recommend_date: r.recommend_date,
      buy_price: r.buy_price,
      sell_price: r.sell_price,
      return_pct: r.return_pct,
      result: r.result,
      article_title: r.article_title,
      context: r.context,
    })),
  });
});

module.exports = router;
