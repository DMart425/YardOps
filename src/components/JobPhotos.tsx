'use client'

import { useState, useTransition } from 'react'
import { uploadJobPhoto, deleteJobPhoto } from '@/app/(protected)/jobs/photo-actions'

interface Photo {
  id: string
  signed_url: string
  kind: string
  caption: string | null
  created_at: string
}

export function JobPhotos({ jobId, photos }: { jobId: string; photos: Photo[] }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<Photo | null>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>, kind: 'before' | 'after') {
    const files = e.target.files
    if (!files || files.length === 0) return
    setError(null)

    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('photo', file)
      fd.append('kind', kind)
      try {
        await uploadJobPhoto(jobId, fd)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
      }
    }
    // reset input so the same file can be selected again
    e.target.value = ''
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this photo?')) return
    startTransition(async () => {
      try {
        await deleteJobPhoto(id, jobId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Delete failed')
      }
    })
  }

  const before = photos.filter(p => p.kind === 'before')
  const after = photos.filter(p => p.kind === 'after')
  const other = photos.filter(p => p.kind !== 'before' && p.kind !== 'after')
  const [compareMode, setCompareMode] = useState(false)
  const canCompare = before.length > 0 && after.length > 0

  return (
    <div>
      {error && <div className="alert alert-error" style={{ marginBottom: '8px' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <label className="btn btn-sm btn-secondary" style={{ flex: 1, textAlign: 'center', cursor: 'pointer' }}>
          📷 Before
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            style={{ display: 'none' }}
            onChange={e => handleUpload(e, 'before')}
            disabled={pending}
          />
        </label>
        <label className="btn btn-sm btn-primary" style={{ flex: 1, textAlign: 'center', cursor: 'pointer' }}>
          📸 After
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            style={{ display: 'none' }}
            onChange={e => handleUpload(e, 'after')}
            disabled={pending}
          />
        </label>
      </div>

      {photos.length === 0 ? (
        <p className="text-small text-muted" style={{ textAlign: 'center', padding: '12px 0' }}>
          No photos yet. Tap a button above to add one.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {canCompare && (
            <button
              type="button"
              onClick={() => setCompareMode(m => !m)}
              className="btn btn-sm btn-secondary"
            >
              {compareMode ? '↩ Show All' : '⇔ Compare Before / After'}
            </button>
          )}

          {compareMode && canCompare ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {(['Before', 'After'] as const).map(label => {
                const photo = label === 'Before' ? before[before.length - 1] : after[after.length - 1]
                return (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div className="text-small text-muted" style={{ textAlign: 'center', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.signed_url}
                      alt={label}
                      onClick={() => setLightbox(photo)}
                      style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 'var(--r-sm)', cursor: 'pointer' }}
                    />
                  </div>
                )
              })}
            </div>
          ) : (
            <>
              {before.length > 0 && <PhotoGrid title="Before" photos={before} onDelete={handleDelete} onOpen={setLightbox} />}
              {after.length > 0 && <PhotoGrid title="After" photos={after} onDelete={handleDelete} onOpen={setLightbox} />}
              {other.length > 0 && <PhotoGrid title="Other" photos={other} onDelete={handleDelete} onOpen={setLightbox} />}
            </>
          )}
        </div>
      )}

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox.signed_url} alt={lightbox.caption ?? ''} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}

function PhotoGrid({ title, photos, onDelete, onOpen }: { title: string; photos: Photo[]; onDelete: (id: string) => void; onOpen: (p: Photo) => void }) {
  return (
    <div>
      <div className="text-small text-muted" style={{ marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.75rem' }}>{title} ({photos.length})</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: '6px' }}>
        {photos.map(p => (
          <div key={p.id} style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', borderRadius: 'var(--r-sm)', background: 'var(--color-surface)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.signed_url}
              alt={p.caption ?? ''}
              onClick={() => onOpen(p)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
            />
            <button
              type="button"
              onClick={() => onDelete(p.id)}
              style={{
                position: 'absolute', top: '4px', right: '4px',
                background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none',
                borderRadius: '50%', width: '24px', height: '24px',
                fontSize: '14px', lineHeight: '1', cursor: 'pointer',
              }}
              aria-label="Delete photo"
            >×</button>
          </div>
        ))}
      </div>
    </div>
  )
}
