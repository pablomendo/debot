'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function SaaSAdminPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [isAuthorized, setIsAuthorized] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Estados para la gestión de locales
  const [locales, setLocales] = useState<any[]>([])
  const [nuevoSubdominio, setNuevoSubdominio] = useState('')

  // Función para cargar los locales directamente de la base de datos
  async function cargarLocales() {
    const { data, error: fetchError } = await supabase
      .from('locales')
      .select('*')
    if (!fetchError && data) {
      setLocales(data)
    }
  }

  async function handleSaaSLogin(e: React.FormEvent) {
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

    // CONTROL SEGURO DE DUEÑO: Pasa directo si el email de autenticación es el tuyo
    if (data.user.email === 'pabloarmendoza@gmail.com') {
      setIsAuthorized(true)
      await cargarLocales()
    } else {
      setError('No tenés acceso a este panel de administración global.')
      await supabase.auth.signOut()
    }
    setLoading(false)
  }

  // Hook para verificar si ya tenés la sesión abierta en el navegador
  useEffect(() => {
    async function verificarSesion() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user && user.email === 'pabloarmendoza@gmail.com') {
        setIsAuthorized(true)
        await cargarLocales()
      }
    }
    verificarSesion()
  }, [])

  async function handleCrearLocal(e: React.FormEvent) {
    e.preventDefault()
    if (!nuevoSubdominio) return
    setLoading(true)
    setError('')

    const { error: insertError } = await supabase
      .from('locales')
      .insert([{ subdominio: nuevoSubdominio.toLowerCase().trim() }])

    if (insertError) {
      setError('Error al crear el local: ' + insertError.message)
    } else {
      setNuevoSubdominio('')
      await cargarLocales() // Recargamos la lista para ver el nuevo local inmediatamente
    }
    setLoading(false)
  }

  // PANTALLA 1: LOGIN (DISEÑO AZUL NOCHE PREMIUM ORIGINAL DE DEBOT)
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030B1E]">
        <div className="w-full max-w-sm px-6">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#00D2FF]/10 border border-[#00D2FF]/20 mb-5">
              <span className="text-2xl font-black text-[#00D2FF]">D</span>
            </div>
            <h1 className="text-white text-2xl font-black tracking-widest uppercase">Debot</h1>
            <p className="text-zinc-500 text-xs mt-1 tracking-widest uppercase">Panel de Control</p>
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8">
            <p className="text-zinc-400 text-sm text-center mb-6">
              Ingresá con tu cuenta de administrador SaaS
            </p>

            <form onSubmit={handleSaaSLogin} className="flex flex-col gap-4">
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
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-xs text-center">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-widest text-zinc-950 transition-all active:scale-[0.98] disabled:opacity-50 mt-2 cursor-pointer"
                style={{ backgroundColor: loading ? '#00D2FF88' : '#00D2FF' }}
              >
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // PANTALLA 2: DASHBOARD MAESTRO (CONSERVA EL MISMO CONTENEDOR CENTRAL DEL DISEÑO ORIGINAL)
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#030B1E] py-12">
      <div className="w-full max-w-2xl px-6">
        
        {/* Encabezado Principal */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#00D2FF]/10 border border-[#00D2FF]/20 mb-5">
            <span className="text-2xl font-black text-[#00D2FF]">D</span>
          </div>
          <h1 className="text-white text-2xl font-black tracking-widest uppercase">Debot</h1>
          <p className="text-zinc-500 text-xs mt-1 tracking-widest uppercase">Panel de Control</p>
        </div>

        {/* Bloque Central de Operaciones */}
        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 flex flex-col gap-8">
          
          {/* Sección: Crear Nuevo Local */}
          <div>
            <h2 className="text-xs font-bold text-[#00D2FF] uppercase tracking-widest mb-4">Instanciar Nuevo Comercio</h2>
            <form onSubmit={handleCrearLocal} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex flex-col gap-1.5">
                <input
                  type="text"
                  placeholder="ej: sushiblue, padelclub"
                  value={nuevoSubdominio}
                  onChange={e => setNuevoSubdominio(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-[#00D2FF]/50 focus:bg-white/[0.07] transition-all"
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="px-6 py-3 rounded-xl bg-[#00D2FF] text-zinc-950 font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer h-fit"
              >
                {loading ? 'Creando...' : 'Crear'}
              </button>
            </form>
            {error && <p className="text-red-400 text-xs mt-2 text-center">{error}</p>}
          </div>

          {/* Separador sutil */}
          <div className="h-px bg-white/10 w-full" />

          {/* Sección: Lista de Comercios Activos */}
          <div>
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Comercios en la Infraestructura</h2>
            <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto pr-1">
              {locales.length === 0 ? (
                <p className="text-zinc-600 text-xs italic py-2">No se encontraron locales creados en la base de datos.</p>
              ) : (
                locales.map(local => (
                  <div key={local.id} className="flex justify-between items-center bg-white/5 border border-white/5 rounded-2xl p-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold text-white tracking-wide">{local.subdominio}</span>
                      <span className="text-[10px] font-mono text-zinc-500">{local.id}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[10px] uppercase font-black text-emerald-400 tracking-wider">Activo</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}