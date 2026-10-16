'use client'

import { useState } from 'react'
import { useRouter } from '@/lib/nav'
import { Star, Loader2, CheckCircle, ChevronDown, MessageSquare } from 'lucide-react'
import { INPUT, BTN_PRIMARY, BTN_FRAMED, CARD, CARD_LINE, SectionHeader, IconChip } from '@/components/ui'
import { HELP_SECTIONS } from '@/lib/helpContent'


/** One collapsible help section. Closed on arrival so the page opens as a contents list. */
function HelpSection({ section }) {
  const [open, setOpen] = useState(false)
  const Icon = section.icon
  return (
    <section className={CARD_LINE}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-subtle transition-colors"
      >
        <IconChip icon={Icon} className="w-8 h-8" iconClass="w-4 h-4" />
        <span className="text-sm font-semibold text-content">{section.title}</span>
        <ChevronDown className={`w-4 h-4 text-content-faint ml-auto shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3">
          {section.blocks.map((block, i) => <HelpBlock key={i} block={block} />)}
        </div>
      )}
    </section>
  )
}

/** One block inside a section. The shapes are documented in lib/helpContent.js. */
function HelpBlock({ block }) {
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

export default function FeedbackPage() {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!rating) {
      setError('Please select a rating')
      return
    }
    if (!message.trim()) {
      setError('Please write a message')
      return
    }
    setLoading(true)
    setError('')

    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, message: message.trim() }),
    })

    setLoading(false)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Failed to submit')
      return
    }

    setDone(true)
  }

  if (done) {
    return (
      <div className="max-w-sm px-4 sm:px-8 py-20 text-center">
        <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-content mb-2">Thank you!</h1>
        <p className="text-sm text-content-muted mb-6">Your feedback has been submitted.</p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button
            onClick={() => router.push('/dashboard')}
            className={`px-6 py-2.5 text-sm font-medium ${BTN_PRIMARY}`}
          >
            Back to dashboard
          </button>
          <button
            onClick={() => setDone(false)}
            className={`px-6 py-2.5 text-sm font-medium ${BTN_FRAMED}`}
          >
            Back to help
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl px-4 sm:px-8 py-8">
      <p className="text-sm text-content-muted mb-6">
        How the station portal works, and how to reach us when it does not.
      </p>

      {/* Accordions rather than one long scroll: nine sections read as a table of contents
          when closed, which is what makes a detailed page usable. Nothing is open by default,
          so the whole list is visible on arrival. */}
      <div className="space-y-2 mb-10">
        {HELP_SECTIONS.map((section) => (
          <HelpSection key={section.id} section={section} />
        ))}
      </div>

      <SectionHeader>Send feedback</SectionHeader>
      <p className="text-sm text-content-muted mb-6">
        Something broken, missing or confusing? Tell us. Your account comes attached, so there
        is no need to say which station you mean.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-content-strong mb-2">Rating</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHovered(n)}
                onMouseLeave={() => setHovered(0)}
                className="p-1"
              >
                <Star
                  className={`w-7 h-7 transition-colors ${
                    n <= (hovered || rating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-content-faint'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-content-strong mb-1">Message</label>
          <textarea
            rows={4}
            maxLength={1000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us what you think..."
            className={`${INPUT} resize-none`}
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className={`px-6 py-2.5 font-medium disabled:opacity-50 flex items-center gap-2 ${BTN_PRIMARY}`}
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Submit feedback
        </button>
      </form>
    </div>
  )
}
