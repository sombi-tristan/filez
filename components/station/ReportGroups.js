'use client'

import { REPORT_COLUMNS } from '@/lib/stationNav'
import { SectionHeader, RowGroup, Row } from '@/components/ui'

/**
 * Every report, grouped by domain (lib/stationNav.js REPORT_SECTIONS): compact rows rather than
 * a wall of tiles, one RowGroup per group. From lg the groups run in the two columns declared in
 * REPORT_SECTIONS, so Sales and Stock read as a pair; below lg they stack in order. A report the
 * person may not open stays listed, dimmed, and explains itself on tap.
 *
 *   sections   REPORT_SECTIONS(stationId, group)
 *   canAccess  (pageKey) => may this person open it
 *   onBlocked  tapped a report they may not open
 */
export default function ReportGroups({ sections, canAccess, onBlocked }) {
  return (
    <div className="lg:grid lg:grid-cols-2 lg:gap-x-4 lg:items-start">
      {REPORT_COLUMNS.map((col) => (
        <div key={col}>
          {sections.filter((s) => s.column === col).map((section) => (
            <section key={section.title} className="mt-6 lg:mt-0 lg:mb-6">
              <SectionHeader>{section.title}</SectionHeader>
              <RowGroup>
                {section.items.map((link) => (
                  <Row
                    key={link.href}
                    href={link.href}
                    label={link.label}
                    desc={link.desc}
                    icon={link.icon}
                    allowed={canAccess(link.pageKey)}
                    onBlocked={onBlocked}
                  />
                ))}
              </RowGroup>
            </section>
          ))}
        </div>
      ))}
    </div>
  )
}
