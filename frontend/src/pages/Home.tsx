import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { searchBlogger, submitAnalysis, type BloggerResult } from '../lib/api'

function ManualMode() {
  const navigate = useNavigate()
  const [urls, setUrls] = useState('')
  const [bloggerName, setBloggerName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleManual() {
    if (!urls.trim() || !bloggerName.trim()) return
    setSubmitting(true)
    try {
      const resp = await fetch('/api/analyze/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blogger_name: bloggerName.trim(), urls: urls.trim().split('\n').filter(Boolean) }),
      })
      const data = await resp.json()
      if (data.task_id) navigate(`/progress/${data.task_id}`)
    } catch {
      alert('提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-3 bg-white rounded-xl border border-gray-100 p-4">
      <input
        type="text"
        value={bloggerName}
        onChange={e => setBloggerName(e.target.value)}
        placeholder="博主名称"
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <textarea
        value={urls}
        onChange={e => setUrls(e.target.value)}
        placeholder="每行粘贴一个微信文章链接&#10;https://mp.weixin.qq.com/s/..."
        rows={4}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <button
        onClick={handleManual}
        disabled={submitting || !urls.trim() || !bloggerName.trim()}
        className="w-full py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:bg-gray-300"
      >
        {submitting ? '提交中...' : '手动分析'}
      </button>
    </div>
  )
}
import { getHistory } from '../lib/storage'

const DATE_RANGES = [
  { value: '1w', label: '近1周' },
  { value: '2w', label: '近2周' },
  { value: '1m', label: '近1月' },
  { value: '3m', label: '近3月' },
  { value: '6m', label: '近6月' },
]

export default function Home() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<BloggerResult[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState('1m')
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const history = getHistory()

  async function handleSearch() {
    if (query.trim().length < 2) return
    setSearching(true)
    setError('')
    setResults([])
    setSelected(null)
    try {
      const res = await searchBlogger(query.trim())
      setResults(res)
      if (res.length === 0) setError('未找到匹配的公众号，请检查名称')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSearching(false)
    }
  }

  async function handleAnalyze() {
    const bloggerName = selected || query.trim()
    if (!bloggerName) return
    setSubmitting(true)
    setError('')
    try {
      const { task_id } = await submitAnalysis({
        blogger_name: bloggerName,
        date_range: dateRange,
        hold_days: 5,
      })
      navigate(`/progress/${task_id}`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">📊 博主验真</h1>
          <p className="text-gray-500">看清荐股博主的真实胜率</p>
        </div>

        {/* Search */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">🔍 输入公众号名称</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="如：XX财经"
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-base"
            />
            <button
              onClick={handleSearch}
              disabled={searching || query.trim().length < 2}
              className="px-5 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {searching ? '搜索中...' : '搜索'}
            </button>
          </div>

          {error && <p className="mt-3 text-red-500 text-sm">{error}</p>}

          {/* Search Results */}
          {results.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-gray-500">选择公众号：</p>
              {results.map((r, i) => (
                <button
                  key={i}
                  onClick={() => setSelected(r.name)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    selected === r.name
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-gray-100 hover:border-blue-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium text-gray-900">{r.name}</div>
                  {r.wechatId && <div className="text-xs text-gray-400">微信号：{r.wechatId}</div>}
                  {r.desc && <div className="text-sm text-gray-500 mt-1 line-clamp-2">{r.desc}</div>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Options */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">日期范围</label>
            <div className="flex gap-2">
              {DATE_RANGES.map(d => (
                <button
                  key={d.value}
                  onClick={() => setDateRange(d.value)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    dateRange === d.value
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>


        </div>

        {/* Submit */}
        <button
          onClick={handleAnalyze}
          disabled={submitting || (!selected && query.trim().length < 2)}
          className="w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl text-lg font-bold shadow-lg hover:shadow-xl disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all"
        >
          {submitting ? '提交中...' : '🔍 开始分析'}
        </button>

        {/* History */}
        {history.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-700">📁 历史分析</h2>
              <Link to="/history" className="text-sm text-blue-500 hover:underline">查看全部</Link>
            </div>
            <div className="space-y-2">
              {history.slice(0, 3).map(h => (
                <button
                  key={h.taskId}
                  onClick={() => navigate(`/report/${h.taskId}`)}
                  className="w-full text-left bg-white rounded-xl border border-gray-100 px-4 py-3 hover:border-blue-200 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{h.bloggerName}</span>
                    <span className={`text-sm font-bold ${(h.winRate ?? 0) >= 50 ? 'text-green-600' : 'text-red-500'}`}>
                      胜率 {h.winRate !== null ? `${h.winRate}%` : '—'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {h.totalRecs}只推荐 · {h.dateRange} · {new Date(h.createdAt).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Manual Mode */}
        <details className="mt-6">
          <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-600">
            🔗 搜不到？手动粘贴文章链接
          </summary>
          <ManualMode />
        </details>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-8">
          ⚠️ 本产品为客观数据统计工具，不构成投资建议
        </p>
      </div>
    </div>
  )
}
