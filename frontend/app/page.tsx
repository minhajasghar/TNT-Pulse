'use client'
import { useEffect } from 'react'

export default function Home() {
  useEffect(() => {
    localStorage.removeItem('tnt_token')
    localStorage.removeItem('tnt_user')
    window.location.href = '/login'
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400">Loading...</p>
    </div>
  )
}
