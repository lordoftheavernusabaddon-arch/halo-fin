'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, FileText, LayoutDashboard, Menu, Paperclip, Settings, TrendingUp, Upload, Wallet, X } from 'lucide-react'
import {
  getCalendarData,
  getDashboardSummary,
  getSpkDetail,
  uploadAttachment,
  type AmeEvent,
  type DocType,
  type SpkDetail,
} from '@/lib/ame-api'

type Status = 'paid' | 'pending' | 'overdue'
type Item = { id: string; title: string; date: string; amount: number; status: Status; category: string; sheet: string; notes: string; spkId: string | null }

// Kosakata status di backend (Lunas/Belum Lunas/Terjadwal/Lewat Jadwal) dipetakan
// ke 3 status yang sudah dipakai desain ini (paid/pending/overdue) supaya CSS
// yang sudah ada (.event-pill.paid, .status-badge.overdue, dst) tetap berlaku
// tanpa perlu desain ulang.
const STATUS_MAP: Record<AmeEvent['status'], Status> = {
  Lunas: 'paid',
  'Belum Lunas': 'pending',
  Terjadwal: 'pending',
  'Lewat Jadwal': 'overdue',
}

function toItem(ev: AmeEvent): Item {
  return {
    id: ev.id,
    title: ev.type === 'vendor' ? `${ev.subtitle} · ${ev.title}` : ev.title,
    date: ev.date,
    amount: ev.amount,
    status: STATUS_MAP[ev.status] ?? 'pending',
    category: ev.type === 'vendor' ? 'Hutang vendor' : 'Transaksi rutin',
    sheet: ev.type === 'vendor' ? '03. Hutang Vendor' : '04. Transaksi Rutin',
    notes: ev.type === 'vendor' ? `Vendor ${ev.vendor} · ${ev.tag}` : ev.subtitle || 'Tagihan rutin bulanan.',
    spkId: ev.spkId,
  }
}

const nav = [
  ['Dashboard', LayoutDashboard], ['Pusat Kontrol Budgeting', TrendingUp], ['Pusat Kontrol Input Transaksi', FileText], ['Cicilan / Investor / Pinjaman', Wallet], ['Analytics', CircleDollarSign], ['Settings', Settings],
] as const
const format = (value: number) => `Rp ${(value / 1000000).toFixed(1)} jt`

export default function Page() {
  const [active, setActive] = useState('Dashboard')
  const [selected, setSelected] = useState<Item | null>(null)
  const [month, setMonth] = useState(() => new Date())
  const [items, setItems] = useState<Item[]>([])
  const [totalOutstanding, setTotalOutstanding] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mobileNav, setMobileNav] = useState(false)

  const year = month.getFullYear()
  const monthNum = month.getMonth() + 1
  const monthLabel = month.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

  const loadData = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([getCalendarData(year, monthNum), getDashboardSummary(year, monthNum)])
      .then(([cal, summary]) => {
        setItems(cal.events.map(toItem))
        setTotalOutstanding(summary.totalOutstanding)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [year, monthNum])

  useEffect(() => { loadData() }, [loadData])

  const calendarDays = (() => {
    const start = new Date(year, month.getMonth(), 1).getDay()
    const total = new Date(year, month.getMonth() + 1, 0).getDate()
    return [...Array(start).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)]
  })()

  const today = new Date()
  const totals = {
    pending: items.filter((i) => i.status === 'pending').reduce((a, i) => a + i.amount, 0),
    overdue: items.filter((i) => i.status === 'overdue').length,
    paid: items.filter((i) => i.status === 'paid').length,
  }

  return (
    <main className="portal-shell">
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="brand"><span className="brand-mark">A</span><span>Ame Control</span></div>
        <p className="workspace-label">WORKSPACE</p>
        <nav>
          {nav.map(([label, Icon]) => (
            <button key={label} className={active === label ? 'nav-item active' : 'nav-item'} onClick={() => { setActive(label); setMobileNav(false) }}>
              <Icon size={18} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sync-status"><span className="online-dot" /> Google Sheets tersinkron</div>
          <div className="profile"><div className="avatar">TA</div><div><b>Tome Ame</b><small>Finance admin</small></div></div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <button className="icon-btn mobile-menu" aria-label="Buka menu" onClick={() => setMobileNav(!mobileNav)}><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{active}</strong></div>
          <div className="top-actions">
            <button className="icon-btn" aria-label="Notifikasi"><Bell size={18} />{totals.overdue > 0 && <i />}</button>
            <div className="mini-avatar">TA</div>
          </div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">{today.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <h1>{active}</h1>
              <p className="subheading">Pusat kendali keuangan dan operasional dalam satu tempat.</p>
            </div>
            <button className="sync-btn" onClick={loadData} disabled={loading}>
              <CalendarDays size={16} /> {loading ? 'Menyinkronkan…' : 'Sync Sheets'}
            </button>
          </div>

          {error && <p className="detail-note" style={{ color: '#ae4a4f', marginBottom: 16 }}>Gagal memuat data: {error}</p>}

          {active === 'Dashboard' ? (
            <>
              <section className="metric-grid">
                <Metric icon={<CalendarDays />} label="Total terjadwal" value={String(items.length)} tone="blue" trend="Bulan ini" />
                <Metric icon={<Wallet />} label="Menunggu dibayar" value={format(totals.pending)} tone="amber" trend={`${items.filter((i) => i.status === 'pending').length} transaksi`} />
                <Metric icon={<TrendingUp />} label="Sudah lunas" value={String(totals.paid)} tone="green" trend="Bulan ini" />
                <Metric icon={<Bell />} label="Perlu perhatian" value={String(totals.overdue)} tone="rose" trend="Jatuh tempo" />
              </section>

              <section className="dashboard-grid">
                <div className="card tracker-card">
                  <div className="card-heading">
                    <div><p className="eyebrow">Payment tracker</p><h2>Kalender pembayaran</h2></div>
                    <div className="calendar-controls">
                      <button className="small-btn" onClick={() => setMonth(new Date(year, month.getMonth() - 1, 1))}><ChevronLeft size={16} /></button>
                      <button className="today-btn" onClick={() => setMonth(new Date())}>Hari ini</button>
                      <button className="small-btn" onClick={() => setMonth(new Date(year, month.getMonth() + 1, 1))}><ChevronRight size={16} /></button>
                    </div>
                  </div>
                  <div className="month-title">{monthLabel}</div>
                  <div className="calendar-weekdays">{['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((day) => <span key={day}>{day}</span>)}</div>
                  <div className="calendar-grid">
                    {calendarDays.map((day, index) => {
                      const iso = day ? `${year}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : ''
                      const dayEvents = items.filter((item) => item.date === iso)
                      const isToday = day === today.getDate() && month.getMonth() === today.getMonth() && year === today.getFullYear()
                      return (
                        <div className={`calendar-cell ${isToday ? 'today' : ''}`} key={`${iso}-${index}`}>
                          {day && (
                            <>
                              <span className="day-number">{day}</span>
                              {dayEvents.map((event) => (
                                <button key={event.id} className={`event-pill ${event.status}`} onClick={() => setSelected(event)}>
                                  <span>{event.title}</span><small>{format(event.amount)}</small>
                                </button>
                              ))}
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div className="legend"><span><i className="legend-dot paid" /> Lunas</span><span><i className="legend-dot pending" /> Menunggu</span><span><i className="legend-dot overdue" /> Terlambat</span></div>
                </div>

                <div className="card upcoming-card">
                  <div className="card-heading"><div><p className="eyebrow">Ringkasan</p><h2>Jadwal terdekat</h2></div><button className="text-btn" onClick={() => setActive('Dashboard')}>Lihat semua</button></div>
                  <div className="upcoming-list">
                    {items.filter((i) => i.status !== 'paid').slice(0, 4).map((item) => (
                      <button className="upcoming-item" key={item.id} onClick={() => setSelected(item)}>
                        <div className={`date-tile ${item.status}`}><b>{new Date(item.date).getDate()}</b><small>{new Date(item.date).toLocaleDateString('id-ID', { month: 'short' }).toUpperCase()}</small></div>
                        <div className="upcoming-copy"><b>{item.title}</b><small>{item.category} · {new Date(item.date).toLocaleDateString('id-ID', { weekday: 'long' })}</small></div>
                        <strong>{format(item.amount)}</strong>
                      </button>
                    ))}
                    {!loading && items.filter((i) => i.status !== 'paid').length === 0 && <p className="detail-note">Tidak ada jadwal tertunda bulan ini.</p>}
                  </div>
                  <div className="summary-total"><span>Total outstanding</span><b>{format(totalOutstanding)}</b></div>
                </div>
              </section>
            </>
          ) : (
            <EmptyState title={active} />
          )}
        </div>
      </section>

      {selected && (
        <DetailModal
          item={selected}
          onClose={() => setSelected(null)}
          onUploaded={loadData}
        />
      )}
    </main>
  )
}

function Metric({ icon, label, value, tone, trend }: { icon: React.ReactNode; label: string; value: string; tone: string; trend: string }) {
  return <div className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{trend}</small></div></div>
}

function EmptyState({ title }: { title: string }) {
  return <div className="empty-state card"><div className="empty-icon"><FileText /></div><h2>{title}</h2><p>Modul ini siap dihubungkan ke sheet terkait pada iterasi berikutnya. Fondasi navigasi dan kontrak data sudah tersedia.</p></div>
}

function DetailModal({ item, onClose, onUploaded }: { item: Item; onClose: () => void; onUploaded: () => void }) {
  const [detail, setDetail] = useState<SpkDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [docType, setDocType] = useState<DocType>('SPK')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const loadDetail = useCallback(() => {
    if (!item.spkId) return
    setDetailLoading(true)
    getSpkDetail(item.spkId)
      .then((res) => setDetail(res.data))
      .catch((err: Error) => setUploadError(err.message))
      .finally(() => setDetailLoading(false))
  }, [item.spkId])

  useEffect(() => { setDetail(null); loadDetail() }, [loadDetail])

  const handleUpload = (file: File | undefined) => {
    if (!file || !item.spkId) return
    setUploading(true)
    setUploadError(null)
    uploadAttachment(item.spkId, docType, file)
      .then(() => { loadDetail(); onUploaded() })
      .catch((err: Error) => setUploadError(err.message))
      .finally(() => setUploading(false))
  }

  const statusLabel = item.status === 'paid' ? 'LUNAS' : item.status === 'overdue' ? 'TERLAMBAT' : 'MENUNGGU'
  const allAttachments = detail ? [...detail.attachments.SPK, ...detail.attachments.Invoice, ...detail.attachments.BuktiTransfer] : []

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-top">
          <div><span className={`status-badge ${item.status}`}>{statusLabel}</span><h2 id="detail-title">{item.title}</h2></div>
          <button className="icon-btn" aria-label="Tutup detail" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="detail-rows">
          <div><span>Tanggal</span><b>{new Date(item.date).toLocaleDateString('id-ID', { dateStyle: 'long' })}</b></div>
          <div><span>Nominal</span><b>{format(item.amount)}</b></div>
          <div><span>Sumber data</span><b>{item.sheet}</b></div>
        </div>

        <p className="detail-note">
          {item.notes}
          {detail && ` · Sisa hutang saat ini: ${format(detail.sisaHutang)}.`}
        </p>

        {item.spkId ? (
          <div className="attachment-box" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="attachment-icon"><Paperclip size={18} /></div>
              <div><b>Attachment &amp; dokumen</b><small>SPK, invoice, dan bukti transfer tersimpan di Drive</small></div>
            </div>

            {detailLoading ? (
              <small>Memuat lampiran…</small>
            ) : allAttachments.length > 0 ? (
              <div className="attachment-list">
                {allAttachments.map((att) => (
                  <a key={att.url + att.name} className="attachment-link" href={att.url} target="_blank" rel="noopener noreferrer">
                    <Paperclip size={12} /> {att.name}
                  </a>
                ))}
              </div>
            ) : (
              <p className="attachment-empty">Belum ada file untuk SPK ini.</p>
            )}

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label className="status-select" style={{ flex: 1 }}>
                Jenis dokumen
                <select value={docType} onChange={(e) => setDocType(e.target.value as DocType)}>
                  <option value="SPK">SPK</option>
                  <option value="Invoice">Invoice</option>
                  <option value="BuktiTransfer">Bukti Transfer</option>
                </select>
              </label>
              <label className="upload-btn" style={{ marginLeft: 0 }}>
                <Upload size={15} /> {uploading ? 'Mengunggah…' : 'Upload'}
                <input type="file" hidden disabled={uploading} onChange={(e) => handleUpload(e.target.files?.[0])} />
              </label>
            </div>
            {uploadError && <small style={{ color: '#ae4a4f' }}>{uploadError}</small>}
          </div>
        ) : (
          <div className="attachment-box">
            <div className="attachment-icon"><Paperclip size={18} /></div>
            <div><b>Tanpa lampiran SPK</b><small>Transaksi rutin tidak memiliki dokumen SPK/Invoice terkait.</small></div>
          </div>
        )}

        <div className="modal-footer">
          <small style={{ color: '#8c95a4' }}>Status dihitung otomatis dari sheet — belum bisa diubah manual dari sini.</small>
          <button className="sync-btn" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  )
}
