/**
 * 博主验真 - 后端入口
 */
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());

// 路由
app.use('/api/search', require('./routes/search'));
app.use('/api/analyze', require('./routes/analyze'));
app.use('/api/share', require('./routes/share'));

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`🚀 博主验真后端启动: http://localhost:${PORT}`);
  console.log(`📊 AI Provider: ${process.env.AI_PROVIDER || 'zhipu'}`);
});
