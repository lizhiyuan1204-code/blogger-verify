/**
 * 腾讯行情服务
 * 获取股票行情数据（开盘价、收盘价、历史数据）
 */
const axios = require('axios');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

/**
 * 获取股票实时行情
 * @param {string} code - 股票代码，如 600519
 * @returns {{code, name, price, open, close, high, low, change, changePct}}
 */
async function getQuote(code) {
  const prefix = getPrefix(code);
  const symbol = `${prefix}${code}`;
  
  const resp = await axios.get(`http://qt.gtimg.cn/q=${symbol}`, {
    headers: { 'User-Agent': UA },
    timeout: 10000,
    responseType: 'text',
  });
  
  const data = resp.data;
  const parts = data.split('~');
  
  if (parts.length < 40) {
    throw new Error(`无法获取 ${code} 行情`);
  }
  
  return {
    code,
    name: parts[1],
    price: parseFloat(parts[3]),
    prevClose: parseFloat(parts[4]),
    open: parseFloat(parts[5]),
    high: parseFloat(parts[33]),
    low: parseFloat(parts[34]),
    volume: parseFloat(parts[6]),
    change: parseFloat(parts[31]),
    changePct: parseFloat(parts[32]),
  };
}

/**
 * 获取股票历史日K线
 * @param {string} code - 股票代码
 * @param {number} days - 天数
 * @returns {Array<{date, open, close, high, low, volume}>}
 */
async function getKlines(code, days = 60) {
  const prefix = getPrefix(code);
  const symbol = `${prefix}${code}`;
  
  const resp = await axios.get(
    `http://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${symbol},day,,,${days},qfq`,
    { headers: { 'User-Agent': UA }, timeout: 10000 }
  );
  
  const data = resp.data?.data?.[symbol];
  const klines = data?.day || data?.qfqday || [];
  
  return klines.map(k => ({
    date: k[0],
    open: parseFloat(k[1]),
    close: parseFloat(k[2]),
    high: parseFloat(k[3]),
    low: parseFloat(k[4]),
    volume: k.length > 5 ? parseFloat(k[5]) : 0,
  }));
}

/**
 * 获取指定日期之后的开盘价和N日后收盘价
 * @param {string} code - 股票代码
 * @param {string} recommendDate - 推荐日期 YYYY-MM-DD
 * @param {number} holdDays - 持有天数
 * @returns {{buyPrice, sellPrice, returnPct, buyDate, sellDate}}
 */
async function calcReturn(code, recommendDate, holdDays = 5) {
  const klines = await getKlines(code, 120);
  
  // 找到推荐日期之后的第一个交易日（买入日）
  const recIdx = klines.findIndex(k => k.date > recommendDate);
  if (recIdx === -1) {
    return { buyPrice: null, sellPrice: null, returnPct: null, status: 'pending' };
  }
  
  const buyDate = klines[recIdx].date;
  const buyPrice = klines[recIdx].open; // 次日开盘价买入
  
  // 找到持有N个交易日后的收盘价
  const sellIdx = recIdx + holdDays - 1;
  if (sellIdx >= klines.length) {
    return { buyPrice, sellPrice: null, returnPct: null, buyDate, status: 'holding' };
  }
  
  const sellDate = klines[sellIdx].date;
  const sellPrice = klines[sellIdx].close;
  const returnPct = ((sellPrice - buyPrice) / buyPrice * 100).toFixed(2);
  
  return {
    buyPrice,
    sellPrice,
    returnPct: parseFloat(returnPct),
    buyDate,
    sellDate,
    status: parseFloat(returnPct) > 0 ? 'win' : 'lose',
  };
}

/**
 * 根据股票代码判断交易所前缀
 */
function getPrefix(code) {
  code = code.toString();
  if (code.startsWith('6')) return 'sh';
  if (code.startsWith('0') || code.startsWith('3')) return 'sz';
  if (code.startsWith('4') || code.startsWith('8')) return 'bj'; // 北交所
  return 'sz';
}

module.exports = { getQuote, getKlines, calcReturn };
