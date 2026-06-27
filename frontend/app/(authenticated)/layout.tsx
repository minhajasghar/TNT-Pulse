'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import Navbar from '@/components/layout/Navbar'
import { useAuthStore } from '@/lib/store'
import api from '@/lib/api'

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isChecking, setIsChecking] = useState(true)
  const { permissions } = useAuthStore()

  useEffect(() => {
    const raw = localStorage.getItem('tnt_token')
    const token = raw && raw !== 'null' && raw !== 'undefined' ? raw : null
    if (!token) {
      localStorage.removeItem('tnt_token')
      localStorage.removeItem('tnt_user')
      localStorage.removeItem('tnt_permissions')
      window.location.href = '/login'
    } else {
      const store = useAuthStore.getState()
      if (!store.token) {
        store.setToken(token)
      }
      if (!store.user) {
        const rawUser = localStorage.getItem('tnt_user')
        if (rawUser) {
          try {
            store.setUser(JSON.parse(rawUser))
          } catch {}
        }
      }
      setIsChecking(false)
    }
  }, [])

  useEffect(() => {
    if (!isChecking && permissions.length === 0) {
      const store = useAuthStore.getState()
      const rawPerms = localStorage.getItem('tnt_permissions')
      if (rawPerms) {
        try {
          const parsed = JSON.parse(rawPerms)
          if (parsed.length > 0) {
            return
          }
        } catch {}
      }
      api.get('/api/users/me/permissions').then((res) => {
        store.setPermissions(res.data.data)
      }).catch(() => {})
    }
  }, [isChecking, permissions.length])

  if (isChecking) {
    return <div className="min-h-screen bg-white" />
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
