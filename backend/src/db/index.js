/**
 * SQLite数据库操作
 */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DATABASE_URL || path.join(__dirname, '../../data/db.sqlite');

// 确保data目录存在
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);

// 启用WAL模式（性能更好）
db.pragma('journal_mode = WAL');

// 初始化schema
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

// === Tasks ===
const createTask = db.prepare(`
  INSERT INTO tasks (id, blogger_id, blogger_name, date_range, hold_days, status, share_id)
  VALUES (?, ?, ?, ?, ?, 'pending', ?)
`);

const updateTaskStatus = db.prepare(`
  UPDATE tasks SET status = ?, progress_phase = ?, progress_current = ?, progress_total = ?,
    articles_found = COALESCE(?, articles_found), stocks_found = COALESCE(?, stocks_found)
  WHERE id = ?
`);

const completeTask = db.prepare(`
  UPDATE tasks SET status = 'done', completed_at = CURRENT_TIMESTAMP,
    articles_found = ?, stocks_found = ?
  WHERE id = ?
`);

const failTask = db.prepare(`
  UPDATE tasks SET status = 'error', error_message = ? WHERE id = ?
`);

const getTask = db.prepare('SELECT * FROM tasks WHERE id = ?');
const getTaskByShare = db.prepare('SELECT * FROM tasks WHERE share_id = ?');

// === Bloggers ===
const upsertBlogger = db.prepare(`
  INSERT INTO bloggers (id, name, wechat_id, avatar_url, description)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET name=excluded.name, updated_at=CURRENT_TIMESTAMP
`);

const getBlogger = db.prepare('SELECT * FROM bloggers WHERE id = ?');

// === Articles ===
const createArticle = db.prepare(`
  INSERT INTO articles (id, task_id, blogger_id, url, title, publish_date, scrape_status)
  VALUES (?, ?, ?, ?, ?, ?, 'pending')
`);

const updateArticle = db.prepare(`
  UPDATE articles SET content_length = ?, stocks_found = ?, scrape_status = ? WHERE id = ?
`);

const getArticlesByTask = db.prepare('SELECT * FROM articles WHERE task_id = ? ORDER BY publish_date DESC');

// === Recommendations ===
const createRecommendation = db.prepare(`
  INSERT INTO recommendations (id, task_id, article_id, blogger_id, stock_code, stock_name,
    direction, strength, recommend_date, context, hold_days)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const updateRecommendationReturn = db.prepare(`
  UPDATE recommendations SET buy_price = ?, sell_price = ?, buy_date = ?, sell_date = ?,
    return_pct = ?, result = ?
  WHERE id = ?
`);

const getRecsByTask = db.prepare(`
  SELECT r.*, a.title as article_title
  FROM recommendations r
  LEFT JOIN articles a ON r.article_id = a.id
  WHERE r.task_id = ?
  ORDER BY r.recommend_date DESC
`);

// === 统计 ===
function getTaskStats(taskId) {
  const recs = getRecsByTask.all(taskId);
  const completed = recs.filter(r => r.result === 'win' || r.result === 'lose');
  const wins = completed.filter(r => r.result === 'win');
  
  const winRate = completed.length > 0 ? (wins.length / completed.length * 100).toFixed(1) : null;
  const avgReturn = completed.length > 0
    ? (completed.reduce((sum, r) => sum + (r.return_pct || 0), 0) / completed.length).toFixed(2)
    : null;
  
  const best = completed.length > 0
    ? completed.reduce((a, b) => (a.return_pct || 0) > (b.return_pct || 0) ? a : b)
    : null;
  const worst = completed.length > 0
    ? completed.reduce((a, b) => (a.return_pct || 0) < (b.return_pct || 0) ? a : b)
    : null;
  
  // 最长连亏
  let maxLoseStreak = 0, curStreak = 0;
  for (const r of completed.sort((a, b) => a.recommend_date?.localeCompare(b.recommend_date))) {
    if (r.result === 'lose') { curStreak++; maxLoseStreak = Math.max(maxLoseStreak, curStreak); }
    else { curStreak = 0; }
  }
  
  return {
    totalRecs: recs.length,
    completedRecs: completed.length,
    pendingRecs: recs.filter(r => r.result === 'pending').length,
    winRate: winRate ? parseFloat(winRate) : null,
    avgReturn: avgReturn ? parseFloat(avgReturn) : null,
    bestRec: best ? { name: best.stock_name, returnPct: best.return_pct } : null,
    worstRec: worst ? { name: worst.stock_name, returnPct: worst.return_pct } : null,
    maxLoseStreak,
    recommendations: recs,
  };
}

module.exports = {
  db,
  createTask, updateTaskStatus, completeTask, failTask, getTask, getTaskByShare,
  upsertBlogger, getBlogger,
  createArticle, updateArticle, getArticlesByTask,
  createRecommendation, updateRecommendationReturn, getRecsByTask,
  getTaskStats,
};
