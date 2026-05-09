import { request } from '../client'
import {
  AIComposeRequestSchema,
  AIComposeResponseSchema,
  type AIComposeRequest,
  type AIComposeResponse,
} from '../schemas/ai'

/**
 * R3 contracts — function signature stub for R4 editor-agent (subagent C).
 * R4 fills the mock body with mode-specific diff fixtures +伪流式 chunk emit.
 */

const NOT_IMPLEMENTED = (fn: string): never => {
  throw new Error(`NotImplemented: ${fn} (round-4c editor-agent)`)
}

export async function compose(_req: AIComposeRequest): Promise<AIComposeResponse> {
  void _req
  void request
  void AIComposeRequestSchema
  void AIComposeResponseSchema
  return NOT_IMPLEMENTED('compose')
}
