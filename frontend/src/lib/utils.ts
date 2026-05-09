// Re-export cn for shadcn components that import from `@/lib/utils`
// (some shadcn registries default to this path). components.json points
// utils to '@/lib/cn', but we keep this file as a stable shim too.
export { cn } from './cn'
