// =============================================================================
// lib/ame-api.ts
// -----------------------------------------------------------------------------
// Klien fetch untuk Web API Apps Script (Code.gs) — dipanggil dari komponen
// client di project Next.js ini (app/page.tsx).
//
// SETUP:
//   1. Deploy Code.gs sebagai Web App (Deploy > New deployment > Web app,
//      Execute as: Me, Who has access: Anyone), salin URL yang diakhiri /exec.
//   2. Di Vercel: Project Settings > Environment Variables, tambahkan
//        NEXT_PUBLIC_AME_API_URL = <url /exec tadi>
//      lalu redeploy. Untuk development lokal, taruh baris yang sama di
//      file .env.local (lihat .env.local.example).
//
// CATATAN CORS: request POST dikirim dengan Content-Type "text/plain" (bukan
// "application/json") supaya browser tidak mengirim preflight OPTIONS, karena
// Apps Script Web App tidak punya handler untuk OPTIONS. Body-nya tetap
// string JSON biasa dan di-JSON.parse seperti biasa di sisi Code.gs.
// =============================================================================

const BASE_URL = process.env.NEXT_PUBLIC_AME_API_URL ?? ''

export type EventStatus = 'Lunas' | 'Belum Lunas' | 'Terjadwal' | 'Lewat Jadwal'
export type EventType = 'vendor' | 'rutin'

export type AmeEvent = {
  id: string
  type: EventType
  spkId: string | null
  title: string
  subtitle: string
  vendor: string
  tag: string
  status: EventStatus
  date: string // format yyyy-MM-dd
  amount: number
}

export type SpkItemLine = { namaBarang: string; qty: number; hargaSatuan: number; jumlah: number }
export type SpkPayment = { label: string; tanggal: string; jumlah: number }
export type SpkAttachment = { name: string; url: string }
export type DocType = 'SPK' | 'Invoice' | 'BuktiTransfer'

export type SpkDetail = {
  spkId: string
  vendor: string
  jenisSpk: string
  progress: string
  jumlah: number
  terbayar: number
  sisaHutang: number
  items: SpkItemLine[]
  pembayaran: SpkPayment[]
  attachments: Record<DocType, SpkAttachment[]>
}

export type DashboardSummary = {
  totalTerjadwal: number
  menunggu: { count: number; total: number }
  lunas: { count: number }
  perluPerhatian: { count: number }
  totalOutstanding: number
  jadwalTerdekat: AmeEvent[]
}

function assertBaseUrl() {
  if (!BASE_URL) {
    throw new Error(
      'NEXT_PUBLIC_AME_API_URL belum diisi. Set di Vercel Project Settings > Environment Variables ' +
        '(atau di .env.local untuk development lokal) dengan URL Web App Apps Script yang diakhiri /exec.'
    )
  }
}

async function ameGet<T>(action: string, params: Record<string, string | number>): Promise<T> {
  assertBaseUrl()
  const url = new URL(BASE_URL)
  url.searchParams.set('action', action)
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)))

  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) throw new Error(`Gagal memanggil Apps Script (${action}): HTTP ${res.status}`)
  const json = await res.json()
  if (!json.ok) throw new Error(json.error || `Aksi "${action}" gagal.`)
  return json as T
}

async function amePost<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  assertBaseUrl()
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...payload })
  })
  if (!res.ok) throw new Error(`Gagal memanggil Apps Script (${action}): HTTP ${res.status}`)
  const json = await res.json()
  if (!json.ok) throw new Error(json.error || `Aksi "${action}" gagal.`)
  return json as T
}

/** Event kalender (DP/Pelunasan vendor + tagihan rutin) untuk satu bulan. */
export function getCalendarData(year: number, month: number) {
  return ameGet<{ ok: true; events: AmeEvent[] }>('calendar', { year, month })
}

/** Data untuk kartu metrik dashboard + daftar "Jadwal terdekat". */
export function getDashboardSummary(year: number, month: number) {
  return ameGet<{ ok: true } & DashboardSummary>('dashboardSummary', { year, month })
}

/** Detail satu SPK (rincian barang, jadwal bayar, lampiran) untuk modal. */
export function getSpkDetail(spkId: string) {
  return ameGet<{ ok: true; data: SpkDetail }>('spkDetail', { spkId })
}

/** Upload lampiran (SPK / Invoice / Bukti Transfer) ke Drive untuk satu SPK. */
export async function uploadAttachment(spkId: string, docType: DocType, file: File) {
  const base64Data = await fileToBase64(file)
  return amePost<{ ok: true; file: { id: string; name: string; url: string } }>('uploadAttachment', {
    spkId,
    docType,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    base64Data
  })
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
