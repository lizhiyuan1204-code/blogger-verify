-- 博主验真数据库 Schema

CREATE TABLE IF NOT EXISTS bloggers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  wechat_id TEXT,
  avatar_url TEXT,
  description TEXT,
  share_id TEXT UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  blogger_id TEXT REFERENCES bloggers(id),
  blogger_name TEXT NOT NULL,
  date_range TEXT NOT NULL,
  hold_days INTEGER DEFAULT 5,
  status TEXT DEFAULT 'pending',  -- pending/crawling/analyzing/market/done/error
  progress_phase TEXT,
  progress_current INTEGER DEFAULT 0,
  progress_total INTEGER DEFAULT 0,
  articles_found INTEGER DEFAULT 0,
  stocks_found INTEGER DEFAULT 0,
  error_message TEXT,
  share_id TEXT UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id),
  blogger_id TEXT REFERENCES bloggers(id),
  url TEXT,
  title TEXT,
  publish_date DATE,
  content_length INTEGER DEFAULT 0,
  stocks_found INTEGER DEFAULT 0,
  scrape_status TEXT DEFAULT 'pending',  -- pending/success/failed/skipped
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recommendations (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id),
  article_id TEXT REFERENCES articles(id),
  blogger_id TEXT REFERENCES bloggers(id),
  stock_code TEXT,
  stock_name TEXT,
  direction TEXT DEFAULT 'bullish',
  strength TEXT DEFAULT 'normal',
  recommend_date DATE,
  buy_price REAL,
  sell_price REAL,
  buy_date DATE,
  sell_date DATE,
  hold_days INTEGER,
  return_pct REAL,
  result TEXT DEFAULT 'pending',  -- win/lose/pending/delisted
  context TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_articles_task ON articles(task_id);
CREATE INDEX IF NOT EXISTS idx_articles_blogger ON articles(blogger_id);
CREATE INDEX IF NOT EXISTS idx_recs_task ON recommendations(task_id);
CREATE INDEX IF NOT EXISTS idx_recs_blogger ON recommendations(blogger_id);
CREATE INDEX IF NOT EXISTS idx_tasks_share ON tasks(share_id);
