'use client'

import { useParams, Link } from '@/lib/nav'
import { HELP_TOPICS } from '@/lib/helpTopics'
import { HelpBlock } from '@/components/HelpBlocks'
import { SectionHeader } from '@/components/ui'

/**
 * One walkthrough from the Help page (lib/helpTopics.js): its demo video, the video's steps, then
 * the detailed explanation. Opened from the Help page's tiles, so Back returns to them.
 */
export default function HelpTopicPage() {
  const { topic: id } = useParams()
  const topic = HELP_TOPICS.find((t) => t.id === id)

  if (!topic) {
    return (
      <div className="max-w-3xl px-4 sm:px-8 py-8">
        <p className="text-sm text-content-muted mb-4">There is no walkthrough called &ldquo;{id}&rdquo;.</p>
        <Link href="/dashboard/feedback" className="text-sm font-medium text-primary-600">Back to help</Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl px-4 sm:px-8 py-6">
      <h1 className="text-lg font-bold text-content">{topic.title}</h1>
      <p className="text-sm text-content-muted mb-4">{topic.subtitle}</p>

      {/* The video is portrait (1080 x 1920): as wide as a phone allows, and never taller than
          most of the screen, so its controls stay in view. Only its first frame loads until play. */}
      <video
        key={topic.id}
        src={`/help/videos/${topic.id}.mp4`}
        poster={`/help/videos/${topic.id}.jpg`}
        controls
        playsInline
        preload="metadata"
        className="block mx-auto w-full max-w-sm max-h-[75vh] aspect-[9/16] bg-black rounded-house mb-6"
      />

      <SectionHeader>Steps</SectionHeader>
      <div className="mb-6">
        <HelpBlock block={{ steps: topic.steps }} />
      </div>

      <SectionHeader>In detail</SectionHeader>
      <div className="space-y-3">
        {topic.blocks.map((block, i) => <HelpBlock key={i} block={block} />)}
      </div>
    </div>
  )
}
