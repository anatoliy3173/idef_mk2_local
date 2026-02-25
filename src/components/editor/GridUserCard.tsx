import { MessageCircle } from 'lucide-react'
import type { UserJourney } from '@/types/agentSystem'

interface GridUserCardProps {
  userJourney?: UserJourney
}

export function GridUserCard({ userJourney }: GridUserCardProps) {
  return (
    <div className="bg-gradient-to-br from-slate-600 to-slate-500 text-white rounded-xl shadow-lg border border-slate-400/30 overflow-hidden">
      <div className="px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <MessageCircle className="w-4 h-4" />
          </div>
          <span className="font-bold text-lg">User Query</span>
        </div>
        {userJourney?.scenario && (
          <div className="mt-2 text-[13px] text-slate-200 leading-snug">
            {userJourney.scenario}
          </div>
        )}
        {userJourney?.expectedOutcome && (
          <div className="mt-1.5 text-[12px] text-slate-300">
            <span className="font-medium text-slate-200">Expected: </span>
            {userJourney.expectedOutcome}
          </div>
        )}
      </div>
    </div>
  )
}
