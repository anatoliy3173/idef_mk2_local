import { useState, useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { fetchGlobalUsageStats, type GlobalUsageStats } from '@/services/usageService'
import { Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function UsageIndicator() {
  const { setShowGenerateDialog, usageVersion } = useUIStore()
  const [stats, setStats] = useState<GlobalUsageStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetchGlobalUsageStats()
      .then((data: GlobalUsageStats) => {
        if (mounted) setStats(data)
      })
      .catch((_err: unknown) => {
        // Non-critical — UI falls back to showing "AI" without stats
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [usageVersion])

  function getColor(): string {
    if (!stats) return 'text-muted-foreground'
    const pct = stats.monthly.used / stats.monthly.limit
    if (pct >= 0.8) return 'text-red-600'
    if (pct >= 0.5) return 'text-amber-600'
    return 'text-green-600'
  }

  function getBgColor(): string {
    if (!stats) return 'bg-muted'
    const pct = stats.monthly.used / stats.monthly.limit
    if (pct >= 0.8) return 'bg-red-50 border-red-200 hover:bg-red-100'
    if (pct >= 0.5) return 'bg-amber-50 border-amber-200 hover:bg-amber-100'
    return 'bg-green-50 border-green-200 hover:bg-green-100'
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGenerateDialog(true)}
            className={`h-7 text-xs gap-1.5 ${stats ? getBgColor() : ''}`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#d97757]" />
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : stats ? (
              <span className={getColor()}>
                {stats.monthly.used}/{stats.monthly.limit}
              </span>
            ) : (
              <span>AI</span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="text-xs space-y-1">
            <p className="font-medium">AI Generation Quota</p>
            {stats ? (
              <>
                <p>Monthly: {stats.monthly.used}/{stats.monthly.limit}</p>
                <p>Daily: {stats.daily.used}/{stats.daily.limit}</p>
                <p>Your requests: {stats.user.monthlyUsed} this month</p>
              </>
            ) : (
              <p>Click to generate XML with AI</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
