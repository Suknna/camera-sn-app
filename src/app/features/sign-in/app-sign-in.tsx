import { useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AppError } from '@app/components/app-error'
import type { AppRuntimeConfigResult } from '@app/lib/runtime-config'
import { isAPIError } from '@shared/api/errors'
import { useAuthStore } from '@shared/auth/auth-store'
import { Button } from '@shared/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@shared/components/ui/card'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'

export interface AppSignInProps {
  runtimeConfig: AppRuntimeConfigResult
}

export function AppSignIn({ runtimeConfig }: AppSignInProps) {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.auth.login)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError('')
    setIsSubmitting(true)

    try {
      await login({ username, password })
      await navigate({ to: '/' })
    } catch (error) {
      setFormError(getInlineErrorMessage(error, '登录失败，请稍后重试'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className='flex min-h-svh items-center justify-center bg-background p-4'>
      {!runtimeConfig.ok ? (
        <div className='w-full max-w-sm'>
          <AppError title='App 配置错误' message={runtimeConfig.message} />
        </div>
      ) : (
        <Card className='w-full max-w-sm'>
          <CardHeader className='space-y-2 text-center'>
            <img
              src='/logo-mark.png'
              alt=''
              aria-hidden='true'
              className='mx-auto size-12'
            />
            <CardTitle className='text-xl'>Camera SN 现场扫描</CardTitle>
            <CardDescription>登录后开始扫描服务器序列号</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='username'>用户名</Label>
                <Input
                  id='username'
                  className='h-12 text-base'
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='password'>密码</Label>
                <Input
                  id='password'
                  type='password'
                  className='h-12 text-base'
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
              {formError ? (
                <p className='text-sm text-destructive' role='alert'>
                  {formError}
                </p>
              ) : null}
              <Button
                type='submit'
                className='h-12 w-full text-base'
                disabled={isSubmitting}
              >
                {isSubmitting ? '登录中…' : '登录'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function getInlineErrorMessage(error: unknown, fallback: string) {
  if (isAPIError(error)) {
    const message = error.message || fallback
    return `${message}（错误码：${error.code}）`
  }

  if (error instanceof Error && error.message) return error.message
  return fallback
}
