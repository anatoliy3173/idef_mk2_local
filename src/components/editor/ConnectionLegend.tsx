import { ArrowRight } from 'lucide-react'
import type { ExampleStep } from '@/types/agentSystem'

interface AgentRef {
  id: string
  name: string
  number: number
}

interface ConnectionLegendProps {
  agentRefs: AgentRef[]
  exampleFlow?: ExampleStep[]
  orchestratorName: string
}

export function ConnectionLegend({ agentRefs, exampleFlow, orchestratorName }: ConnectionLegendProps) {
  if (!exampleFlow || exampleFlow.length === 0) return null

  const agentMap = new Map<string, AgentRef>(agentRefs.map((a: AgentRef) => [a.id, a]))

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-[14px] font-bold text-gray-700 uppercase tracking-wide">
          Workflow Flow
        </h3>
      </div>
      <div className="px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {exampleFlow
            .sort((a: ExampleStep, b: ExampleStep) => a.order - b.order)
            .map((step: ExampleStep, i: number) => {
              const agentRef = agentMap.get(step.agent)
              const isOrch = step.agent.startsWith('orch')
              const isUser = step.agent === 'user'

              let label: string
              let badgeColor: string

              if (isUser) {
                label = 'User'
                badgeColor = 'bg-slate-500'
              } else if (isOrch) {
                label = orchestratorName
                badgeColor = 'bg-purple-500'
              } else if (agentRef) {
                label = `#${agentRef.number} ${agentRef.name}`
                badgeColor = 'bg-blue-500'
              } else {
                label = step.agent
                badgeColor = 'bg-gray-500'
              }

              return (
                <div key={step.order} className="flex items-center gap-2">
                  {i > 0 && <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" />}
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] font-bold ${badgeColor}`}>
                      {step.order}
                    </span>
                    <span className="text-[13px] text-gray-700 font-medium whitespace-nowrap">
                      {label}
                    </span>
                  </div>
                </div>
              )
            })}
        </div>
        {/* Step descriptions */}
        <div className="mt-3 space-y-1">
          {exampleFlow
            .sort((a: ExampleStep, b: ExampleStep) => a.order - b.order)
            .map((step: ExampleStep) => (
              <div key={step.order} className="flex items-start gap-2 text-[12px]">
                <span className="text-gray-400 font-mono font-medium shrink-0 w-4 text-right">
                  {step.order}.
                </span>
                <span className="text-gray-500">{step.description}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
