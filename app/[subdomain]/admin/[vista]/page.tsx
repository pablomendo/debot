'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useParams, useRouter } from 'next/navigation'

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Local = {
  id: string
  subdominio: string
  nombre_comercial: string
  bot_activo: boolean
  color_primario: string
  color_acento: string
  prompt_instrucciones: string
  reglas_de_oro: string
  nombre_bot: string
  tratamiento: string
  tono: string
  telefono_dueno: string
  codigo_status: string
  direccion: string
  alias_transferencia: string
  whatsapp_numero: string
  instagram_activo: boolean
}

type Producto = {
  id: string
  nombre: string
  descripcion: string
  precio: number
  disponible: boolean
  destacado: boolean
  foto_url: string
  categoria_id: string
  orden: number
}

type Categoria = {
  id: string
  nombre: string
  orden: number
  activa: boolean
}

type Pedido = {
  id: string
  cliente_nombre: string
  cliente_telefono: string
  cliente_direccion: string
  detalles_productos: any
  tipo_entrega: string
  metodo_pago: string
  total: number
  estado_pago: string
  estado_comanda: string
  created_at: string
}

type Sesion = {
  id: string
  cliente_telefono: string
  historial_json: any[]
  bot_bloqueado: boolean
  requiere_atencion: boolean
  updated_at: string
}

type Promocion = {
  id: string
  titulo: string
  descripcion: string
  descuento_pct: number
  precio_fijo: number
  dias_semana: number[]
  activa: boolean
}

type ConfigGastro = {
  tiempo_estimado_delivery: number
  tiempo_estimado_takeaway: number
  acepta_delivery: boolean
  acepta_takeaway: boolean
  monto_minimo_delivery: number
  mensaje_demora: string
}

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const TONOS = ['amigable', 'formal', 'divertido', 'elegante']
const TRATAMIENTOS = ['vos', 'tu', 'usted']

// ─── Componente principal ─────────────────────────────────────────────────────
export default function DashboardPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const params = useParams()
  const router = useRouter()
  const subdomain = params?.subdomain as string
  const vistaParam = params?.vista as string | undefined

  const [vista, setVista] = useState(vistaParam || 'comandas')
  const [local, setLocal] = useState<Local | null>(null)
  const [config, setConfig] = useState<ConfigGastro | null>(null)
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [promociones, setPromociones] = useState<Promocion[]>([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')

  // Modal producto
  const [modalProducto, setModalProducto] = useState(false)
  const [productoEdit, setProductoEdit] = useState<Partial<Producto> | null>(null)

  // Modal categoría
  const [modalCategoria, setModalCategoria] = useState(false)
  const [categoriaEdit, setCategoriaEdit] = useState<Partial<Categoria> | null>(null)

  // Modal promoción
  const [modalPromo, setModalPromo] = useState(false)
  const [promoEdit, setPromoEdit] = useState<Partial<Promocion> | null>(null)

  // ─── Carga inicial ──────────────────────────────────────────────────────────
  const cargarDatos = useCallback(async () => {
    setLoading(true)

    // Verificar sesión
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push(`/${subdomain}/admin`); return }

    // Cargar local
    const { data: localData } = await supabase
      .from('locales')
      .select('*')
      .eq('subdominio', subdomain)
      .single()

    if (!localData) { router.push(`/${subdomain}/admin`); return }
    setLocal(localData)

    // Activar bot al entrar al panel
    await supabase.from('locales').update({ bot_activo: true }).eq('id', localData.id)

    // Cargar config gastronómica
    const { data: configData } = await supabase
      .from('configuracion_gastronomia')
      .select('*')
      .eq('local_id', localData.id)
      .single()
    if (configData) setConfig(configData)

    // Cargar categorías
    const { data: cats } = await supabase
      .from('categorias')
      .select('*')
      .eq('local_id', localData.id)
      .order('orden')
    setCategorias(cats || [])

    // Cargar productos
    const { data: prods } = await supabase
      .from('productos')
      .select('*')
      .eq('local_id', localData.id)
      .order('categoria_id', { ascending: true })
      .order('orden', { ascending: true })
    setProductos(prods || [])

    // Cargar pedidos del día
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const { data: peds } = await supabase
      .from('pedidos')
      .select('*')
      .eq('local_id', localData.id)
      .gte('created_at', hoy.toISOString())
      .order('created_at', { ascending: false })
    setPedidos(peds || [])

    // Cargar sesiones activas
    const { data: sess } = await supabase
      .from('sesiones_chat')
      .select('*')
      .eq('local_id', localData.id)
      .order('updated_at', { ascending: false })
    setSesiones(sess || [])

    // Cargar promociones
    const { data: promos } = await supabase
      .from('promociones')
      .select('*')
      .eq('local_id', localData.id)
      .order('created_at', { ascending: false })
    setPromociones(promos || [])

    setLoading(false)
  }, [subdomain])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // Realtime pedidos
  useEffect(() => {
    if (!local) return
    const channel = supabase
      .channel('pedidos_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pedidos',
        filter: `local_id=eq.${local.id}`
      }, () => { cargarDatos() })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sesiones_chat',
        filter: `local_id=eq.${local.id}`
      }, () => { cargarDatos() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [local])

  // ─── Handlers ──────────────────────────────────────────────────────────────

  async function toggleBot() {
    if (!local) return
    const nuevo = !local.bot_activo
    await supabase.from('locales').update({ bot_activo: nuevo }).eq('id', local.id)
    setLocal({ ...local, bot_activo: nuevo })
    mostrarMsg(nuevo ? '🟢 Bot activado' : '🔴 Bot desactivado')
  }

  async function toggleDisponible(prod: Producto) {
    await supabase.from('productos').update({ disponible: !prod.disponible }).eq('id', prod.id)
    setProductos(prev => prev.map(p => p.id === prod.id ? { ...p, disponible: !p.disponible } : p))
  }

  async function toggleDestacado(prod: Producto) {
    await supabase.from('productos').update({ destacado: !prod.destacado }).eq('id', prod.id)
    setProductos(prev => prev.map(p => p.id === prod.id ? { ...p, destacado: !p.destacado } : p))
  }

  async function toggleBotSesion(sesion: Sesion) {
    await supabase.from('sesiones_chat').update({ bot_bloqueado: !sesion.bot_bloqueado }).eq('id', sesion.id)
    setSesiones(prev => prev.map(s => s.id === sesion.id ? { ...s, bot_bloqueado: !s.bot_bloqueado } : s))
  }

  async function marcarAtendida(sesion: Sesion) {
    await supabase.from('sesiones_chat').update({ requiere_atencion: false }).eq('id', sesion.id)
    setSesiones(prev => prev.map(s => s.id === sesion.id ? { ...s, requiere_atencion: false } : s))
  }

  async function actualizarEstadoPedido(pedido: Pedido, campo: string, valor: string) {
    await supabase.from('pedidos').update({ [campo]: valor }).eq('id', pedido.id)
    setPedidos(prev => prev.map(p => p.id === pedido.id ? { ...p, [campo]: valor } : p))
  }

  async function guardarLocal() {
    if (!local) return
    setGuardando(true)
    await supabase.from('locales').update({
      nombre_comercial: local.nombre_comercial,
      nombre_bot: local.nombre_bot,
      tratamiento: local.tratamiento,
      tono: local.tono,
      prompt_instrucciones: local.prompt_instrucciones,
      reglas_de_oro: local.reglas_de_oro,
      telefono_dueno: local.telefono_dueno,
      codigo_status: local.codigo_status,
      direccion: local.direccion,
      alias_transferencia: local.alias_transferencia,
      whatsapp_numero: local.whatsapp_numero,
      instagram_activo: local.instagram_activo,
      color_primario: local.color_primario,
      color_acento: local.color_acento,
    }).eq('id', local.id)

    if (config) {
      await supabase.from('configuracion_gastronomia').update({
        tiempo_estimado_delivery: config.tiempo_estimado_delivery,
        tiempo_estimado_takeaway: config.tiempo_estimado_takeaway,
        acepta_delivery: config.acepta_delivery,
        acepta_takeaway: config.acepta_takeaway,
        monto_minimo_delivery: config.monto_minimo_delivery,
        mensaje_demora: config.mensaje_demora,
      }).eq('local_id', local.id)
    }

    setGuardando(false)
    mostrarMsg('✅ Cambios guardados')
  }

  async function guardarProducto() {
    if (!productoEdit || !local) return
    setGuardando(true)
    if (productoEdit.id) {
      await supabase.from('productos').update({
        nombre: productoEdit.nombre,
        descripcion: productoEdit.descripcion,
        precio: productoEdit.precio,
        categoria_id: productoEdit.categoria_id,
        disponible: productoEdit.disponible,
        destacado: productoEdit.destacado,
        orden: productoEdit.orden,
      }).eq('id', productoEdit.id)
    } else {
      await supabase.from('productos').insert([{
        local_id: local.id,
        nombre: productoEdit.nombre,
        descripcion: productoEdit.descripcion,
        precio: productoEdit.precio,
        categoria_id: productoEdit.categoria_id,
        disponible: true,
        destacado: false,
        orden: productoEdit.orden || 0,
      }])
    }
    await cargarDatos()
    setModalProducto(false)
    setProductoEdit(null)
    setGuardando(false)
    mostrarMsg('✅ Producto guardado')
  }

  async function eliminarProducto(id: string) {
    if (!confirm('¿Eliminar este producto?')) return
    await supabase.from('productos').delete().eq('id', id)
    setProductos(prev => prev.filter(p => p.id !== id))
    mostrarMsg('🗑 Producto eliminado')
  }

  async function guardarCategoria() {
    if (!categoriaEdit || !local) return
    setGuardando(true)
    if (categoriaEdit.id) {
      await supabase.from('categorias').update({
        nombre: categoriaEdit.nombre,
        orden: categoriaEdit.orden,
        activa: categoriaEdit.activa,
      }).eq('id', categoriaEdit.id)
    } else {
      await supabase.from('categorias').insert([{
        local_id: local.id,
        nombre: categoriaEdit.nombre,
        orden: categoriaEdit.orden || 0,
        activa: true,
      }])
    }
    await cargarDatos()
    setModalCategoria(false)
    setCategoriaEdit(null)
    setGuardando(false)
    mostrarMsg('✅ Categoría guardada')
  }

  async function guardarPromo() {
    if (!promoEdit || !local) return
    setGuardando(true)
    if (promoEdit.id) {
      await supabase.from('promociones').update({
        titulo: promoEdit.titulo,
        descripcion: promoEdit.descripcion,
        descuento_pct: promoEdit.descuento_pct,
        precio_fijo: promoEdit.precio_fijo,
        dias_semana: promoEdit.dias_semana,
        activa: promoEdit.activa,
      }).eq('id', promoEdit.id)
    } else {
      await supabase.from('promociones').insert([{
        local_id: local.id,
        titulo: promoEdit.titulo,
        descripcion: promoEdit.descripcion,
        descuento_pct: promoEdit.descuento_pct || 0,
        precio_fijo: promoEdit.precio_fijo || null,
        dias_semana: promoEdit.dias_semana || [],
        activa: true,
      }])
    }
    await cargarDatos()
    setModalPromo(false)
    setPromoEdit(null)
    setGuardando(false)
    mostrarMsg('✅ Promoción guardada')
  }

  async function cerrarSesion() {
    if (local) await supabase.from('locales').update({ bot_activo: false }).eq('id', local.id)
    await supabase.auth.signOut()
    router.push(`/${subdomain}/admin`)
  }

  function mostrarMsg(texto: string) {
    setMsg(texto)
    setTimeout(() => setMsg(''), 3000)
  }

  // ─── Métricas del día ───────────────────────────────────────────────────────
  const totalFacturado = pedidos.filter(p => p.estado_pago === 'pagado').reduce((s, p) => s + p.total, 0)
  const pedidosActivos = pedidos.filter(p => !['entregado', 'cancelado'].includes(p.estado_comanda)).length
  const sesionesAlerta = sesiones.filter(s => s.requiere_atencion).length

  if (loading) return (
    <div className="min-h-screen bg-[#030B1E] flex items-center justify-center">
      <div className="text-[#00D2FF] text-sm tracking-widest animate-pulse uppercase">Cargando panel...</div>
    </div>
  )

  if (!local) return null

  // ─── UI ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#030B1E] text-white">

      {/* Toast */}
      {msg && (
        <div className="fixed top-4 right-4 z-50 bg-[#00D2FF] text-zinc-950 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-xl shadow-lg">
          {msg}
        </div>
      )}

      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#00D2FF]/10 border border-[#00D2FF]/20 flex items-center justify-center">
            <span className="text-sm font-black text-[#00D2FF]">D</span>
          </div>
          <div>
            <p className="text-xs font-black text-white tracking-widest uppercase">{local.nombre_comercial}</p>
            <p className="text-[10px] text-zinc-500">{subdomain}.debotz.vercel.app</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Toggle Bot */}
          <button onClick={toggleBot} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-black uppercase tracking-widest transition-all ${local.bot_activo ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
            <span className={`w-2 h-2 rounded-full ${local.bot_activo ? 'bg-emerald-400' : 'bg-red-400'}`} />
            Bot {local.bot_activo ? 'ON' : 'OFF'}
          </button>

          <button onClick={cerrarSesion} className="text-zinc-600 hover:text-zinc-400 text-xs uppercase tracking-widest transition-all">
            Salir
          </button>
        </div>
      </header>

      <div className="flex">

        {/* Sidebar */}
        <aside className="w-48 min-h-[calc(100vh-65px)] border-r border-white/10 p-4 flex flex-col gap-1">
          {[
            { id: 'comandas', label: '📋 Comandas', badge: pedidosActivos },
            { id: 'chats', label: '💬 Chats', badge: sesionesAlerta },
            { id: 'stock', label: '🔴 Stock' },
            { id: 'menu', label: '🍣 Menú' },
            { id: 'promos', label: '🎉 Promociones' },
            { id: 'tiempos', label: '⏱️ Tiempos' },
            { id: 'config', label: '⚙️ Config' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setVista(item.id)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-left transition-all ${vista === item.id ? 'bg-[#00D2FF]/10 text-[#00D2FF] border border-[#00D2FF]/20' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}
            >
              {item.label}
              {item.badge && item.badge > 0 ? (
                <span className="bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                  {item.badge}
                </span>
              ) : null}
            </button>
          ))}
        </aside>

        {/* Contenido */}
        <main className="flex-1 p-6 overflow-auto">

          {/* ── COMANDAS ── */}
          {vista === 'comandas' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-widest text-white">Comandas del día</h2>
                <div className="flex gap-4 text-xs text-zinc-500">
                  <span>Total pedidos: <span className="text-white font-bold">{pedidos.length}</span></span>
                  <span>Facturado: <span className="text-emerald-400 font-bold">${totalFacturado.toLocaleString()}</span></span>
                </div>
              </div>

              {pedidos.length === 0 && (
                <p className="text-zinc-600 text-xs italic">No hay pedidos hoy todavía.</p>
              )}

              {pedidos.map(pedido => (
                <div key={pedido.id} className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-white">{pedido.cliente_nombre || pedido.cliente_telefono}</p>
                      <p className="text-xs text-zinc-500">{pedido.tipo_entrega === 'delivery' ? `🛵 Delivery · ${pedido.cliente_direccion}` : '🏃 Take Away'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-white">${pedido.total.toLocaleString()}</p>
                      <p className="text-[10px] text-zinc-500">{pedido.metodo_pago}</p>
                    </div>
                  </div>

                  {/* Detalle productos */}
                  <div className="bg-white/5 rounded-xl p-3 text-xs text-zinc-400">
                    {Array.isArray(pedido.detalles_productos) && pedido.detalles_productos.map((item: any, i: number) => (
                      <p key={i}>{item.cantidad}x {item.nombre} — ${(item.precio * item.cantidad).toLocaleString()}</p>
                    ))}
                  </div>

                  {/* Estados */}
                  <div className="flex gap-2 flex-wrap">
                    <div className="flex gap-1">
                      {['recibido', 'en_cocina', 'en_camino', 'entregado'].map(estado => (
                        <button
                          key={estado}
                          onClick={() => actualizarEstadoPedido(pedido, 'estado_comanda', estado)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${pedido.estado_comanda === estado ? 'bg-[#00D2FF] text-zinc-950' : 'bg-white/5 text-zinc-500 hover:bg-white/10'}`}
                        >
                          {estado.replace('_', ' ')}
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-1 ml-auto">
                      {['pendiente', 'pagado'].map(estado => (
                        <button
                          key={estado}
                          onClick={() => actualizarEstadoPedido(pedido, 'estado_pago', estado)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${pedido.estado_pago === estado ? (estado === 'pagado' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white') : 'bg-white/5 text-zinc-500 hover:bg-white/10'}`}
                        >
                          {estado}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── CHATS ── */}
          {vista === 'chats' && (
            <div className="flex flex-col gap-4">
              <h2 className="text-sm font-black uppercase tracking-widest text-white">Conversaciones activas</h2>

              {sesiones.length === 0 && (
                <p className="text-zinc-600 text-xs italic">No hay conversaciones activas.</p>
              )}

              {sesiones.map(sesion => (
                <div key={sesion.id} className={`bg-white/[0.03] border rounded-2xl p-5 flex flex-col gap-3 ${sesion.requiere_atencion ? 'border-red-500/40' : 'border-white/10'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">{sesion.cliente_telefono}</p>
                      {sesion.requiere_atencion && (
                        <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">⚠️ Requiere atención</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {sesion.requiere_atencion && (
                        <button onClick={() => marcarAtendida(sesion)} className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                          Atendido
                        </button>
                      )}
                      <button
                        onClick={() => toggleBotSesion(sesion)}
                        className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${sesion.bot_bloqueado ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}
                      >
                        {sesion.bot_bloqueado ? '🔴 Bot pausado' : '🟢 Bot activo'}
                      </button>
                    </div>
                  </div>

                  {/* Historial últimos mensajes */}
                  <div className="bg-white/5 rounded-xl p-3 flex flex-col gap-1 max-h-48 overflow-y-auto">
                    {Array.isArray(sesion.historial_json) && sesion.historial_json.slice(-6).map((msg: any, i: number) => (
                      <div key={i} className={`text-xs px-3 py-1.5 rounded-lg max-w-[85%] ${msg.role === 'user' ? 'bg-white/10 text-zinc-300 self-start' : 'bg-[#00D2FF]/10 text-[#00D2FF] self-end'}`}>
                        {msg.content}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── STOCK ── */}
          {vista === 'stock' && (
            <div className="flex flex-col gap-4">
              <h2 className="text-sm font-black uppercase tracking-widest text-white">Stock del día</h2>
              <p className="text-xs text-zinc-500">Desactivá los productos que no tenés hoy. El bot los excluirá automáticamente y ofrecerá reemplazos.</p>

              {categorias.map(cat => {
                const prods = productos.filter(p => p.categoria_id === cat.id)
                if (prods.length === 0) return null
                return (
                  <div key={cat.id} className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
                    <p className="text-xs font-black text-[#00D2FF] uppercase tracking-widest mb-3">{cat.nombre}</p>
                    <div className="flex flex-col gap-2">
                      {prods.map(prod => (
                        <div key={prod.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                          <div>
                            <p className={`text-sm ${prod.disponible ? 'text-white' : 'text-zinc-600 line-through'}`}>{prod.nombre}</p>
                            <p className="text-xs text-zinc-500">${prod.precio.toLocaleString()}</p>
                          </div>
                          <button
                            onClick={() => toggleDisponible(prod)}
                            className={`relative w-11 h-6 rounded-full transition-all ${prod.disponible ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                          >
                            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${prod.disponible ? 'left-5' : 'left-0.5'}`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── MENÚ ── */}
          {vista === 'menu' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-widest text-white">Menú completo</h2>
                <div className="flex gap-2">
                  <button onClick={() => { setCategoriaEdit({}); setModalCategoria(true) }} className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-zinc-400 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all">
                    + Categoría
                  </button>
                  <button onClick={() => { setProductoEdit({}); setModalProducto(true) }} className="px-3 py-1.5 rounded-xl bg-[#00D2FF] text-zinc-950 text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all">
                    + Producto
                  </button>
                </div>
              </div>

              {categorias.map(cat => {
                const prods = productos.filter(p => p.categoria_id === cat.id)
                return (
                  <div key={cat.id} className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-black text-[#00D2FF] uppercase tracking-widest">{cat.nombre}</p>
                      <button onClick={() => { setCategoriaEdit(cat); setModalCategoria(true) }} className="text-zinc-600 hover:text-zinc-400 text-xs">editar</button>
                    </div>
                    {prods.length === 0 && <p className="text-zinc-700 text-xs italic">Sin productos en esta categoría.</p>}
                    <div className="flex flex-col gap-2">
                      {prods.map(prod => (
                        <div key={prod.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-white">{prod.nombre}</p>
                              {prod.destacado && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">Destacado</span>}
                              {!prod.disponible && <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-bold">Sin stock</span>}
                            </div>
                            <p className="text-xs text-zinc-500">${prod.precio.toLocaleString()}</p>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => toggleDestacado(prod)} className={`text-[10px] px-2 py-1 rounded-lg transition-all ${prod.destacado ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-600 hover:text-zinc-400'}`}>⭐</button>
                            <button onClick={() => { setProductoEdit(prod); setModalProducto(true) }} className="text-[10px] text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded-lg hover:bg-white/5 transition-all">editar</button>
                            <button onClick={() => eliminarProducto(prod.id)} className="text-[10px] text-red-600 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-500/5 transition-all">eliminar</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── PROMOCIONES ── */}
          {vista === 'promos' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-widest text-white">Promociones y ofertas</h2>
                <button onClick={() => { setPromoEdit({ dias_semana: [], activa: true }); setModalPromo(true) }} className="px-3 py-1.5 rounded-xl bg-[#00D2FF] text-zinc-950 text-xs font-black uppercase tracking-widest">
                  + Nueva promo
                </button>
              </div>

              {promociones.length === 0 && (
                <p className="text-zinc-600 text-xs italic">No hay promociones configuradas.</p>
              )}

              {promociones.map(promo => (
                <div key={promo.id} className={`bg-white/[0.03] border rounded-2xl p-5 flex flex-col gap-2 ${promo.activa ? 'border-emerald-500/20' : 'border-white/10'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">{promo.titulo}</p>
                      <p className="text-xs text-zinc-500">{promo.descripcion}</p>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${promo.activa ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-600'}`}>
                        {promo.activa ? 'Activa' : 'Inactiva'}
                      </span>
                      <button onClick={() => { setPromoEdit(promo); setModalPromo(true) }} className="text-zinc-500 hover:text-zinc-300 text-xs">editar</button>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {promo.dias_semana?.map(d => (
                      <span key={d} className="text-[10px] bg-white/5 text-zinc-400 px-2 py-0.5 rounded-full">{DIAS[d]}</span>
                    ))}
                  </div>
                  {promo.descuento_pct > 0 && <p className="text-xs text-[#00D2FF] font-bold">{promo.descuento_pct}% de descuento</p>}
                  {promo.precio_fijo && <p className="text-xs text-[#00D2FF] font-bold">Precio fijo: ${promo.precio_fijo.toLocaleString()}</p>}
                </div>
              ))}
            </div>
          )}

          {/* ── TIEMPOS ── */}
          {vista === 'tiempos' && config && (
            <div className="flex flex-col gap-6 max-w-lg">
              <h2 className="text-sm font-black uppercase tracking-widest text-white">Tiempos de entrega</h2>

              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Tiempo estimado delivery (minutos)</label>
                  <input
                    type="number"
                    value={config.tiempo_estimado_delivery}
                    onChange={e => setConfig({ ...config, tiempo_estimado_delivery: Number(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00D2FF]/50 transition-all"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Tiempo estimado take away (minutos)</label>
                  <input
                    type="number"
                    value={config.tiempo_estimado_takeaway}
                    onChange={e => setConfig({ ...config, tiempo_estimado_takeaway: Number(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00D2FF]/50 transition-all"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Mensaje de demora (opcional)</label>
                  <input
                    type="text"
                    value={config.mensaje_demora || ''}
                    onChange={e => setConfig({ ...config, mensaje_demora: e.target.value })}
                    placeholder="Ej: Estamos con alta demanda, sumá 15 min al tiempo estimado"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-[#00D2FF]/50 transition-all"
                  />
                </div>

                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                    <input type="checkbox" checked={config.acepta_delivery} onChange={e => setConfig({ ...config, acepta_delivery: e.target.checked })} className="accent-[#00D2FF]" />
                    Acepta delivery
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                    <input type="checkbox" checked={config.acepta_takeaway} onChange={e => setConfig({ ...config, acepta_takeaway: e.target.checked })} className="accent-[#00D2FF]" />
                    Acepta take away
                  </label>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Monto mínimo delivery ($)</label>
                  <input
                    type="number"
                    value={config.monto_minimo_delivery}
                    onChange={e => setConfig({ ...config, monto_minimo_delivery: Number(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00D2FF]/50 transition-all"
                  />
                </div>

                <button onClick={guardarLocal} disabled={guardando} className="w-full py-3 rounded-xl bg-[#00D2FF] text-zinc-950 font-black text-sm uppercase tracking-widest disabled:opacity-50">
                  {guardando ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          )}

          {/* ── CONFIG ── */}
          {vista === 'config' && local && (
            <div className="flex flex-col gap-6 max-w-xl">
              <h2 className="text-sm font-black uppercase tracking-widest text-white">Configuración del local</h2>

              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 flex flex-col gap-5">

                {[
                  { label: 'Nombre comercial', key: 'nombre_comercial', type: 'text' },
                  { label: 'Nombre del bot', key: 'nombre_bot', type: 'text' },
                  { label: 'Dirección', key: 'direccion', type: 'text' },
                  { label: 'Teléfono del dueño (WhatsApp)', key: 'telefono_dueno', type: 'text', placeholder: '5491155556666' },
                  { label: 'Código secreto para status', key: 'codigo_status', type: 'text', placeholder: 'status 1234' },
                  { label: 'Número WhatsApp del local', key: 'whatsapp_numero', type: 'text', placeholder: '5491155556666' },
                  { label: 'Alias transferencia', key: 'alias_transferencia', type: 'text' },
                  { label: 'Color primario (hex sin #)', key: 'color_primario', type: 'text', placeholder: '0A0F1E' },
                  { label: 'Color acento (hex sin #)', key: 'color_acento', type: 'text', placeholder: '0080FF' },
                ].map(field => (
                  <div key={field.key} className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{field.label}</label>
                    <input
                      type={field.type}
                      value={(local as any)[field.key] || ''}
                      placeholder={field.placeholder}
                      onChange={e => setLocal({ ...local, [field.key]: e.target.value } as Local)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-[#00D2FF]/50 transition-all"
                    />
                  </div>
                ))}

                <div className="flex gap-4">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Tratamiento</label>
                    <select value={local.tratamiento} onChange={e => setLocal({ ...local, tratamiento: e.target.value } as Local)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00D2FF]/50 transition-all">
                      {TRATAMIENTOS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Tono</label>
                    <select value={local.tono} onChange={e => setLocal({ ...local, tono: e.target.value } as Local)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00D2FF]/50 transition-all">
                      {TONOS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Reglas de oro del bot</label>
                  <textarea
                    value={local.reglas_de_oro || ''}
                    onChange={e => setLocal({ ...local, reglas_de_oro: e.target.value } as Local)}
                    rows={4}
                    placeholder="Ej: Siempre mencionar el 10% de descuento en efectivo. Sugerir bebida si el cliente pide tabla."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-[#00D2FF]/50 transition-all resize-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Prompt del bot (avanzado)</label>
                  <textarea
                    value={local.prompt_instrucciones || ''}
                    onChange={e => setLocal({ ...local, prompt_instrucciones: e.target.value } as Local)}
                    rows={8}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-[#00D2FF]/50 transition-all resize-none"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                  <input type="checkbox" checked={local.instagram_activo} onChange={e => setLocal({ ...local, instagram_activo: e.target.checked } as Local)} className="accent-[#00D2FF]" />
                  Instagram activo
                </label>

                <button onClick={guardarLocal} disabled={guardando} className="w-full py-3 rounded-xl bg-[#00D2FF] text-zinc-950 font-black text-sm uppercase tracking-widest disabled:opacity-50 transition-all">
                  {guardando ? 'Guardando...' : 'Guardar configuración'}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── MODAL PRODUCTO ── */}
      {modalProducto && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0D1B2E] border border-white/10 rounded-3xl p-6 w-full max-w-md flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white uppercase tracking-widest">{productoEdit?.id ? 'Editar producto' : 'Nuevo producto'}</h3>
              <button onClick={() => { setModalProducto(false); setProductoEdit(null) }} className="text-zinc-600 hover:text-zinc-400 text-xl">×</button>
            </div>

            {[
              { label: 'Nombre', key: 'nombre', type: 'text' },
              { label: 'Descripción', key: 'descripcion', type: 'text' },
              { label: 'Precio', key: 'precio', type: 'number' },
              { label: 'Orden', key: 'orden', type: 'number' },
            ].map(field => (
              <div key={field.key} className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{field.label}</label>
                <input
                  type={field.type}
                  value={(productoEdit as any)?.[field.key] || ''}
                  onChange={e => setProductoEdit({ ...productoEdit, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00D2FF]/50 transition-all"
                />
              </div>
            ))}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Categoría</label>
              <select
                value={productoEdit?.categoria_id || ''}
                onChange={e => setProductoEdit({ ...productoEdit, categoria_id: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00D2FF]/50 transition-all"
              >
                <option value="">Sin categoría</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setModalProducto(false); setProductoEdit(null) }} className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-zinc-400 text-sm font-black uppercase tracking-widest">
                Cancelar
              </button>
              <button onClick={guardarProducto} disabled={guardando} className="flex-1 py-3 rounded-xl bg-[#00D2FF] text-zinc-950 text-sm font-black uppercase tracking-widest disabled:opacity-50">
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CATEGORÍA ── */}
      {modalCategoria && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0D1B2E] border border-white/10 rounded-3xl p-6 w-full max-w-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white uppercase tracking-widest">{categoriaEdit?.id ? 'Editar categoría' : 'Nueva categoría'}</h3>
              <button onClick={() => { setModalCategoria(false); setCategoriaEdit(null) }} className="text-zinc-600 hover:text-zinc-400 text-xl">×</button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Nombre</label>
              <input
                type="text"
                value={categoriaEdit?.nombre || ''}
                onChange={e => setCategoriaEdit({ ...categoriaEdit, nombre: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00D2FF]/50 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Orden</label>
              <input
                type="number"
                value={categoriaEdit?.orden || 0}
                onChange={e => setCategoriaEdit({ ...categoriaEdit, orden: Number(e.target.value) })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00D2FF]/50 transition-all"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setModalCategoria(false); setCategoriaEdit(null) }} className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-zinc-400 text-sm font-black uppercase tracking-widest">
                Cancelar
              </button>
              <button onClick={guardarCategoria} disabled={guardando} className="flex-1 py-3 rounded-xl bg-[#00D2FF] text-zinc-950 text-sm font-black uppercase tracking-widest disabled:opacity-50">
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL PROMOCIÓN ── */}
      {modalPromo && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0D1B2E] border border-white/10 rounded-3xl p-6 w-full max-w-md flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white uppercase tracking-widest">{promoEdit?.id ? 'Editar promoción' : 'Nueva promoción'}</h3>
              <button onClick={() => { setModalPromo(false); setPromoEdit(null) }} className="text-zinc-600 hover:text-zinc-400 text-xl">×</button>
            </div>

            {[
              { label: 'Título', key: 'titulo', type: 'text' },
              { label: 'Descripción', key: 'descripcion', type: 'text' },
              { label: 'Descuento %', key: 'descuento_pct', type: 'number' },
              { label: 'Precio fijo (opcional)', key: 'precio_fijo', type: 'number' },
            ].map(field => (
              <div key={field.key} className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{field.label}</label>
                <input
                  type={field.type}
                  value={(promoEdit as any)?.[field.key] || ''}
                  onChange={e => setPromoEdit({ ...promoEdit, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00D2FF]/50 transition-all"
                />
              </div>
            ))}

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Días de la semana</label>
              <div className="flex gap-2 flex-wrap">
                {DIAS.map((dia, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      const dias = promoEdit?.dias_semana || []
                      const nuevo = dias.includes(i) ? dias.filter(d => d !== i) : [...dias, i]
                      setPromoEdit({ ...promoEdit, dias_semana: nuevo })
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${promoEdit?.dias_semana?.includes(i) ? 'bg-[#00D2FF] text-zinc-950' : 'bg-white/5 text-zinc-500 hover:bg-white/10'}`}
                  >
                    {dia}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
              <input type="checkbox" checked={promoEdit?.activa ?? true} onChange={e => setPromoEdit({ ...promoEdit, activa: e.target.checked })} className="accent-[#00D2FF]" />
              Promoción activa
            </label>

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setModalPromo(false); setPromoEdit(null) }} className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-zinc-400 text-sm font-black uppercase tracking-widest">
                Cancelar
              </button>
              <button onClick={guardarPromo} disabled={guardando} className="flex-1 py-3 rounded-xl bg-[#00D2FF] text-zinc-950 text-sm font-black uppercase tracking-widest disabled:opacity-50">
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}