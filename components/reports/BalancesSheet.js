'use client'

import { ChevronRight } from 'lucide-react'
import { BottomSheet } from '@/design'
import { useRouter } from '@/lib/nav'

function fmt(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

/**
 * The Summary's credit balances at the end of the day, in a bottom sheet (buildDailyReport's
 * dayReport.balances). Tapping a customer opens their Account Ledger, that customer picked and
 * the range ending on the Summary's day, so the closing figure is the one tapped.
 */
export default function BalancesSheet({ open, onClose, balances, orgId, date }) {
  const router = useRouter()
  const openLedger = (id) => {
    onClose()
    router.push(`/dashboard/reports/account-ledger?org_id=${orgId}&account=${id}&to=${date}`)
  }
  return (
    <BottomSheet open={open} onClose={onClose} label="Balances">
      <div className="px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] max-h-[75vh] overflow-y-auto">
        <h3 className="text-base font-bold text-content mb-3">Balances</h3>
        <div className="flex text-xs font-semibold text-content-muted uppercase tracking-wide pb-2 border-b border-line">
          <span className="flex-1">Customer</span>
          <span className="w-28 text-right">Owes station</span>
          <span className="w-28 text-right">Station owes</span>
          <span className="w-5" />
        </div>
        {balances.rows.map((b) => (
          <button
            key={b.customerId}
            type="button"
            onClick={() => openLedger(b.customerId)}
            className="w-full flex items-center py-3 border-b border-line text-left text-sm hover:bg-subtle"
          >
            <span className="flex-1 min-w-0 truncate font-semibold text-content">{b.name}</span>
            <span className="w-28 text-right tabular-nums">{b.owesStation ? fmt(b.owesStation) : ''}</span>
            <span className="w-28 text-right tabular-nums">{b.stationOwes ? fmt(b.stationOwes) : ''}</span>
            <ChevronRight className="w-5 h-4 text-content-faint flex-shrink-0" />
          </button>
        ))}
        <div className="flex items-center pt-3 text-sm font-bold text-content">
          <span className="flex-1">Total</span>
          <span className="w-28 text-right tabular-nums">{fmt(balances.totalOwesStation)}</span>
          <span className="w-28 text-right tabular-nums">{fmt(balances.totalStationOwes)}</span>
          <span className="w-5" />
        </div>
      </div>
    </BottomSheet>
  )
}
