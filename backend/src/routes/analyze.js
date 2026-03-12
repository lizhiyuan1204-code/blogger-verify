/**
 * 分析任务路由
 * POST /api/analyze - 提交分析任务
 * GET /api/analyze/:id/sse - SSE推送进度
 * GET /api/analyze/:id - 获取结果
 */
const express = require('express');
const router = express.Router();
const { v4: uuid } = require('uuid');
const db = require('../db');
const { searchArticles, resolveWxUrl } = require('../services/sogou');
const { scrapeArticle } = require('../services/scraper');
const { extractStocks } = require('../services/extractor');
const { calcReturn } = require('../services/market');
const { generateComment, calcDistribution } = require('../services/report');

// 活跃SSE连接
const sseClients = new Map();

function sendSSE(taskId, event, data) {
  const clients = sseClients.get(taskId) || [];
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach(res => res.write(msg));
}

// SSE日期范围映射
const DATE_RANGE_MAP = { '1w': '1', '2w': '2', '1m': '3', '3m': '3', '6m': '4' };

// POST /api/analyze - 提交分析任务
router.post('/', async (req, res) => {
  const { blogger_name, date_range = '3m', hold_days = 5 } = req.body;
  
  if (!blogger_name) {
    return res.status(400).json({ error: '缺少公众号名称' });
  }
  
  const taskId = uuid();
  const bloggerId = uuid();
  const shareId = uuid().slice(0, 8);
  
  // 创建博主和任务记录
  db.upsertBlogger.run(bloggerId, blogger_name, null, null, null);
  db.createTask.run(taskId, bloggerId, blogger_name, date_range, hold_days, shareId);
  
  res.json({ task_id: taskId, share_id: shareId });
  
  // 异步执行分析流程
  runAnalysis(taskId, bloggerId, blogger_name, date_range, hold_days).catch(err => {
    console.error(`Task ${taskId} failed:`, err.message);
    db.failTask.run(err.message, taskId);
    sendSSE(taskId, 'error', { message: err.message });
  });
});

// GET /api/analyze/:id/sse - SSE推送进度
router.get('/:id/sse', (req, res) => {
  const taskId = req.params.id;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  
  if (!sseClients.has(taskId)) sseClients.set(taskId, []);
  sseClients.get(taskId).push(res);
  
  // 发送当前状态
  const task = db.getTask.get(taskId);
  if (task) {
    sendSSE(taskId, 'progress', {
      phase: task.progress_phase || task.status,
      current: task.progress_current,
      total: task.progress_total,
    });
    
    if (task.status === 'done') {
      sendSSE(taskId, 'complete', { task_id: taskId, share_id: task.share_id });
    } else if (task.status === 'error') {
      sendSSE(taskId, 'error', { message: task.error_message });
    }
  }
  
  req.on('close', () => {
    const clients = sseClients.get(taskId) || [];
    sseClients.set(taskId, clients.filter(c => c !== res));
  });
});

// GET /api/analyze/:id - 获取结果
router.get('/:id', (req, res) => {
  const taskId = req.params.id;
  const task = db.getTask.get(taskId);
  
  if (!task) return res.status(404).json({ error: '任务不存在' });
  
  const stats = db.getTaskStats(taskId);
  const articles = db.getArticlesByTask.all(taskId);
  const distribution = calcDistribution(stats.recommendations);
  
  res.json({
    task,
    stats: {
      ...stats,
      distribution,
      recommendations: undefined, // 单独返回
    },
    articles,
    recommendations: stats.recommendations,
  });
});

/**
 * 执行分析流程
 */
async function runAnalysis(taskId, bloggerId, bloggerName, dateRange, holdDays) {
  // Phase 1: 爬取文章列表
  db.updateTaskStatus.run('crawling', 'crawl', 0, 0, null, null, taskId);
  sendSSE(taskId, 'progress', { phase: 'crawl', current: 0, total: 0 });
  
  const tsnRange = DATE_RANGE_MAP[dateRange] || '3';
  let allArticles = [];
  let page = 1;
  
  // 分页获取文章（最多3页）
  while (page <= 3) {
    const { articles, hasMore } = await searchArticles(bloggerName, tsnRange, page);
    allArticles = allArticles.concat(articles);
    if (!hasMore || articles.length === 0) break;
    page++;
    await sleep(1500); // 防限流
  }
  
  if (allArticles.length === 0) {
    throw new Error('未搜索到文章，请检查公众号名称是否正确');
  }
  
  // 去重
  allArticles = allArticles.filter((a, i, arr) =>
    arr.findIndex(b => b.title === a.title) === i
  );
  
  const totalArticles = allArticles.length;
  db.updateTaskStatus.run('crawling', 'crawl', 0, totalArticles, totalArticles, null, taskId);
  sendSSE(taskId, 'progress', { phase: 'crawl', current: 0, total: totalArticles });
  
  // Phase 2: 逐篇抓取+AI分析
  let stocksFound = 0;
  
  for (let i = 0; i < allArticles.length; i++) {
    const article = allArticles[i];
    const articleId = uuid();
    
    sendSSE(taskId, 'progress', {
      phase: 'analyze', current: i + 1, total: totalArticles,
      title: article.title, stocks_found: stocksFound,
    });
    
    try {
      // 获取微信URL：Google/必应直接有，搜狗需要跳转解析
      let wxUrl = article.wxUrl;
      if (!wxUrl && article.sogouUrl) {
        wxUrl = await resolveWxUrl(article.sogouUrl);
      }
      if (!wxUrl) {
        db.createArticle.run(articleId, taskId, bloggerId, '', article.title, null);
        db.updateArticle.run(0, 0, 'failed', articleId);
        continue;
      }
      
      // 抓取正文
      const { title, content, publishDate } = await scrapeArticle(wxUrl);
      
      db.createArticle.run(articleId, taskId, bloggerId, wxUrl, title || article.title, publishDate, 'pending');
      
      if (!content || content.length < 50) {
        db.updateArticle.run(0, 0, 'skipped', articleId);
        continue;
      }
      
      // AI提取推荐股票
      const stocks = await extractStocks(content, title || article.title);
      
      db.updateArticle.run(content.length, stocks.length, 'success', articleId);
      
      // 保存推荐记录
      for (const stock of stocks) {
        const recId = uuid();
        db.createRecommendation.run(
          recId, taskId, articleId, bloggerId,
          stock.stock_code, stock.stock_name,
          stock.direction, stock.strength,
          publishDate || null, stock.context, holdDays
        );
        stocksFound++;
      }
      
    } catch (e) {
      console.warn(`文章抓取失败 [${article.title}]:`, e.message);
      db.createArticle.run(articleId, taskId, bloggerId, article.sogouUrl, article.title, null);
      db.updateArticle.run(0, 0, 'failed', articleId);
    }
    
    db.updateTaskStatus.run('analyzing', 'analyze', i + 1, totalArticles, null, stocksFound, taskId);
    
    // 每篇间隔1-2秒
    await sleep(1000 + Math.random() * 1000);
  }
  
  // Phase 3: 查询行情计算收益
  const recs = db.getRecsByTask.all(taskId);
  sendSSE(taskId, 'progress', { phase: 'market', current: 0, total: recs.length });
  
  for (let i = 0; i < recs.length; i++) {
    const rec = recs[i];
    sendSSE(taskId, 'progress', { phase: 'market', current: i + 1, total: recs.length });
    
    try {
      if (rec.stock_code && rec.recommend_date) {
        const result = await calcReturn(rec.stock_code, rec.recommend_date, holdDays);
        db.updateRecommendationReturn.run(
          result.buyPrice, result.sellPrice,
          result.buyDate || null, result.sellDate || null,
          result.returnPct, result.status,
          rec.id
        );
      }
    } catch (e) {
      console.warn(`行情查询失败 [${rec.stock_name}]:`, e.message);
    }
    
    await sleep(300); // 行情接口间隔
  }
  
  // 完成
  db.completeTask.run(totalArticles, stocksFound, taskId);
  sendSSE(taskId, 'complete', { task_id: taskId, share_id: db.getTask.get(taskId)?.share_id });
  
  // 清理SSE连接
  setTimeout(() => sseClients.delete(taskId), 5000);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = router;
