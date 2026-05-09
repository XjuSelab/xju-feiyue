import { request } from '../client'
import {
  NoteSchema,
  NoteListSchema,
  PaginatedNotesSchema,
  type Note,
  type ListNotesQuery,
  type PaginatedNotes,
} from '../schemas/note'

/**
 * R3 contracts — 函数签名冻结，body 全部 throw NotImplemented。
 * R4 home-agent (subagent A) 替换 listNotes / getHotThisWeek /
 * getLatest / getMostLiked 的 body 为基于 mock/handlers.ts 的真实
 * dispatch。getNote 在 R4 末尾或 R5 由谁来填都行。
 *
 * 不要改这些函数的入参/返回类型 —— 4 个 subagent 共享。
 */

const NOT_IMPLEMENTED = (fn: string): never => {
  throw new Error(`NotImplemented: ${fn} (round-4a home-agent)`)
}

export async function listNotes(_query?: ListNotesQuery): Promise<PaginatedNotes> {
  void _query
  void request
  void PaginatedNotesSchema
  return NOT_IMPLEMENTED('listNotes')
}

export async function getHotThisWeek(): Promise<Note[]> {
  void NoteListSchema
  return NOT_IMPLEMENTED('getHotThisWeek')
}

export async function getLatest(): Promise<Note[]> {
  return NOT_IMPLEMENTED('getLatest')
}

export async function getMostLiked(): Promise<Note[]> {
  return NOT_IMPLEMENTED('getMostLiked')
}

export async function getNote(_id: string): Promise<Note> {
  void _id
  void NoteSchema
  return NOT_IMPLEMENTED('getNote')
}
