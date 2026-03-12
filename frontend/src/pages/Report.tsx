import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getReport, type ReportData, type Recommendation } from '../lib/api'
import { addHistory } from '../lib/storage'

export default function Report() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!taskId) return
    getReport(taskId)
      .then(d => {
        setData(d)
        // 保存到历史
        addHistory({
          taskId,
          shareId: d.task.share_id,
          bloggerName: d.task.blogger_name,
          dateRange: d.task.date_range,
          holdDays: d.task.hold_days,
          winRate: d.stats.winRate,
          avgReturn: d.stats.avgReturn,
          totalRecs: d.stats.totalRecs,
          createdAt: d.task.created_at,
        })
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [taskId])

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin" /></div>
  if (error || !data) return <div className="min-h-screen flex items-center justify-center text-red-500">{error || '加载失败'}</div>

  const { task, stats, recommendations } = data
  const winRateColor = (stats.winRate ?? 0) >= 50 ? 'text-green-600' : 'text-red-500'

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600">
            ← 返回
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{task.blogger_name}</h1>
          <p className="text-sm text-gray-400">
            {task.articles_found}篇文章 · {stats.totalRecs}只推荐 · {task.date_range} · 持有{task.hold_days}天
          </p>
        </div>

        {/* Core Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center">
            <div className="text-sm text-gray-500 mb-1">胜率</div>
            <div className={`text-3xl font-bold ${winRateColor}`}>
              {stats.winRate !== null ? `${stats.winRate}%` : '—'}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center">
            <div className="text-sm text-gray-500 mb-1">平均收益</div>
            <div className={`text-3xl font-bold ${(stats.avgReturn ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {stats.avgReturn !== null ? `${stats.avgReturn > 0 ? '+' : ''}${stats.avgReturn}%` : '—'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <div className="text-xs text-gray-400">最佳推荐</div>
            <div className="text-sm font-bold text-green-600 mt-1">
              {stats.bestRec ? `${stats.bestRec.name} +${stats.bestRec.returnPct}%` : '—'}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <div className="text-xs text-gray-400">最差推荐</div>
            <div className="text-sm font-bold text-red-500 mt-1">
              {stats.worstRec ? `${stats.worstRec.name} ${stats.worstRec.returnPct}%` : '—'}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <div className="text-xs text-gray-400">最长连亏</div>
            <div className="text-sm font-bold text-gray-700 mt-1">{stats.maxLoseStreak}次</div>
          </div>
        </div>

        {/* Distribution */}
        {stats.distribution && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">收益分布</h3>
            {Object.entries(stats.distribution).map(([label, count]) => {
              const maxCount = Math.max(...Object.values(stats.distribution), 1)
              const pct = (count / maxCount) * 100
              const isPositive = label.startsWith('>') || (label.startsWith('0') && !label.includes('-'))
              return (
                <div key={label} className="flex items-center gap-3 mb-2">
                  <span className="text-xs text-gray-500 w-16 text-right">{label}</span>
                  <div className="flex-1 bg-gray-50 rounded-full h-5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isPositive ? 'bg-green-400' : 'bg-red-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 w-6">{count}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Timeline */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">推荐时间线</h3>
          <div className="space-y-3">
            {recommendations.map((rec, i) => (
              <RecCard key={i} rec={rec} />
            ))}
            {recommendations.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">暂无推荐记录</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => {
              const url = `${window.location.origin}/share/${task.share_id}`
              navigator.clipboard?.writeText(url)
              alert('分享链接已复制！')
            }}
            className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
          >
            📋 复制分享链接
          </button>
          <Link
            to="/"
            className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium text-center hover:bg-gray-200 transition-colors"
          >
            再查一个
          </Link>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          ⚠️ 以上数据为客观统计结果，不构成投资建议
        </p>
      </div>
    </div>
  )
}

function RecCard({ rec }: { rec: Recommendation }) {
  const isWin = rec.result === 'win'
  const isPending = rec.result === 'pending'

  return (
    <div className={`border rounded-xl p-3 ${isPending ? 'border-gray-100 bg-gray-50' : isWin ? 'border-green-100 bg-green-50' : 'border-red-100 bg-red-50'}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm">{isPending ? '⏳' : isWin ? '✅' : '❌'}</span>
          <span className="font-medium text-sm text-gray-900">{rec.stock_name}</span>
          <span className="text-xs text-gray-400">{rec.stock_code}</span>
        </div>
        {rec.return_pct !== null && (
          <span className={`text-sm font-bold ${rec.return_pct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {rec.return_pct > 0 ? '+' : ''}{rec.return_pct}%
          </span>
        )}
      </div>
      <div className="text-xs text-gray-400">
        {rec.recommend_date && <span>{rec.recommend_date} · </span>}
        {rec.article_title && <span>{rec.article_title}</span>}
      </div>
      {rec.context && <p className="text-xs text-gray-500 mt-1 italic">"{rec.context}"</p>}
    </div>
  )
}
