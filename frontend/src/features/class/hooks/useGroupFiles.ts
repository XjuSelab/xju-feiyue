import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import { deleteGroupFile, listGroupFiles, uploadGroupFiles } from '@/api/endpoints/groups'
import type { GroupFile } from '@/api/schemas/class'
import type { UploadProgress } from '@/api/upload'
import { classKeys, errMsg } from './keys'

/** 组内文件 hooks —— 上传走 XHR 出逐字节进度（materials 同款）。 */

export function useGroupFiles(gid: string, enabled: boolean): UseQueryResult<GroupFile[]> {
  return useQuery({
    queryKey: classKeys.files(gid),
    queryFn: () => listGroupFiles(gid),
    enabled,
  })
}

export function useUploadGroupFiles(gid: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      files,
      onProgress,
    }: {
      files: File[]
      onProgress?: (p: UploadProgress) => void
    }) => uploadGroupFiles(gid, files, onProgress),
    onSuccess: (list, vars) => {
      qc.setQueryData<GroupFile[]>(classKeys.files(gid), list)
      toast.success(`已上传 ${vars.files.length} 个文件`)
    },
    onError: (e) => toast.error(errMsg(e, '上传失败')),
  })
}

export function useDeleteGroupFile(gid: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (fileId: string) => deleteGroupFile(gid, fileId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: classKeys.files(gid) })
      toast.success('文件已删除')
    },
    onError: (e) => toast.error(errMsg(e, '删除文件失败')),
  })
}
