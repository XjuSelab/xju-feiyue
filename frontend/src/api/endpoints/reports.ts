import { request } from '../client'
import {
  ReportListSchema,
  ReportSchema,
  type Report,
  type ReportCreateIn,
  type ReportResolveIn,
} from '../schemas/report'

const TOKEN_KEY = 'labnotes.auth.token'

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem(TOKEN_KEY)
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export async function createReport(body: ReportCreateIn): Promise<Report> {
  return request({
    method: 'POST',
    path: '/reports',
    body,
    schema: ReportSchema,
    headers: authHeaders(),
  })
}

export async function listReports(status?: string): Promise<Report[]> {
  return request({
    method: 'GET',
    path: '/reports',
    schema: ReportListSchema,
    headers: authHeaders(),
    ...(status ? { query: { status } } : {}),
  })
}

export async function resolveReport(id: string, body: ReportResolveIn): Promise<Report> {
  return request({
    method: 'POST',
    path: `/reports/${id}/resolve`,
    body,
    schema: ReportSchema,
    headers: authHeaders(),
  })
}
