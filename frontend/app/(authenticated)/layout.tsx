'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Navbar from '@/components/layout/Navbar'
import { useAuthStore } from '@/lib/store'
import api from '@/lib/api'

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [isAuthed, setIsAuthed] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('tnt_token')
    if (!token) {
      window.location.replace('/login')
      return
    }
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
    setIsAuthed(true)
  }, [])

  useEffect(() => {
    if (!isAuthed) return
    api.get('/api/users/me/permissions').then((res) => {
      useAuthStore.getState().setPermissions(res.data.data)
    }).catch(() => {})
  }, [isAuthed])

  if (!isAuthed) {
    return <div className="min-h-screen bg-gray-50" />
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
