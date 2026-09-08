import { buildCsv, buildExport, EXPORT_TABLES, type ExportTable } from '@/server/services/export'

/**
 * Full JSON dump, or one module as CSV. Protected by the same session gate as
 * every other route — the middleware matcher covers `/api/export` (spec 29).
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const format = url.searchParams.get('format') ?? 'json'
  const table = url.searchParams.get('table')

  if (format === 'csv') {
    if (!table || !(EXPORT_TABLES as readonly string[]).includes(table)) {
      return Response.json({ error: 'unknown table' }, { status: 400 })
    }

    const csv = await buildCsv(table as ExportTable)
    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="personal-os-${table}.csv"`,
        'cache-control': 'no-store',
      },
    })
  }

  const payload = await buildExport()
  const stamp = new Date().toISOString().slice(0, 10)

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="personal-os-${stamp}.json"`,
      'cache-control': 'no-store',
    },
  })
}
