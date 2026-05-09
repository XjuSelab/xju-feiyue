import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 合并 className，遵循 Tailwind 优先级。
 *
 * 用法:
 *   cn('p-2', condition && 'p-4', className)
 */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs))
