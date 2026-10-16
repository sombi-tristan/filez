'use client'

import { useState, useEffect, Fragment } from 'react'
import { Loader2, Plus, Trash2, Pencil, X, Fuel, Mail, UserPlus, FolderOpen, ChevronRight, ChevronDown, ExternalLink, Gift } from 'lucide-react'
import Modal from '@/components/Modal'
import Link from '@/lib/nav'
import SearchableSelect from '@/components/SearchableSelect'
import {
  OUTLINE, INPUT_BASE, INPUT_BARE, INPUT, BTN_FRAMED, CARD,
  REPORT_CARD, REPORT_HEAD, REPORT_LINE,
} from '@/components/ui'

// The design system has no solid fills; weight comes from how hard the outline is drawn.
const SOLID_ACTION = 'border-2 border-primary-600 dark:border-primary-400 bg-primary-500/20 text-primary-800 dark:text-primary-100 transition-all hover:bg-primary-500/30'

export default function AdminSettingsPage() {
  const [stations, setStations] = useState([])
  // Which station's management row is open. One at a time: the invite form and staff
  // list are tall, and several open at once turns the table back into the wall of
  // cards it replaced.
  const [expanded, setExpanded] = useState(null)
  // Grant subscription: { station } while the modal is open.
  const [grantFor, setGrantFor] = useState(null)
  const [grantMonths, setGrantMonths] = useState('1')
  const [granting, setGranting] = useState(false)
  const [grantError, setGrantError] = useState('')
  const [grantDone, setGrantDone] = useState('')
  const [loading, setLoading] = useState(true)

  // Add station
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  // Edit station
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)

  // Invites
  const [invites, setInvites] = useState({}) // { stationId: [invite, ...] }
  const [inviteEmail, setInviteEmail] = useState({}) // { stationId: 'email' }
  const [inviting, setInviting] = useState(null)

  // Busy guard for async actions (prevents double-click)
  const [busyAction, setBusyAction] = useState(null)

  // Groups
  const [groups, setGroups] = useState([])
  const [newGroup, setNewGroup] = useState('')
  const [addingGroup, setAddingGroup] = useState(false)
  const [groupError, setGroupError] = useState('')
  // { stationId, message }: an assignment failure belongs beside the row it happened on.
  const [assignError, setAssignError] = useState(null)

  const loadData = async () => {
    const [stationsRes, groupsRes] = await Promise.all([
      // Every station on the platform, not just the admin's own — this screen exists to
      // manage everyone's.
      fetch('/api/admin/stations'),
      fetch('/api/station-groups'),
    ])
    if (stationsRes.ok) {
      const data = await stationsRes.json()
      const stationList = data.stations || []
      setStations(stationList)

      // Load invites for all stations
      const allInvites = {}
      await Promise.all(stationList.map(async (s) => {
        const r = await fetch(`/api/invites/list?org_id=${s.id}`)
        if (r.ok) {
          const d = await r.json()
          allInvites[s.id] = d.invites || []
        }
      }))
      setInvites(allInvites)
    }
    if (groupsRes.ok) {
      const data = await groupsRes.json()
      setGroups(data.groups || [])
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const addStation = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)

    const res = await fetch('/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    })

    if (res.ok) {
      setNewName('')
      setShowAdd(false)
      loadData()
    }
    setAdding(false)
  }

  const updateStation = async (id) => {
    if (!editName.trim()) return
    setSaving(true)

    const res = await fetch('/api/organizations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: editName }),
    })

    if (res.ok) {
      setEditingId(null)
      loadData()
    }
    setSaving(false)
  }

  const deleteStation = async (id, name) => {
    if (busyAction) return
    if (!confirm(`Delete "${name}"? All staff accounts, subscriptions, and data for this station will be permanently removed.`)) return

    setBusyAction(`del-station-${id}`)
    try {
      await fetch('/api/organizations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      await loadData()
    } finally {
      setBusyAction(null)
    }
  }

  const addInvite = async (stationId) => {
    const email = inviteEmail[stationId]?.trim()
    if (!email) return
    setInviting(stationId)

    const res = await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: stationId, email }),
    })

    if (res.ok) {
      setInviteEmail((prev) => ({ ...prev, [stationId]: '' }))
      // Reload invites for this station
      const r = await fetch(`/api/invites/list?org_id=${stationId}`)
      if (r.ok) {
        const d = await r.json()
        setInvites((prev) => ({ ...prev, [stationId]: d.invites || [] }))
      }
    }
    setInviting(null)
  }

  const removeInvite = async (inviteId, stationId) => {
    if (busyAction) return
    setBusyAction(`rm-invite-${inviteId}`)
    try {
      await fetch('/api/invites', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: inviteId }),
      })
      const r = await fetch(`/api/invites/list?org_id=${stationId}`)
      if (r.ok) {
        const d = await r.json()
        setInvites((prev) => ({ ...prev, [stationId]: d.invites || [] }))
      }
    } finally {
      setBusyAction(null)
    }
  }

  const addGroup = async (e) => {
    e.preventDefault()
    if (!newGroup.trim()) return
    setAddingGroup(true)
    setGroupError('')
    const res = await fetch('/api/station-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newGroup }),
    })
    if (res.ok) {
      const data = await res.json()
      setGroups((prev) => [...prev, data.group].sort((a, b) => a.name.localeCompare(b.name)))
      setNewGroup('')
    } else {
      const data = await res.json().catch(() => ({}))
      setGroupError(data.error || 'Failed to add group')
    }
    setAddingGroup(false)
  }

  const removeGroup = async (id) => {
    if (busyAction) return
    if (!confirm('Delete this group? Stations in this group will be unassigned.')) return
    setBusyAction(`rm-group-${id}`)
    try {
      const deleted = groups.find((g) => g.id === id)
      const res = await fetch('/api/station-groups', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setGroups((prev) => prev.filter((g) => g.id !== id))
        // Mirrors ON DELETE SET NULL, which is what actually unsets them server-side now.
        if (deleted) {
          setStations((prev) => prev.map((s) =>
            s.station_group_id === deleted.id ? { ...s, station_group_id: null } : s
          ))
        }
      } else {
        const data = await res.json().catch(() => ({}))
        setGroupError(data.error || 'Failed to delete group')
      }
    } finally {
      setBusyAction(null)
    }
  }

  /**
   * Assign or clear a station's group.
   *
   * The optimistic update is kept, because the dropdown should not lag a round trip, but the
   * response is now checked and the previous value put back when the write fails. Previously
   * the result was ignored entirely, which is why an assignment that saved nothing still
   * looked like it had worked until the page was reloaded.
   */

  /**
   * Grant a station every service for a number of months, without payment.
   *
   * The list is refreshed afterwards rather than patched locally: the grant writes a
   * subscription, its items and a station message server-side, and guessing at that from here
   * would be a second, drifting copy of the same truth.
   */
  const grantSubscription = async () => {
    if (!grantFor) return
    setGranting(true)
    setGrantError('')
    const res = await fetch('/api/admin/grant-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: grantFor.id, months: Number(grantMonths) }),
    })
    const data = await res.json().catch(() => ({}))
    setGranting(false)
    if (!res.ok) {
      setGrantError(data.error || 'Failed to grant the subscription')
      return
    }
    setGrantFor(null)
    setGrantMonths('1')
    setGrantDone(data.message || 'Subscription granted.')
    loadData()
  }

  const assignGroup = async (stationId, groupId) => {
    const previous = stations.find((s) => s.id === stationId)?.station_group_id ?? null
    setAssignError(null)
    setStations((prev) => prev.map((s) =>
      s.id === stationId ? { ...s, station_group_id: groupId || null } : s
    ))

    const res = await fetch('/api/station-groups', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ station_id: stationId, group_id: groupId || null }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setStations((prev) => prev.map((s) =>
        s.id === stationId ? { ...s, station_group_id: previous } : s
      ))
      setAssignError({ stationId, message: data.error || 'Could not change the group. Try again.' })
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-content-faint" />
      </div>
    )
  }

  // Wide from lg: the stations table has seven columns, and the old max-w-2xl cap forced it
  // to scroll sideways on a desktop with room to spare. Blocks that are genuinely narrow (the
  // groups panel, the add-station form) keep their own width rather than stretching to fill it.
  return (
    <div className="max-w-2xl lg:max-w-6xl">
      {/* Station Groups */}
      <section className="mb-10 max-w-2xl">
        <h2 className="text-sm font-semibold text-content uppercase tracking-wide mb-3 flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-primary-600" /> Station Groups
        </h2>

        {groups.length > 0 && (
          <div className={`divide-y divide-line mb-4 ${CARD}`}>
            {groups.map((g) => (
              <div key={g.id} className="flex items-center justify-between px-3 py-2.5">
                <span className="text-sm text-content">{g.name}</span>
                <button onClick={() => removeGroup(g.id)} disabled={busyAction === `rm-group-${g.id}`} className="p-1 text-content-faint hover:text-red-600 dark:text-red-400 disabled:opacity-50" title="Delete group">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {groups.length === 0 && <p className="text-sm text-content-faint mb-4">No groups yet.</p>}

        <form onSubmit={addGroup} className="flex gap-2">
          <input
            type="text"
            placeholder="New group name"
            maxLength={100}
            value={newGroup}
            onChange={(e) => { setNewGroup(e.target.value); setGroupError('') }}
            className={`flex-1 ${INPUT_BASE}`}
          />
          <button
            type="submit"
            disabled={addingGroup || !newGroup.trim()}
            className={`flex items-center gap-1 px-3 py-2 text-sm font-medium disabled:opacity-50 ${SOLID_ACTION}`}
          >
            {addingGroup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add
          </button>
        </form>
        {groupError && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{groupError}</p>}
      </section>

      <div className="flex items-center justify-end mb-6">
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          <Plus className="w-4 h-4" /> Add station
        </button>
      </div>

      {/* Add station form */}
      {showAdd && (
        <form onSubmit={addStation} className={`p-4 mb-6 space-y-3 max-w-2xl ${CARD}`}>
          <input
            type="text"
            required
            maxLength={100}
            placeholder="Station name (e.g. MRS Lekki Phase 1)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className={INPUT}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={adding}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50 ${SOLID_ACTION}`}
            >
              {adding && <Loader2 className="w-4 h-4 animate-spin" />}
              Create station
            </button>
            <button type="button" onClick={() => { setShowAdd(false); setNewName('') }} className={`px-4 py-2 text-sm ${BTN_FRAMED}`}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Station list */}
      {grantDone && (
        <p className="text-sm text-green-700 dark:text-green-300 mb-3">{grantDone}</p>
      )}
      {/* A table, not a card per station: this screen exists to compare stations against each
          other, and stacked panels made that impossible. Uses the report chrome so it reads as
          the same furniture as every other dense table in the app. Management that cannot fit
          in a cell (the invite form, the staff list) lives in an expanding row beneath, one
          station at a time. */}
      {stations.length === 0 ? (
        <div className="text-center py-12">
          <Fuel className="w-10 h-10 text-content-faint mx-auto mb-3" />
          <p className="text-sm text-content-muted mb-1">No stations yet</p>
          <p className="text-xs text-content-faint">Add your first station to get started.</p>
        </div>
      ) : (
        <div className={`overflow-x-auto ${REPORT_CARD}`}>
          <table className="w-full text-sm">
            <thead className={REPORT_HEAD}>
              <tr>
                <th className="text-left font-semibold px-3 py-2">Station</th>
                <th className="text-left font-semibold px-3 py-2">Owner</th>
                <th className="text-left font-semibold px-3 py-2">Location</th>
                {groups.length > 0 && <th className="text-left font-semibold px-3 py-2">Group</th>}
                <th className="text-left font-semibold px-3 py-2">Status</th>
                <th className="text-right font-semibold px-3 py-2">Staff</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {stations.map((station) => {
                const staff = invites[station.id] || []
                const open = expanded === station.id
                return (
                  <Fragment key={station.id}>
                    <tr className={`border-t ${REPORT_LINE} hover:bg-subtle transition-colors`}>
                      <td className="px-3 py-2">
                        {editingId === station.id ? (
                          <div className="flex gap-2 items-center min-w-[16rem]">
                            <input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              maxLength={100}
                              autoFocus
                              className={`flex-1 ${INPUT_BASE}`}
                            />
                            <button onClick={() => updateStation(station.id)} disabled={saving} className={`px-3 py-1.5 text-sm disabled:opacity-50 ${SOLID_ACTION}`}>
                              Save
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-1.5 text-content-faint hover:text-content-muted">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setExpanded(open ? null : station.id)}
                            aria-expanded={open}
                            className="flex items-center gap-2 text-left min-w-0 group"
                          >
                            {open
                              ? <ChevronDown className="w-4 h-4 text-content-faint shrink-0" />
                              : <ChevronRight className="w-4 h-4 text-content-faint shrink-0" />}
                            <Fuel className="w-4 h-4 text-primary-600 dark:text-primary-300 shrink-0" />
                            <span className="font-semibold text-content truncate group-hover:underline">{station.name}</span>
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2 text-content-muted">{station.owner_name || '\u2014'}</td>
                      <td className="px-3 py-2 text-content-muted">{station.location || '\u2014'}</td>
                      {groups.length > 0 && (
                        <td className="px-3 py-2 min-w-[10rem]">
                          <SearchableSelect
                            value={station.station_group_id || ''}
                            onChange={(val) => assignGroup(station.id, val)}
                            options={[{ value: '', label: 'None' }, ...groups.map((g) => ({ value: g.id, label: g.name }))]}
                            placeholder="None"
                          />
                        </td>
                      )}
                      <td className="px-3 py-2 whitespace-nowrap">
                        {station.onboarding_complete ? (
                          <span className="text-xs font-medium text-green-700 dark:text-green-300">Ready</span>
                        ) : (
                          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Setup required</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-content-muted">{staff.length}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={station.onboarding_complete
                              ? `/dashboard/stations/${station.id}`
                              : `/dashboard/setup/${station.id}`}
                            className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium whitespace-nowrap ${OUTLINE} hover:bg-primary-500/20 hover:border-primary-600 dark:hover:border-primary-400`}
                          >
                            {station.onboarding_complete ? 'Open' : 'Run setup'}
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                          <button
                            onClick={() => { setGrantFor(station); setGrantMonths('1'); setGrantError(''); setGrantDone('') }}
                            title="Grant subscription"
                            className="p-1.5 text-content-faint hover:text-primary-600 dark:hover:text-primary-300"
                          >
                            <Gift className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => { setEditingId(station.id); setEditName(station.name) }}
                            title="Rename"
                            className="p-1.5 text-content-faint hover:text-content-muted"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {/* Delete goes through the owner-gated tenant route, so on someone
                              else's station it would silently do nothing. A button that appears
                              to work and does not is worse than no button, and admin-wide
                              station deletion is not something to open up by accident. */}
                          {station.is_mine !== false && (
                            <button
                              onClick={() => deleteStation(station.id, station.name)}
                              disabled={busyAction === `del-station-${station.id}`}
                              title="Delete"
                              className="p-1.5 text-content-faint hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {open && (
                      <tr className={`border-t ${REPORT_LINE} bg-subtle`}>
                        <td colSpan={groups.length > 0 ? 7 : 6} className="px-3 py-3">
                          {assignError?.stationId === station.id && (
                            <p className="text-xs text-red-600 dark:text-red-400 mb-2">{assignError.message}</p>
                          )}

                          <p className="text-xs font-medium text-content-strong mb-2 flex items-center gap-1">
                            <UserPlus className="w-3.5 h-3.5" /> Invite staff
                          </p>
                          <form
                            onSubmit={(e) => { e.preventDefault(); addInvite(station.id) }}
                            className="flex gap-2 mb-2 max-w-lg"
                          >
                            <div className="flex-1 relative">
                              <Mail className="w-3.5 h-3.5 text-content-faint absolute left-2.5 top-1/2 -translate-y-1/2" />
                              <input
                                type="email"
                                placeholder="staff@email.com"
                                maxLength={254}
                                value={inviteEmail[station.id] || ''}
                                onChange={(e) => setInviteEmail((prev) => ({ ...prev, [station.id]: e.target.value }))}
                                className={`w-full pl-8 pr-3 py-1.5 ${INPUT_BARE}`}
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={inviting === station.id || !inviteEmail[station.id]?.trim()}
                              className={`px-3 py-1.5 text-sm disabled:opacity-50 flex items-center gap-1 ${SOLID_ACTION}`}
                            >
                              {inviting === station.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                              Invite
                            </button>
                          </form>

                          {staff.length > 0 ? (
                            <div className="space-y-1 max-w-lg">
                              {staff.map((inv) => (
                                <div key={inv.id} className="flex items-center justify-between bg-surface px-3 py-1.5">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Mail className="w-3 h-3 text-content-faint shrink-0" />
                                    <span className="text-xs text-content-strong truncate">{inv.email}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                                      inv.status === 'accepted' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                                      inv.status === 'declined' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                                      'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                                    }`}>
                                      {inv.status}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => removeInvite(inv.id, station.id)}
                                    disabled={busyAction === `rm-invite-${inv.id}`}
                                    className="p-1 text-content-faint hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-content-faint">No staff invited yet.</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Grant subscription. Says plainly what it does, because it bypasses payment entirely
          and the admin should not have to infer that from a duration box. */}
      <Modal
        open={!!grantFor}
        onClose={() => { if (!granting) { setGrantFor(null); setGrantError('') } }}
        title="Grant subscription"
      >
        {grantFor && (
          <div className="space-y-4">
            <p className="text-sm text-content-muted">
              Give <span className="font-semibold text-content">{grantFor.name}</span> every
              service free of charge. No payment is taken and nothing needs approving: the
              station is active as soon as you confirm, and its owner is told.
            </p>

            <div>
              <label htmlFor="grant-months" className="block text-sm font-semibold text-content mb-1.5">
                Months
              </label>
              <input
                id="grant-months"
                type="number"
                min={1}
                max={24}
                value={grantMonths}
                onChange={(e) => { setGrantMonths(e.target.value); setGrantError('') }}
                className={INPUT}
              />
              <p className="text-xs text-content-muted mt-1">Between 1 and 24.</p>
            </div>

            {grantError && <p className="text-sm text-red-600 dark:text-red-400">{grantError}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => { setGrantFor(null); setGrantError('') }}
                disabled={granting}
                className={`flex-1 py-2 text-sm font-medium disabled:opacity-50 ${BTN_FRAMED}`}
              >
                Cancel
              </button>
              <button
                onClick={grantSubscription}
                disabled={granting}
                className={`flex-1 py-2 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${SOLID_ACTION}`}
              >
                {granting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                Grant
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
