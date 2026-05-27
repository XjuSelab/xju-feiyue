import { registerMock } from '../client'
import { CCF_CONFS } from '@/features/conferences/data'

registerMock('GET', '/conferences', async () => ({
  conferences: CCF_CONFS,
  count: CCF_CONFS.length,
  manifest: {
    schema_version: 1,
    exported_at: new Date().toISOString(),
    claw_version: 'mock',
    conferences_sqlite_sha256: null,
    conferences_sqlite_bytes: null,
    counts: { conferences: CCF_CONFS.length },
  },
}))
