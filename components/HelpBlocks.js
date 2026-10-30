'use client'

import { MessageSquare } from 'lucide-react'

/**
 * One block of help text, for the Help page's sections (lib/helpContent.js) and its walkthroughs
 * (lib/helpTopics.js). The shapes are documented in those two files.
 */
export function HelpBlock({ block }) {
  if (block.h) return <h3 className="pt-2 text-sm font-semibold text-content">{block.h}</h3>
  if (block.p) return <p className="text-sm text-content-strong leading-relaxed">{block.p}</p>
  if (block.list) {
    return (
      <ul className="list-disc ml-5 space-y-1.5">
        {block.list.map((item, i) => <li key={i} className="text-sm text-content-strong leading-relaxed">{item}</li>)}
      </ul>
    )
  }
  if (block.steps) {
    return (
      <ol className="list-decimal ml-5 space-y-1.5">
        {block.steps.map((item, i) => <li key={i} className="text-sm text-content-strong leading-relaxed">{item}</li>)}
      </ol>
    )
  }
  if (block.defs) {
    return (
      <dl className="space-y-2.5">
        {block.defs.map(([term, meaning], i) => (
          <div key={i}>
            <dt className="text-sm font-semibold text-content">{term}</dt>
            <dd className="text-sm text-content-muted leading-relaxed">{meaning}</dd>
          </div>
        ))}
      </dl>
    )
  }
  if (block.note) {
    return (
      <div className="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50">
        <MessageSquare className="w-4 h-4 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">{block.note}</p>
      </div>
    )
  }
  return null
}
