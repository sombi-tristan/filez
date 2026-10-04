import { NextResponse } from '@/lib/local/nextServer'
import { getAuthUser } from '@/lib/supabaseServer'

// Desktop build: templates ship inside the app (public/templates), named as on the server.
const BUNDLED = {
  'AUDIT REPORT TEMPLATE': '/templates/AUDIT REPORT TEMPLATE.xlsx',
  'AUDIT REPORT TEMPLATE (EXTENDED)': '/templates/AUDIT REPORT TEMPLATE (EXTENDED).xlsx',
}

export async function GET(request) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const name = new URL(request.url).searchParams.get('name')
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  const path = BUNDLED[name]
  return NextResponse.json({ url: path ? encodeURI(path) : null })
}
