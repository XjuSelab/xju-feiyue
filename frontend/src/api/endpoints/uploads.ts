import { z } from 'zod'
import { request } from '../client'

const TOKEN_KEY = 'labnotes.auth.token'

const UploadedImageSchema = z.object({ url: z.string() })
export type UploadedImage = z.infer<typeof UploadedImageSchema>

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem(TOKEN_KEY)
  return t ? { Authorization: `Bearer ${t}` } : {}
}

/** POST /notes/images — multipart upload, returns the URL to embed
 * directly as `![](url)` in the markdown body. */
export async function uploadNoteImage(file: File): Promise<UploadedImage> {
  const form = new FormData()
  form.append('file', file)
  return request({
    method: 'POST',
    path: '/notes/images',
    body: form,
    schema: UploadedImageSchema,
    headers: authHeaders(),
  })
}
