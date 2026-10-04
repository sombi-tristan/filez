import { NextResponse } from '@/lib/local/nextServer'
import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'
import { rateLimit } from '@/lib/rateLimit'

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf']
const ALLOWED_MIMES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
}

export async function POST(request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { success } = rateLimit(`imprest-upload:${user.id}`, 20)
    if (!success) return NextResponse.json({ error: 'Too many uploads. Please try again later.' }, { status: 429 })

    const formData = await request.formData()
    const file = formData.get('file')
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: `File type not allowed. Accepted: ${ALLOWED_EXTENSIONS.join(', ')}` }, { status: 400 })
    }
    if (file.type !== ALLOWED_MIMES[ext]) {
      return NextResponse.json({ error: 'File type mismatch' }, { status: 400 })
    }

    const supabase = getAdminClient()
    const safeName = `imprest-receipts/${user.id}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('imprest-receipts')
      .upload(safeName, file)

    if (uploadError) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })

    const { data: { publicUrl } } = supabase.storage
      .from('imprest-receipts')
      .getPublicUrl(safeName)

    return NextResponse.json({ url: publicUrl })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
