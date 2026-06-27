import {
  isCreatedDraft,
  type LocalActiveDraft,
} from '@app/lib/local-draft-store'

export function DraftSummaryCard({ draft }: { draft: LocalActiveDraft }) {
  return (
    <dl className='grid gap-2 rounded-md bg-muted p-3 text-sm'>
      <div>
        <dt className='text-muted-foreground'>客户端批次 ID</dt>
        <dd className='font-medium break-all'>{draft.clientBatchId}</dd>
      </div>
      {isCreatedDraft(draft) ? (
        <>
          <div>
            <dt className='text-muted-foreground'>批次号</dt>
            <dd className='font-medium break-all'>{draft.batchNo}</dd>
          </div>
          <div>
            <dt className='text-muted-foreground'>已扫描</dt>
            <dd className='font-medium'>{draft.items.length} 条</dd>
          </div>
        </>
      ) : null}
    </dl>
  )
}
