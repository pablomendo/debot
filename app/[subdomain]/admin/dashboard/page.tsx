'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useParams } from 'next/navigation'

interface Local {
  id: string
  nombre_comercial: string
  color_primario: string
  color_acento: string
  bot_activo: boolean
  subdominio: string
}

interface Producto {
  id: string
  nombre: string
  precio: number
  disponible: boolean
  categoria_id: string
  categorias: { nombre: string } | null
}

interface Pedido {
  id: string
  total: number
  estado_comanda: string
  estado_pago: string
  tipo_entrega: string
  created_at: string
  clientes: { nombre: string; telefono: string } | null
  items: Array<{ nombre: string; cantidad: number; precio: number }>
}

interface Sesion {
  id: string
  bot_bloqueado: boolean
  requiere_atencion_humana: boolean
  updated_at: string
  clientes: { nombre: string; telefono: string } | null
}

function formatPrecio(n: number) {
  return n.toLocaleString('es-AR')
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'hace un momento'
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  return `hace ${h}h`
}

const ESTADO_COMANDA_LABEL: Record<string, string> = {
  recibido: 'Recibido',
  en_cocina: 'En cocina',
  en_camino: 'En camino',
  entregado: 'Entregado',
}

const ESTADO_COMANDA_COLOR: Record<string, string> = {
  recibido: '#F59E0B',
  en_cocina: '#3B82F6',
  en_camino: '#8B5CF6',
  entregado: '#10B981',
}

export default function DashboardPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const router = useRouter()
  const params = useParams()
  const subdomain = params?.subdomain as string

  const [local, setLocal] = useState<Local | null>(null)
  const [productos, setProductos] = useState<Producto[]>([])
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'stock' | 'pedidos' | 'conversaciones'>('stock')
  const [updatingBot, setUpdatingBot] = useState(false)
  const [updatingProducto, setUpdatingProducto] = useState<string | null>(null)
  const [updatingSesion, setUpdatingSesion] = useState<string | null>(null)

  const cargarDatos = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push(`/${subdomain}/admin`)
      return
    }

    const { data: localData } = await supabase
      .from('locales')
      .select('id, nombre_comercial, color_primario, color_acento, bot_activo, subdominio')
      .eq('subdominio', subdomain)
      .maybeSingle()

    if (!localData) {
      router.push(`/${subdomain}/admin`)
      return
    }
    setLocal(localData)

    const { data: prodsData } = await supabase
      .from('productos')
      .select('id, nombre, precio, disponible, categoria_id, categorias(nombre)')
      .eq('local_id', localData.id)
      .order('nombre', { ascending: true })

      setProductos((prodsData as unknown as Producto[]) || [])

    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const { data: pedidosData } = await supabase
      .from('pedidos')
      .select('id, total, estado_comanda, estado_pago, tipo_entrega, created_at, items, clientes(nombre, telefono)')
      .eq('local_id', localData.id)
      .neq('estado_comanda', 'entregado')
      .gte('created_at', hoy.toISOString())
      .order('created_at', { ascending: false })

    setPedidos((pedidosData as unknown as Pedido[]) || [])

    const { data: sesionesData } = await supabase
      .from('sesiones_chat')
      .select('id, bot_bloqueado, requiere_atencion_humana, updated_at, clientes(nombre, telefono)')
      .eq('local_id', localData.id)
      .order('updated_at', { ascending: false })
      .limit(20)

    setSesiones((sesionesData as unknown as Sesion[]) || [])
    setLoading(false)
  }, [subdomain])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  useEffect(() => {
    if (!local) return
    const channel = supabase
      .channel('pedidos-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pedidos',
        filter: `local_id=eq.${local.id}`,
      }, () => { cargarDatos() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [local, cargarDatos])

  async function toggleBot() {
    if (!local || updatingBot) return
    setUpdatingBot(true)
    const nuevoEstado = !local.bot_activo
    await supabase.from('locales').update({ bot_activo: nuevoEstado }).eq('id', local.id)
    setLocal(prev => prev ? { ...prev, bot_activo: nuevoEstado } : prev)
    setUpdatingBot(false)
  }

  async function toggleProducto(prod: Producto) {
    if (updatingProducto) return
    setUpdatingProducto(prod.id)
    const nuevo = !prod.disponible
    await supabase.from('productos').update({ disponible: nuevo }).eq('id', prod.id)
    setProductos(prev => prev.map(p => p.id === prod.id ? { ...p, disponible: nuevo } : p))
    setUpdatingProducto(null)
  }

  async function toggleBotBloqueado(sesion: Sesion) {
    if (updatingSesion) return
    setUpdatingSesion(sesion.id)
    const nuevo = !sesion.bot_bloqueado
    await supabase.from('sesiones_chat').update({ bot_bloqueado: nuevo }).eq('id', sesion.id)
    setSesiones(prev => prev.map(s => s.id === sesion.id ? { ...s, bot_bloqueado: nuevo } : s))
    setUpdatingSesion(null)
  }

  async function avanzarEstado(pedido: Pedido) {
    const orden = ['recibido', 'en_cocina', 'en_camino', 'entregado']
    const idx = orden.indexOf(pedido.estado_comanda)
    if (idx === -1 || idx === orden.length - 1) return
    const siguiente = orden[idx + 1]
    await supabase.from('pedidos').update({ estado_comanda: siguiente }).eq('id', pedido.id)
    setPedidos(prev => prev.map(p => p.id === pedido.id ? { ...p, estado_comanda: siguiente } : p))
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push(`/${subdomain}/admin`)
  }

  function imprimirComanda(pedido: Pedido) {
    const ventana = window.open('', '_blank', 'width=380,height=600')
    if (!ventana) return
    const items = Array.isArray(pedido.items) ? pedido.items : []
    const itemsHtml = items.map(i =>
      `<tr><td>${i.cantidad}x ${i.nombre}</td><td style="text-align:right">$${formatPrecio(i.precio * i.cantidad)}</td></tr>`
    ).join('')
    ventana.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>* { margin:0; padding:0; box-sizing:border-box; } body { font-family:'Courier New',monospace; font-size:13px; padding:16px; max-width:320px; } h1 { font-size:18px; font-weight:bold; text-align:center; margin-bottom:4px; } .sub { text-align:center; color:#555; font-size:11px; margin-bottom:16px; } .sep { border-top:1px dashed #000; margin:10px 0; } table { width:100%; border-collapse:collapse; } td { padding:3px 0; vertical-align:top; } .total { font-size:16px; font-weight:bold; margin-top:8px; display:flex; justify-content:space-between; } .footer { text-align:center; color:#888; font-size:10px; margin-top:16px; }</style>
      </head><body>
      <h1>${pedido.clientes?.nombre || 'Comanda'}</h1>
      <p class="sub">#${pedido.id.slice(-6).toUpperCase()} — ${new Date(pedido.created_at).toLocaleTimeString('es-AR')}</p>
      <div class="sep"></div>
      <p><strong>Tipo:</strong> ${pedido.tipo_entrega === 'delivery' ? 'Delivery' : 'Takeaway'}</p>
      <p><strong>Tel:</strong> ${pedido.clientes?.telefono || '-'}</p>
      <p><strong>Pago:</strong> ${pedido.estado_pago}</p>
      <div class="sep"></div>
      <table>${itemsHtml}</table>
      <div class="sep"></div>
      <div class="total"><span>TOTAL</span><span>$${formatPrecio(pedido.total)}</span></div>
      <p class="footer">Impreso ${new Date().toLocaleTimeString('es-AR')}</p>
      </body></html>`)
    ventana.document.close()
    ventana.focus()
    setTimeout(() => ventana.print(), 300)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030B1E] flex items-center justify-center">
        <div className="text-[#00D2FF] text-sm font-bold tracking-widest uppercase animate-pulse">
          Cargando panel...
        </div>
      </div>
    )
  }

  if (!local) return null

  const acento = local.color_acento ? `#${local.color_acento}` : '#00D2FF'
  const totalFacturado = pedidos.reduce((acc, p) => acc + (p.total || 0), 0)
  const sesionesConAlerta = sesiones.filter(s => s.requiere_atencion_humana)

  return (
    <div className="min-h-screen bg-[#030B1E] text-white font-sans">

      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-[#030B1E]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-black tracking-wide" style={{ color: acento }}>
              {local.nombre_comercial}
            </h1>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Panel Admin</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleBot}
              disabled={updatingBot}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-all"
              style={{
                borderColor: local.bot_activo ? `${acento}40` : '#ffffff20',
                backgroundColor: local.bot_activo ? `${acento}15` : '#ffffff08',
                color: local.bot_activo ? acento : '#71717a',
              }}
            >
              <span
                className={`w-2 h-2 rounded-full ${local.bot_activo ? 'animate-pulse' : ''}`}
                style={{ backgroundColor: local.bot_activo ? acento : '#52525b' }}
              />
              {updatingBot ? '...' : local.bot_activo ? 'Bot activo' : 'Bot pausado'}
            </button>
            <button onClick={handleLogout} className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* MÉTRICAS */}
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-3">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Pedidos activos', value: pedidos.length },
            { label: 'Facturado hoy', value: `$${formatPrecio(totalFacturado)}` },
            { label: 'Alertas', value: sesionesConAlerta.length },
          ].map(m => (
            <div key={m.label} className="bg-white/[0.03] border border-white/5 rounded-2xl p-3 text-center">
              <p className="text-xs text-zinc-500 mb-1">{m.label}</p>
              <p className="text-xl font-black" style={{ color: acento }}>{m.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* TABS */}
      <div className="max-w-2xl mx-auto px-4 mb-4">
        <div className="flex gap-1 bg-white/[0.03] border border-white/5 rounded-2xl p-1">
          {(['stock', 'pedidos', 'conversaciones'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
              style={tab === t ? { backgroundColor: acento, color: '#030B1E' } : { color: '#71717a' }}
            >
              {t === 'stock' ? 'Stock' : t === 'pedidos' ? 'Pedidos' : 'Chats'}
              {t === 'pedidos' && pedidos.length > 0 && (
                <span className="ml-1.5 bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">{pedidos.length}</span>
              )}
              {t === 'conversaciones' && sesionesConAlerta.length > 0 && (
                <span className="ml-1.5 bg-red-500/80 px-1.5 py-0.5 rounded-full text-[10px] text-white">{sesionesConAlerta.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 pb-24">

        {/* STOCK */}
        {tab === 'stock' && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-1">
              Tocá para activar o desactivar productos
            </p>
            {productos.length === 0 && (
              <p className="text-zinc-600 text-sm text-center py-8">No hay productos cargados.</p>
            )}
            {productos.map(prod => (
              <div
                key={prod.id}
                className="bg-white/[0.03] border rounded-2xl px-4 py-3 flex items-center justify-between transition-all"
                style={{ borderColor: prod.disponible ? `${acento}25` : '#ffffff08' }}
              >
                <div className="flex-1 min-w-0 pr-3">
                  <p className={`text-sm font-bold truncate ${prod.disponible ? 'text-zinc-100' : 'text-zinc-600 line-through'}`}>
                    {prod.nombre}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {prod.categorias?.nombre} — ${formatPrecio(prod.precio)}
                  </p>
                </div>
                <button
                  onClick={() => toggleProducto(prod)}
                  disabled={updatingProducto === prod.id}
                  className="relative w-12 h-6 rounded-full transition-all flex-shrink-0 disabled:opacity-50"
                  style={{ backgroundColor: prod.disponible ? acento : '#3f3f46' }}
                >
                  <span
                    className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                    style={{ left: prod.disponible ? '26px' : '2px' }}
                  />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* PEDIDOS */}
        {tab === 'pedidos' && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-1">
              Pedidos activos de hoy
            </p>
            {pedidos.length === 0 && (
              <p className="text-zinc-600 text-sm text-center py-8">No hay pedidos activos.</p>
            )}
            {pedidos.map(pedido => {
              const items = Array.isArray(pedido.items) ? pedido.items : []
              const colorEstado = ESTADO_COMANDA_COLOR[pedido.estado_comanda] || '#888'
              const labelEstado = ESTADO_COMANDA_LABEL[pedido.estado_comanda] || pedido.estado_comanda
              const orden = ['recibido', 'en_cocina', 'en_camino', 'entregado']
              const idx = orden.indexOf(pedido.estado_comanda)
              const puedeAvanzar = idx < orden.length - 1

              return (
                <div key={pedido.id} className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-black text-zinc-100">{pedido.clientes?.nombre || 'Cliente'}</p>
                      <p className="text-xs text-zinc-500">
                        {pedido.tipo_entrega === 'delivery' ? '📦 Delivery' : '🏃 Takeaway'} — {timeAgo(pedido.created_at)}
                      </p>
                    </div>
                    <span
                      className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: `${colorEstado}20`, color: colorEstado }}
                    >
                      {labelEstado}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 mb-3">
                    {items.map((item, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-zinc-400">{item.cantidad}x {item.nombre}</span>
                        <span className="text-zinc-500">${formatPrecio(item.precio * item.cantidad)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between border-t border-white/5 pt-3 gap-2">
                    <span className="text-base font-black" style={{ color: acento }}>
                      ${formatPrecio(pedido.total)}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => imprimirComanda(pedido)}
                        className="text-xs font-bold text-zinc-500 hover:text-zinc-300 border border-white/10 px-3 py-1.5 rounded-xl transition-all"
                      >
                        Imprimir
                      </button>
                      {puedeAvanzar && (
                        <button
                          onClick={() => avanzarEstado(pedido)}
                          className="text-xs font-black px-3 py-1.5 rounded-xl transition-all active:scale-95"
                          style={{ backgroundColor: `${acento}20`, color: acento, border: `1px solid ${acento}30` }}
                        >
                          {idx === 0 ? '→ Cocina' : idx === 1 ? '→ En camino' : '→ Entregado'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* CONVERSACIONES */}
        {tab === 'conversaciones' && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-1">
              Bloqueá el bot para responder manualmente
            </p>
            {sesiones.length === 0 && (
              <p className="text-zinc-600 text-sm text-center py-8">No hay conversaciones activas.</p>
            )}
            {sesiones.map(sesion => (
              <div
                key={sesion.id}
                className="bg-white/[0.03] border rounded-2xl px-4 py-3 flex items-center justify-between"
                style={{
                  borderColor: sesion.requiere_atencion_humana
                    ? '#EF444430'
                    : sesion.bot_bloqueado ? `${acento}25` : '#ffffff08'
                }}
              >
                <div className="flex-1 min-w-0 pr-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-zinc-100 truncate">
                      {sesion.clientes?.nombre || 'Sin nombre'}
                    </p>
                    {sesion.requiere_atencion_humana && (
                      <span className="text-[10px] bg-red-500/20 text-red-400 font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                        ⚠️ Alerta
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {sesion.clientes?.telefono || '-'} — {timeAgo(sesion.updated_at)}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: sesion.bot_bloqueado ? acento : '#52525b' }}>
                    {sesion.bot_bloqueado ? '🔴 Modo manual activo' : '🤖 Bot respondiendo'}
                  </p>
                </div>
                <button
                  onClick={() => toggleBotBloqueado(sesion)}
                  disabled={updatingSesion === sesion.id}
                  className="relative w-12 h-6 rounded-full transition-all flex-shrink-0 disabled:opacity-50"
                  style={{ backgroundColor: sesion.bot_bloqueado ? acento : '#3f3f46' }}
                >
                  <span
                    className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                    style={{ left: sesion.bot_bloqueado ? '26px' : '2px' }}
                  />
                </button>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  )
}