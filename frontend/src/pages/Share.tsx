import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getShareData, type Recommendation } from '../lib/api'

export default function Share() {
  const { shareId } = useParams<{ shareId: string }>()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!shareId) return
    getShareData(shareId)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [shareId])

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin" /></div>
  if (error || !data) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="text-5xl">😥</div>
      <p className="text-gray-500">{error || '分享不存在或已过期'}</p>
      <Link to="/" className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600">自己也查一个</Link>
    </div>
  )

  const winRateColor = (data.stats?.winRate ?? 0) >= 50 ? 'text-green-600' : 'text-red-500'

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Shared Badge */}
        <div className="text-center mb-4">
          <span className="inline-block px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-xs font-medium">
            📊 博主验真 · 分享成绩单
          </span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{data.blogger_name}</h1>
          <p className="text-sm text-gray-400">
            {data.articles?.length || 0}篇文章 · {data.stats?.totalRecs || 0}只推荐 · {data.date_range} · 持有{data.hold_days}天
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center">
            <div className="text-sm text-gray-500 mb-1">胜率</div>
            <div className={`text-3xl font-bold ${winRateColor}`}>
              {data.stats?.winRate !== null ? `${data.stats.winRate}%` : '—'}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center">
            <div className="text-sm text-gray-500 mb-1">平均收益</div>
            <div className={`text-3xl font-bold ${(data.stats?.avgReturn ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {data.stats?.avgReturn !== null ? `${data.stats.avgReturn > 0 ? '+' : ''}${data.stats.avgReturn}%` : '—'}
            </div>
          </div>
        </div>

        {/* Recommendations */}
        {data.recommendations?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">推荐记录</h3>
            <div className="space-y-2">
              {data.recommendations.map((rec: Recommendation, i: number) => {
                const isWin = rec.result === 'win'
                const isPending = rec.result === 'pending'
                return (
                  <div key={i} className={`border rounded-xl p-3 ${isPending ? 'border-gray-100' : isWin ? 'border-green-100 bg-green-50' : 'border-red-100 bg-red-50'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{isPending ? '⏳' : isWin ? '✅' : '❌'}</span>
                        <span className="font-medium text-sm">{rec.stock_name}</span>
                      </div>
                      {rec.return_pct !== null && (
                        <span className={`text-sm font-bold ${rec.return_pct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {rec.return_pct > 0 ? '+' : ''}{rec.return_pct}%
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* CTA */}
        <Link
          to="/"
          className="block w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl text-lg font-bold text-center shadow-lg hover:shadow-xl transition-all"
        >
          📊 我也来查一个
        </Link>

        <p className="text-center text-xs text-gray-400 mt-6">
          ⚠️ 以上数据为客观统计结果，不构成投资建议
        </p>
      </div>
    </div>
  )
}
