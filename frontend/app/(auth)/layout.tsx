'use client'
import { useEffect, useState } from 'react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    localStorage.removeItem('tnt_token')
    localStorage.removeItem('tnt_user')
    localStorage.removeItem('tnt_permissions')
    setChecking(false)
  }, [])

  if (checking) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}
