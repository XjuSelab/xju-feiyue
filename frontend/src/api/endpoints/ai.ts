import { request } from '../client'
import {
  AIComposeResponseSchema,
  type AIComposeRequest,
  type AIComposeResponse,
} from '../schemas/ai'

/**
 * R4 editor-agent 实现：mock 后端在 mock/handlers.ts 中按 mode 分派一个
 * 简单的字符串 transform，再用 diffEngine 计算 segments。
 */
export async function compose(
  req: AIComposeRequest,
): Promise<AIComposeResponse> {
  return request({
    method: 'POST',
    path: '/ai/compose',
    body: req,
    schema: AIComposeResponseSchema,
  })
}
