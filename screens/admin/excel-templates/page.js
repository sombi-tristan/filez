'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  Loader2, Upload, Trash2, Download, Pencil, X, Check, FileSpreadsheet,
} from 'lucide-react'

function formatBytes(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

import { fmtDate as formatDate } from '@/lib/formatDate'
import { INPUT, CARD_LINE } from '@/components/ui'

// The design system has no solid fills; weight comes from how hard the outline is drawn.
const SOLID_ACTION = 'border-2 border-primary-600 dark:border-primary-400 bg-primary-500/20 text-primary-800 dark:text-primary-100 transition-all hover:bg-primary-500/30'

export default function ExcelTemplatesPage() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Upload state
  const [showUpload, setShowUpload] = useState(false)
  const [file, setFile] = useState(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef()

  // Edit state
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [saving, setSaving] = useState(false)

  // Delete state
  const [deletingId, setDeletingId] = useState(null)

  // Download state
  const [downloadingId, setDownloadingId] = useState(null)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/excel-templates')
    if (res.ok) {
      const data = await res.json()
      setTemplates(data.templates || [])
    } else {
      setError('Failed to load templates')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function resetUpload() {
    setFile(null)
    setName('')
    setDescription('')
    setUploadError('')
    setShowUpload(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleUpload(e) {
    e.preventDefault()
    if (!file) { setUploadError('Select an Excel file'); return }
    if (!name.trim()) { setUploadError('Template name is required'); return }

    const ext = file.name.split('.').pop().toLowerCase()
    if (!['xlsx', 'xls'].includes(ext)) {
      setUploadError('Only .xlsx and .xls files are allowed')
      return
    }

    setUploading(true)
    setUploadError('')

    try {
      const filePath = `templates/${Date.now()}_${file.name.replace(/\s+/g, '_')}`

      const { error: storageErr } = await supabase.storage
        .from('excel-templates')
        .upload(filePath, file, { contentType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

      if (storageErr) {
        setUploadError(storageErr.message || 'Upload failed')
        setUploading(false)
        return
      }

      const res = await fetch('/api/admin/excel-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        // Clean up orphan file in storage
        await supabase.storage.from('excel-templates').remove([filePath])
        setUploadError(data.error || 'Failed to save template')
        setUploading(false)
        return
      }

      resetUpload()
      load()
    } catch {
      setUploadError('Unexpected error. Please try again.')
    }
    setUploading(false)
  }

  async function handleDelete(id) {
    setDeletingId(id)
    const res = await fetch('/api/admin/excel-templates', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== id))
    }
    setDeletingId(null)
  }

  function startEdit(t) {
    setEditingId(t.id)
    setEditName(t.name)
    setEditDesc(t.description || '')
  }

  async function handleEdit(e) {
    e.preventDefault()
    if (!editName.trim()) return
    setSaving(true)
    const res = await fetch('/api/admin/excel-templates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId, name: editName, description: editDesc }),
    })
    if (res.ok) {
      const data = await res.json()
      setTemplates((prev) => prev.map((t) => t.id === editingId ? data.template : t))
      setEditingId(null)
    }
    setSaving(false)
  }

  async function handleDownload(t) {
    setDownloadingId(t.id)
    const res = await fetch(`/api/admin/excel-templates/download?id=${t.id}`)
    if (res.ok) {
      const { url, file_name } = await res.json()
      const a = document.createElement('a')
      a.href = url
      a.download = file_name
      a.click()
    }
    setDownloadingId(null)
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-end mb-4">
        {!showUpload && (
          <button
            onClick={() => setShowUpload(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${SOLID_ACTION}`}
          >
            <Upload className="w-4 h-4" />
            Upload template
          </button>
        )}
      </div>
      <p className="text-sm text-content-muted mb-6">
        Manage Excel report templates. Uploaded files are stored privately and available to admins only.
      </p>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}

      {/* Upload form */}
      {showUpload && (
        <div className={`p-4 mb-6 bg-subtle ${CARD_LINE}`}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-content">Upload new template</p>
            <button onClick={resetUpload} className="text-content-faint hover:text-content-muted">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleUpload} className="space-y-3">
            <div>
              <label className="block text-xs text-content-muted mb-1">Template name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Weekly Station Report"
                className={INPUT}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-content-muted mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                className={INPUT}
              />
            </div>
            <div>
              <label className="block text-xs text-content-muted mb-1">Excel file <span className="text-red-500">*</span></label>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setFile(e.target.files[0] || null)}
                className="w-full text-sm text-content-muted file:mr-3 file:py-1.5 file:px-3 file:border file:border-line file:rounded file:text-sm file:bg-surface file:text-content-strong hover:file:bg-subtle"
              />
              {file && (
                <p className="text-xs text-content-muted mt-1">{file.name} — {formatBytes(file.size)}</p>
              )}
            </div>
            {uploadError && <p className="text-sm text-red-600 dark:text-red-400">{uploadError}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={uploading}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm disabled:opacity-50 ${SOLID_ACTION}`}
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
              <button type="button" onClick={resetUpload} className="px-3 py-1.5 text-sm text-content-muted hover:text-content">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-content-faint" />
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-content-faint">
          <FileSpreadsheet className="w-10 h-10 mb-2" />
          <p className="text-sm">No templates uploaded yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-line">
          {templates.map((t) => (
            <div key={t.id} className="py-4">
              {editingId === t.id ? (
                <form onSubmit={handleEdit} className="space-y-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={INPUT}
                    autoFocus
                  />
                  <input
                    type="text"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="Description (optional)"
                    className={INPUT}
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className={`flex items-center gap-1 px-3 py-1.5 text-sm disabled:opacity-50 ${SOLID_ACTION}`}
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="p-1.5 text-content-faint hover:text-content-muted">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-content">{t.name}</p>
                    {t.description && (
                      <p className="text-xs text-content-muted mt-0.5">{t.description}</p>
                    )}
                    <p className="text-xs text-content-faint mt-0.5">
                      {t.file_name} · {formatBytes(t.file_size)} · {formatDate(t.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleDownload(t)}
                      disabled={downloadingId === t.id}
                      className="p-1.5 text-content-faint hover:text-primary-600 disabled:opacity-50"
                      title="Download"
                    >
                      {downloadingId === t.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Download className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => startEdit(t)}
                      className="p-1.5 text-content-faint hover:text-content-muted"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      disabled={deletingId === t.id}
                      className="p-1.5 text-content-faint hover:text-red-600 dark:text-red-400 disabled:opacity-50"
                      title="Delete"
                    >
                      {deletingId === t.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
