import { useId, useState, type FormEvent } from 'react'
import { AppError } from '@app/components/app-error'
import { AppScreen } from '@app/components/app-screen'
import type { AppProfile, LocalScanRepository } from '@app/lib/local-db/types'
import {
  isLocalAppError,
  localErrorMessage,
  localErrorTitle,
} from '@app/lib/local-errors'
import { Button } from '@shared/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@shared/components/ui/card'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'

interface OperatorNamePageProps {
  repository: LocalScanRepository
  onSaved: (profile: AppProfile) => void
}

export function OperatorNamePage({
  repository,
  onSaved,
}: OperatorNamePageProps) {
  const inputId = useId()
  const errorId = useId()
  const [operatorName, setOperatorName] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<LocalRepositoryError | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = operatorName.trim()

    if (!trimmedName) {
      setFieldError(localErrorMessage('OPERATOR_NAME_REQUIRED'))
      setSaveError(null)
      return
    }

    setFieldError(null)
    setSaveError(null)
    setIsSaving(true)
    void saveOperatorName(trimmedName)
  }

  const saveOperatorName = async (trimmedName: string) => {
    try {
      const profile = await repository.saveOperatorName(trimmedName)
      setIsSaving(false)
      onSaved(profile)
    } catch (error) {
      setSaveError(toLocalRepositoryError(error))
      setIsSaving(false)
    }
  }

  return (
    <AppScreen title='初始化操作人'>
      <form onSubmit={handleSubmit} noValidate>
        <Card>
          <CardHeader className='space-y-2'>
            <h2 className='text-base leading-none font-semibold'>
              设置操作人姓名
            </h2>
            <CardDescription className='leading-6'>
              Standalone App 会把该姓名保存到本机，用于后续本地批次记录。
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-5'>
            <div className='space-y-2'>
              <Label htmlFor={inputId}>操作人姓名</Label>
              <Input
                id={inputId}
                name='operatorName'
                value={operatorName}
                aria-invalid={Boolean(fieldError)}
                aria-describedby={fieldError ? errorId : undefined}
                disabled={isSaving}
                autoComplete='name'
                onChange={(event) => setOperatorName(event.target.value)}
              />
              {fieldError ? (
                <p id={errorId} className='text-sm leading-6 text-destructive'>
                  {fieldError}
                </p>
              ) : null}
            </div>
            {saveError ? (
              <AppError title={saveError.title} message={saveError.message} />
            ) : null}
            <Button
              type='submit'
              className='h-12 w-full text-base'
              disabled={isSaving}
            >
              {isSaving ? '正在保存…' : '保存并进入首页'}
            </Button>
          </CardContent>
        </Card>
      </form>
    </AppScreen>
  )
}

interface LocalRepositoryError {
  title: string
  message: string
}

function toLocalRepositoryError(error: unknown): LocalRepositoryError {
  if (isLocalAppError(error)) {
    return {
      title: localErrorTitle(error.code),
      message: localErrorMessage(error.code),
    }
  }

  return {
    title: localErrorTitle('LOCAL_DB_UNAVAILABLE'),
    message: localErrorMessage('LOCAL_DB_UNAVAILABLE'),
  }
}
