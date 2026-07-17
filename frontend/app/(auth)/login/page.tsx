'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, LayoutDashboard, BellRing, Users, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  useEffect(() => { document.title = 'Login — TNT Pulse'; }, []);
  const router = useRouter();
  const { setToken, setUser, setPermissions } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setApiError('');
    try {
      const res = await api.post('/api/auth/login', data);
      const { token, user, permissions } = res.data.data;
      setToken(token);
      setUser(user);
      setPermissions(permissions || []);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Login failed. Please try again.';
      setApiError(msg);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Left decorative panel - desktop only */}
      <div className="hidden lg:flex lg:w-3/5 bg-gradient-to-br from-indigo-600 to-indigo-800 py-12 px-10 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white" />
          <div className="absolute -bottom-20 -left-20 w-96 h-96 rounded-full bg-white" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-white" />
        </div>
        <div className="flex flex-col items-center h-full relative z-10">
          <div className="flex flex-col items-center justify-center mt-8 space-y-3">
            <div className="relative w-20 h-20 rounded-full overflow-hidden border-4 border-white border-opacity-40 shadow-xl">
              <Image
                src="/logo.jpeg"
                alt="TNT Innovations"
                fill
                className="object-cover object-center scale-125"
                priority
              />
            </div>
          </div>

          <div className="text-center space-y-2 mt-6 mb-8">
            <h1 className="text-5xl font-bold text-white tracking-tight">
              TNT Pulse
            </h1>
            <p className="text-indigo-200 text-base">
              Project Management Tool
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <div className="h-px w-8 bg-white opacity-30"></div>
              <p className="text-white text-opacity-50 text-xs">
                by TNT Innovations
              </p>
              <div className="h-px w-8 bg-white opacity-30"></div>
            </div>
          </div>

          <div className="mt-20 space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 p-2 bg-white/10 rounded-lg">
                <LayoutDashboard size={24} className="text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-base">Centralized Dashboard</h3>
                <p className="text-indigo-200 text-sm mt-1">
                  View all projects, tasks, and deadlines in one place.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 p-2 bg-white/10 rounded-lg">
                <BellRing size={24} className="text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-base">Smart Alerts</h3>
                <p className="text-indigo-200 text-sm mt-1">
                  Get notified about approaching deadlines and task assignments.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 p-2 bg-white/10 rounded-lg">
                <Users size={24} className="text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-base">Team Collaboration</h3>
                <p className="text-indigo-200 text-sm mt-1">
                  Assign tasks, track progress, and communicate with your team.
                </p>
              </div>
            </div>
          </div>
        </div>
        <p className="absolute bottom-4 left-16 text-indigo-300 text-sm z-10">© 2026 TNT Innovations</p>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center lg:justify-start px-5 sm:px-8 lg:pl-12 lg:pr-8">
        <div className="w-full max-w-sm">
          {/* Mobile header - visually appealing */}
          <div className="lg:hidden mb-8">
            <div className="flex flex-col items-center text-center">
              <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-indigo-100 shadow-lg mb-4">
                <Image
                  src="/logo.jpeg"
                  alt="TNT Pulse"
                  fill
                  className="object-cover object-center scale-125"
                  priority
                />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">TNT Pulse</h1>
              <p className="text-gray-400 text-xs mt-0.5">by TNT Innovations</p>
              <div className="flex items-center gap-1.5 mt-3">
                <div className="h-1 w-8 bg-indigo-600 rounded-full" />
                <div className="h-1 w-3 bg-indigo-200 rounded-full" />
                <div className="h-1 w-3 bg-indigo-200 rounded-full" />
              </div>
              <p className="text-gray-500 text-sm mt-4">Sign in to your account</p>
            </div>
          </div>

          {/* Desktop header */}
          <div className="hidden lg:block mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-indigo-100">
                <Image
                  src="/logo.jpeg"
                  alt="TNT Pulse"
                  fill
                  className="object-cover object-center scale-125"
                />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm leading-none">TNT Pulse</p>
                <p className="text-gray-400 text-xs mt-0.5">TNT Innovations</p>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Welcome Back</h2>
            <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                {...register('email')}
                placeholder="you@company.com"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400 box-border"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  placeholder="Enter your password"
                  className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400 box-border"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            {apiError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {apiError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
