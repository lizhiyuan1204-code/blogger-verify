# 博主验真 — PRD

> H5独立产品 · v2.0 · 2026-03-12

---

## 为什么做这个？

**问题：** 散户关注了一堆荐股公众号，但不知道谁真的准。博主只晒盈利截图，亏的从不提。人工翻几百篇历史文章统计胜率，没人做得到。

**解法：** 用户输入公众号名称 + 选择日期范围 → 系统自动爬取该公众号的历史文章 → AI提取推荐股票 → 拉取真实行情计算收益 → 生成一张客观的"博主成绩单"。

---

## 成功标准

| 指标 | 目标 | 衡量方式 |
|------|------|---------|
| 文章爬取成功率 | >80% 的公众号能搜到文章 | 后端日志 |
| AI提取准确率 | >85% 的推荐股票被正确识别 | 人工抽检 |
| 单次分析耗时 | <2分钟（20篇文章） | 接口监控 |
| 自然分享率 | >15% | 分享点击/总PV |

核心北极星指标：**累计分析博主数**

---

## 不做什么（Out of Scope）

- ❌ 手动粘贴文章链接（太麻烦，用户体验差）
- ❌ 博主排行榜/公开排名（法律风险）
- ❌ 付费功能（MVP阶段免费验证需求）
- ❌ 用户注册/登录（H5用匿名ID，降低门槛）
- ❌ 自动订阅更新（二期再做）

---

## 用户流程

```
打开H5
  ↓
输入公众号名称（如"XX财经"）
  ↓
系统搜索匹配的公众号 → 用户确认选择
  ↓
选择日期范围（近1个月/3个月/6个月/1年）
  ↓
选择持有天数（1/3/5/10/20天，默认5天）
  ↓
[开始分析]
  ↓
实时显示进度：
  正在爬取文章列表... (3/25篇)
  正在分析《今日妖股推荐》... 发现3只推荐股
  正在查询行情数据...
  ↓
生成博主成绩单
  ↓
[分享成绩单] / [查看历史]
```

---

## 核心功能

### 1. 公众号搜索

**输入：** 公众号名称关键词

**流程：**
1. 用户输入名称（如"XX财经"）
2. 后端通过搜狗微信搜索（weixin.sogou.com）查找匹配的公众号
3. 返回匹配列表：公众号名称 + 简介 + 头像
4. 用户点击确认目标公众号

**搜索API：**
```
https://weixin.sogou.com/weixin?type=1&query={公众号名称}
```
- type=1 是搜索公众号
- type=2 是搜索文章

### 2. 文章爬取

**确认公众号后，自动爬取文章列表：**

1. 通过搜狗微信搜索该公众号的文章（type=2）
2. 按日期范围筛选
3. 逐篇抓取文章正文

**搜狗文章搜索：**
```
https://weixin.sogou.com/weixin?type=2&query={公众号名称}&tsn=1  (近1天)
https://weixin.sogou.com/weixin?type=2&query={公众号名称}&tsn=2  (近1周)
https://weixin.sogou.com/weixin?type=2&query={公众号名称}&tsn=3  (近1月)
https://weixin.sogou.com/weixin?type=2&query={公众号名称}&tsn=4  (近1年)
```

**降级方案：** 如果搜狗被限流或封锁：
- 备选1：提示用户手动粘贴文章链接（退回到手动模式）
- 备选2：接入第三方数据API（新榜等）

**爬取注意事项：**
- 每篇文章间隔1-2秒，避免被限流
- 设置合理的User-Agent
- 缓存已爬取的文章，重复分析不重复爬取
- 搜狗可能需要处理验证码 → 如遇到，提示用户稍后重试

### 3. AI分析

**对每篇文章：**
1. AI提取推荐股票（代码、名称、方向、力度、原文片段）
2. 只提取明确推荐/建议关注的股票，举例对比不算
3. 输出：`{stock_code, stock_name, direction, strength, context}`

**收益计算规则：**

| 项目 | 定义 |
|------|------|
| 买入价 | 推荐次日开盘价 |
| 卖出价 | 买入后第N个交易日收盘价 |
| 持有天数 | 用户可选 1/3/5/10/20 天，默认5 |
| 胜率 | 收益>0 的推荐数 / 总推荐数 |
| 平均收益 | 所有推荐的收益率算术平均 |

### 4. 博主成绩单

一屏展示：

**头部**
- 公众号名称、头像、已分析篇数、推荐股票总数、日期范围

**核心指标（大字）**
- 胜率（>50%绿色，<50%红色）
- 平均收益率
- 最佳/最差推荐
- 最长连亏、盈亏比

**收益分布（横向柱状图）**
- >10% / 5~10% / 0~5% / 0~-5% / -5~-10% / <-10%

**AI一句话评价**
- 3-5句客观评价：胜率水平、推荐风格、是否值得参考
- 100字以内，中性语气

**推荐时间线**
- 按时间倒序，每条：日期 + 文章标题 + 股票 + 收益 + ✅❌

**底部操作**
- [分享成绩单] [查看历史]

### 5. 历史记录

- localStorage存储，列出已分析过的博主
- 点击可查看历史成绩单

### 6. 分享

- 生成成绩单截图（canvas渲染）
- 支持保存到相册 / 复制链接
- 分享链接可直接查看成绩单（只读）

---

## 技术方案

### 技术栈

| 层 | 选型 | 理由 |
|----|------|------|
| 前端 | React + Tailwind CSS + Vite | 组件化，样式快 |
| 后端 | Node.js (Express) | 和前端同语言 |
| 爬虫 | axios + cheerio | 搜狗搜索 + 微信文章HTML解析 |
| AI | Gemini 2.0 Flash API | 便宜快，够用 |
| 行情 | 腾讯行情 qt.gtimg.cn | 免费稳定 |
| 数据库 | SQLite (better-sqlite3) | MVP够用，零运维 |
| 部署 | Vercel (前端) + Railway/Render (后端) | 免费额度足够 |

### 架构

```
React SPA (Vercel)
    ↓ HTTPS
Express API (Railway/Render)
    ├── /api/search          → 搜索公众号
    ├── /api/analyze         → 提交分析任务（公众号ID+日期范围）
    ├── /api/analyze/:id/sse → SSE推送进度
    ├── /api/analyze/:id     → 获取结果
    └── /api/share/:id       → 分享页数据
        ├── 搜狗微信搜索（公众号+文章列表）
        ├── 微信文章抓取（cheerio解析HTML）
        ├── AI提取（@google/generative-ai）
        └── 行情查询（axios → qt.gtimg.cn）
```

### 环境变量

```
GEMINI_API_KEY=xxx             # Gemini API密钥
DATABASE_URL=./data/db.sqlite  # SQLite路径
CORS_ORIGIN=https://xxx.vercel.app  # 前端域名
```

### API设计

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/search` | GET | 搜索公众号，参数：`?q=XX财经` |
| `/api/analyze` | POST | 提交分析任务 |
| `/api/analyze/:taskId/sse` | GET | SSE推送进度 |
| `/api/analyze/:taskId` | GET | 获取成绩单结果 |
| `/api/share/:shareId` | GET | 分享页数据 |

**提交分析请求：**
```json
POST /api/analyze
{
  "blogger_name": "XX财经",
  "blogger_id": "sogou_xxx",    // 搜狗搜索返回的ID
  "date_range": "3m",           // 1m/3m/6m/1y
  "hold_days": 5                // 1/3/5/10/20
}
```

**SSE进度推送：**
```
event: progress
data: {"phase":"crawl","current":3,"total":25,"title":"今日妖股推荐"}

event: progress
data: {"phase":"analyze","current":3,"total":25,"stocks_found":8}

event: progress
data: {"phase":"market","current":5,"total":8}

event: complete
data: {"task_id":"xxx","share_id":"yyy"}
```

### 数据存储

**后端（SQLite）：**

```sql
CREATE TABLE bloggers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_url TEXT,
  description TEXT,
  share_id TEXT UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE articles (
  id TEXT PRIMARY KEY,
  blogger_id TEXT REFERENCES bloggers(id),
  url TEXT,
  title TEXT,
  publish_date DATE,
  stocks_found INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE recommendations (
  id TEXT PRIMARY KEY,
  article_id TEXT REFERENCES articles(id),
  blogger_id TEXT REFERENCES bloggers(id),
  stock_code TEXT,
  stock_name TEXT,
  direction TEXT,         -- bullish/bearish/neutral
  strength TEXT,          -- strong/normal/mention
  recommend_date DATE,
  buy_price REAL,
  sell_price REAL,
  hold_days INTEGER,
  return_pct REAL,
  result TEXT,            -- win/lose/pending
  context TEXT,           -- 推荐原文片段
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 搜狗微信爬虫细节

**1. 搜索公众号**
```
GET https://weixin.sogou.com/weixin?type=1&query={name}
```
解析HTML提取：公众号名称、微信号、简介、头像、链接

**2. 搜索文章列表**
```
GET https://weixin.sogou.com/weixin?type=2&query={name}&tsn={时间范围}
```
解析HTML提取：文章标题、摘要、链接、发布时间
注意：搜狗返回的链接需要跳转才能拿到真实微信文章URL

**3. 抓取文章正文**
```
GET https://mp.weixin.qq.com/s/xxxxx
```
cheerio解析提取：标题、正文、发布日期

**4. 反爬对策**
- 请求间隔1-2秒
- 随机User-Agent
- 遇到验证码返回提示"搜索繁忙，请稍后重试"
- 已爬取的文章缓存到数据库，不重复爬取

---

## 异常处理

| 异常 | 处理 |
|------|------|
| 搜索不到公众号 | 提示"未找到，请检查名称" |
| 搜狗限流/验证码 | 提示"搜索繁忙，请稍后重试" |
| 文章无法访问 | 标记"抓取失败"，跳过继续 |
| 文章无推荐股票 | 标记"未发现推荐"，正常计入 |
| 股票已退市 | 标记"已退市"，不计入胜率 |
| 推荐日期太近 | 标记"待验证"，不计入统计 |

---

## 风险与应对

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| 搜狗封锁爬虫 | 高 | 无法搜索文章 | 降级到手动粘贴链接模式；接入第三方API |
| 搜狗文章覆盖不全 | 中 | 分析不完整 | 提示用户"搜索到X篇，可能不完整" |
| AI提取不准 | 中 | 胜率偏差 | 展示原文片段，支持用户修正 |
| 博主投诉 | 低 | 法律纠纷 | 只做客观统计，加免责声明 |

---

## 页面设计

### 首页

```
┌─────────────────────────┐
│     📊 博主验真          │
│   看清荐股博主的真实胜率  │
├─────────────────────────┤
│                         │
│  🔍 输入公众号名称       │
│  ┌─────────────────┐    │
│  │ XX财经           │    │  ← 搜索框，输入即搜
│  └─────────────────┘    │
│                         │
│  搜索结果：              │
│  ┌─────────────────┐    │
│  │ 🟢 XX财经        │    │  ← 点击选择
│  │ 每日荐股分析...   │    │
│  ├─────────────────┤    │
│  │ 🟢 XX财经Pro     │    │
│  │ 深度投资研究...   │    │
│  └─────────────────┘    │
│                         │
│  日期范围：              │
│  [1月] [3月✓] [6月] [1年]│
│                         │
│  持有天数：              │
│  [1] [3] [5✓] [10] [20] │
│                         │
│  [🔍 开始分析]           │
│                         │
├─────────────────────────┤
│  📁 历史分析             │
│  ┌─────────────────┐    │
│  │ XX财经  胜率43%  │    │
│  │ 32篇  近3个月    │    │
│  └─────────────────┘    │
└─────────────────────────┘
```

---

## 项目结构

```
blogger-verify/
├── frontend/              # React SPA
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.tsx          # 首页：搜索公众号
│   │   │   ├── Progress.tsx      # 分析进度（SSE）
│   │   │   ├── Report.tsx        # 博主成绩单
│   │   │   ├── History.tsx       # 历史记录
│   │   │   └── Share.tsx         # 分享页（只读）
│   │   ├── components/
│   │   │   ├── SearchBox.tsx     # 公众号搜索框
│   │   │   ├── BloggerCard.tsx   # 公众号搜索结果卡片
│   │   │   ├── StatsCard.tsx     # 核心指标卡片
│   │   │   ├── Distribution.tsx  # 收益分布图
│   │   │   ├── Timeline.tsx      # 推荐时间线
│   │   │   └── AIComment.tsx     # AI评价
│   │   └── lib/
│   │       ├── api.ts            # API请求封装
│   │       └── storage.ts        # localStorage封装
│   └── package.json
├── backend/               # Express API
│   ├── src/
│   │   ├── routes/
│   │   │   ├── search.ts        # 公众号搜索
│   │   │   ├── analyze.ts       # 分析任务
│   │   │   └── share.ts         # 分享
│   │   ├── services/
│   │   │   ├── sogou.ts         # 搜狗微信搜索+文章列表
│   │   │   ├── scraper.ts       # 微信文章正文抓取
│   │   │   ├── extractor.ts     # AI提取推荐股票
│   │   │   ├── market.ts        # 行情查询
│   │   │   └── report.ts        # 成绩单生成
│   │   └── db/
│   │       ├── schema.sql       # 建表语句
│   │       └── index.ts         # 数据库操作
│   └── package.json
└── README.md
```

---

## 里程碑

| 阶段 | 时间 | 交付物 | 验收标准 |
|------|------|--------|---------|
| PRD v2定稿 | 3/12 | 本文档 | ✅ |
| 后端MVP | 3/16 | 搜狗搜索+文章爬取+AI提取+行情 | 输入公众号名，能搜到并分析 |
| 前端MVP | 3/19 | H5页面：搜索→进度→成绩单 | 完整流程跑通 |
| 联调测试 | 3/21 | 端到端测试 | 10个真实博主验证通过 |
| 上线 | 3/23 | 部署+域名 | 可公开访问 |

---

## 后续可能（不在本期）

- 支持手动粘贴链接（搜狗搜不到时的降级方案）
- 自动定期更新博主成绩单
- 博主对比（同时查看两个博主）
- 推荐风格分析（偏什么板块、什么价位的票）
- 接入更多平台（雪球、同花顺社区等）

---

*⚠️ 免责声明：本产品为客观数据统计工具，不对任何博主做推荐或排名，统计结果仅供参考，不构成投资建议。*
