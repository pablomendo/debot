'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useParams } from 'next/navigation'

export default function AdminLoginPage() {
  // Inicialización correcta de Supabase para Client Components en Next.js 16
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()
  const params = useParams()
  const subdomain = params?.subdomain as string

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !data.user) {
      setError('Email o contraseña incorrectos.')
      setLoading(false)
      return
    }

    // Verificamos que el usuario pertenece a este local
    const { data: adminUser, error: adminError } = await supabase
      .from('usuarios_admin')
      .select('id, local_id, rol, locales(subdominio)')
      .eq('id', data.user.id)
      .maybeSingle()

    if (adminError || !adminUser) {
      setError('No tenés acceso a este panel.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    // Verificamos que el subdominio coincide con el local del usuario
    const localSubdominio = (adminUser.locales as { subdominio: string } | null)?.subdominio
    if (localSubdominio !== subdomain) {
      setError('No tenés acceso a este local.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    router.push(`/${subdomain}/admin/dashboard`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#030B1E]">
      <div className="w-full max-w-sm px-6">

        {/* Logo / Marca */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#00D2FF]/10 border border-[#00D2FF]/20 mb-5">
            <span className="text-2xl font-black text-[#00D2FF]">D</span>
          </div>
          <h1 className="text-white text-2xl font-black tracking-widest uppercase">Debot</h1>
          <p className="text-zinc-500 text-xs mt-1 tracking-widest uppercase">Panel de Control</p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8">
          <p className="text-zinc-400 text-sm text-center mb-6">
            Ingresá con tu cuenta de administrador
          </p>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="tu@email.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-[#00D2FF]/50 focus:bg-white/[0.07] transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-[#00D2FF]/50 focus:bg-white/[0.07] transition-all"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-widest text-zinc-950 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              style={{ backgroundColor: loading ? '#00D2FF88' : '#00D2FF' }}
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="text-center text-zinc-700 text-xs mt-6">
          {subdomain}.debotz.com &mdash; Panel interno
        </p>
      </div>
    </div>
  )
}