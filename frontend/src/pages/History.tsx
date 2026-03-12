import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getHistory, clearHistory, type HistoryItem } from '../lib/storage'

export default function History() {
  const navigate = useNavigate()
  const [history, setHistory] = useState<HistoryItem[]>(getHistory())

  function handleClear() {
    if (confirm('确认清除所有历史记录？')) {
      clearHistory()
      setHistory([])
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-gray-400 hover:text-gray-600">← 返回</Link>
            <h1 className="text-xl font-bold text-gray-900">历史分析</h1>
          </div>
          {history.length > 0 && (
            <button onClick={handleClear} className="text-sm text-red-400 hover:text-red-600">
              清除全部
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-gray-400">还没有分析记录</p>
            <Link to="/" className="inline-block mt-4 px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600">
              去分析一个
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map(h => (
              <button
                key={h.taskId}
                onClick={() => navigate(`/report/${h.taskId}`)}
                className="w-full text-left bg-white rounded-2xl border border-gray-100 p-5 hover:border-blue-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold text-gray-900">{h.bloggerName}</span>
                  <span className={`text-lg font-bold ${(h.winRate ?? 0) >= 50 ? 'text-green-600' : 'text-red-500'}`}>
                    {h.winRate !== null ? `${h.winRate}%` : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>{h.totalRecs}只推荐</span>
                  <span>{h.dateRange}</span>
                  <span>持有{h.holdDays}天</span>
                  <span>{new Date(h.createdAt).toLocaleDateString()}</span>
                </div>
                {h.avgReturn !== null && (
                  <div className="mt-2 text-sm">
                    平均收益 <span className={`font-medium ${h.avgReturn >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {h.avgReturn > 0 ? '+' : ''}{h.avgReturn}%
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
