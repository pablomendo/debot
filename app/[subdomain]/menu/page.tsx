'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useParams } from 'next/navigation'

// ─── Tipos Originales Preservados ───────────────────────────────────────────
type Local = {
  id: string
  nombre_comercial: string
  color_primario: string
  color_acento: string
  logo_url: string
  direccion: string
  bot_activo: boolean
  whatsapp_numero: string
  alias_transferencia: string
}

type Categoria = { id: string; nombre: string; orden: number }

type OpcionProducto = {
  id: string
  nombre: string
  precio: number
  disponible: boolean
  orden: number
}

type Producto = {
  id: string
  nombre: string
  descripcion: string
  precio: number
  foto_url: string
  disponible: boolean
  destacado: boolean
  categoria_id: string
  orden: number
  opciones?: OpcionProducto[]
}

type ItemCarrito = {
  producto: Producto
  cantidad: number
  opcionSeleccionada?: OpcionProducto
  notas?: string
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function MenuPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const params = useParams()
  const subdomain = params?.subdomain as string

  const [local, setLocal] = useState<Local | null>(null)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [categoriaActiva, setCategoriaActiva] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [productoModal, setProductoModal] = useState<Producto | null>(null)
  const [paso, setPaso] = useState<'menu' | 'datos'>('menu')

  // Modal estado
  const [opcionModal, setOpcionModal] = useState<OpcionProducto | null>(null)
  const [cantidadModal, setCantidadModal] = useState(1)
  const [notasModal, setNotasModal] = useState('')

  // Datos del cliente
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [tipoEntrega, setTipoEntrega] = useState<'delivery' | 'takeaway'>('delivery')
  const [direccion, setDireccion] = useState('')
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'mercadopago'>('efectivo')
  const [pagaCon, setPagaCon] = useState('')
  const [notasPedido, setNotasPedido] = useState('')

  const catRefs = useRef<Record<string, HTMLElement | null>>({})
  const tabsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function cargar() {
      const { data: localData } = await supabase
        .from('locales')
        .select('id, nombre_comercial, color_primario, color_acento, logo_url, direccion, bot_activo, whatsapp_numero, alias_transferencia')
        .eq('subdominio', subdomain)
        .single()
      if (!localData) { setLoading(false); return }
      setLocal(localData)

      const { data: cats } = await supabase
        .from('categorias')
        .select('id, nombre, orden')
        .eq('local_id', localData.id)
        .eq('activa', true)
        .order('orden')
      setCategorias(cats || [])
      if (cats && cats.length > 0) setCategoriaActiva(cats[0].id)

      // Cargar productos con sus opciones
      const { data: prods } = await supabase
        .from('productos')
        .select('id, nombre, descripcion, precio, foto_url, disponible, destacado, categoria_id, orden')
        .eq('local_id', localData.id)
        .order('orden')

      if (prods && prods.length > 0) {
        const prodIds = prods.map(p => p.id)
        const { data: opciones } = await supabase
          .from('opciones_producto')
          .select('id, producto_id, nombre, precio, disponible, orden')
          .in('producto_id', prodIds)
          .eq('disponible', true)
          .order('orden')

        const prodsConOpciones = prods.map(p => ({
          ...p,
          opciones: (opciones || []).filter(o => o.producto_id === p.id)
        }))
        setProductos(prodsConOpciones)
      }

      setLoading(false)
    }
    cargar()
  }, [subdomain])

  // ─── Carrito ──────────────────────────────────────────────────────────────
  const agregarAlCarrito = useCallback((prod: Producto, opcion?: OpcionProducto, cantidad = 1, notas = '') => {
    const key = `${prod.id}-${opcion?.id || 'base'}`
    setCarrito(prev => {
      const existe = prev.find(i => `${i.producto.id}-${i.opcionSeleccionada?.id || 'base'}` === key)
      if (existe) return prev.map(i =>
        `${i.producto.id}-${i.opcionSeleccionada?.id || 'base'}` === key
          ? { ...i, cantidad: i.cantidad + cantidad }
          : i
      )
      return [...prev, { producto: prod, cantidad, opcionSeleccionada: opcion, notas }]
    })
  }, [])

  const quitarDelCarrito = useCallback((prod: Producto, opcion?: OpcionProducto) => {
    const key = `${prod.id}-${opcion?.id || 'base'}`
    setCarrito(prev => {
      const item = prev.find(i => `${i.producto.id}-${i.opcionSeleccionada?.id || 'base'}` === key)
      if (!item) return prev
      if (item.cantidad === 1) return prev.filter(i => `${i.producto.id}-${i.opcionSeleccionada?.id || 'base'}` !== key)
      return prev.map(i =>
        `${i.producto.id}-${i.opcionSeleccionada?.id || 'base'}` === key
          ? { ...i, cantidad: i.cantidad - 1 }
          : i
      )
    })
  }, [])

  const totalCantidadProducto = useCallback((prodId: string) => {
    return carrito.filter(i => i.producto.id === prodId).reduce((s, i) => s + i.cantidad, 0)
  }, [carrito])

  const totalCarrito = carrito.reduce((s, i) => {
    const precioBase = i.producto.precio
    const precioOpcion = i.opcionSeleccionada?.precio || 0
    return s + (precioBase + precioOpcion) * i.cantidad
  }, 0)
  const cantidadTotal = carrito.reduce((s, i) => s + i.cantidad, 0)

  // ─── Abrir modal producto ─────────────────────────────────────────────────
  function abrirModal(prod: Producto) {
    if (!prod.disponible) return
    setProductoModal(prod)
    setCantidadModal(1)
    setNotasModal('')
    setOpcionModal(prod.opciones && prod.opciones.length > 0 ? prod.opciones[0] : null)
  }

  function confirmarModal() {
    if (!productoModal) return
    agregarAlCarrito(productoModal, opcionModal || undefined, cantidadModal, notasModal)
    setProductoModal(null)
  }

  // ─── WhatsApp ─────────────────────────────────────────────────────────────
  function abrirWhatsApp() {
    if (!local) return
    let msg = `🍣 *Pedido en ${local.nombre_comercial}*\n\n`
    msg += `👤 *Nombre:* ${nombre}\n`
    msg += `📱 *Tel:* ${telefono}\n`
    msg += tipoEntrega === 'delivery' ? `🛵 *Delivery a:* ${direccion}\n` : `🏃 *Retiro en local*\n`
    msg += `\n*Productos:*\n`
    carrito.forEach(item => {
      const precio = item.producto.precio + (item.opcionSeleccionada?.precio || 0)
      const variante = item.opcionSeleccionada ? ` (${item.opcionSeleccionada.nombre})` : ''
      msg += `• ${item.cantidad}x ${item.producto.nombre}${variante} — $${(precio * item.cantidad).toLocaleString()}\n`
      if (item.notas) msg += `   _Nota: ${item.notas}_\n`
    })
    msg += `\n💰 *Total: $${totalCarrito.toLocaleString()}*\n`
    msg += `💳 *Pago:* ${metodoPago === 'efectivo' ? `Efectivo${pagaCon ? ` (paga con $${pagaCon})` : ''}` : metodoPago === 'transferencia' ? `Transferencia (${local.alias_transferencia || 'alias a confirmar'})` : 'Mercado Pago'}\n`
    if (notasPedido) msg += `📝 *Aclaraciones:* ${notasPedido}\n`
    window.open(`https://wa.me/${local.whatsapp_numero}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  // ─── Scroll a categoría ───────────────────────────────────────────────────
  function scrollACategoria(catId: string) {
    setCategoriaActiva(catId)
    const el = catRefs.current[catId]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ─── Helper: renderiza el nombre de categoría en dos colores (primera palabra blanca, resto azul) ───
  function renderNombreCategoria(nombre: string) {
    const palabras = nombre.trim().split(' ')
    if (palabras.length === 1) {
      return <span style={{ color: '#ffffff', fontWeight: 700 }}>{palabras[0].toUpperCase()}</span>
    }
    const primera = palabras[0]
    const resto = palabras.slice(1).join(' ')
    return (
      <>
        <span style={{ color: '#ffffff', fontWeight: 700 }}>{primera.toUpperCase()}</span>
        <span style={{ color: '#4DA3FF', fontWeight: 700 }}>{resto.toUpperCase()}</span>
      </>
    )
  }

  const acento = '#003A99' // Azul oscuro
  const destacados = productos.filter(p => p.destacado && p.disponible)
  const productosFiltrados = busqueda
    ? productos.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || p.descripcion?.toLowerCase().includes(busqueda.toLowerCase()))
    : []

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-zinc-100">
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-zinc-200 border border-zinc-300">
        <span className="text-xl font-black text-zinc-800">S</span>
      </div>
      <p className="text-zinc-500 text-xs tracking-widest uppercase animate-pulse">Cargando menú...</p>
    </div>
  )

  if (!local) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-100">
      <p className="text-zinc-500 text-sm">Local no encontrado.</p>
    </div>
  )

  // ─── PASO DATOS ───────────────────────────────────────────────────────────
  if (paso === 'datos') return (
    <div className="min-h-screen bg-zinc-100 text-zinc-800">
      <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur-xl px-4 py-4 flex items-center justify-between border-zinc-300 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => setPaso('menu')} className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95 bg-zinc-200 border border-zinc-300 text-zinc-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <p className="text-zinc-900 font-black text-sm uppercase tracking-widest">Confirmá tu pedido</p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-4 pb-10">
        {/* Resumen */}
        <div className="rounded-2xl bg-white border border-zinc-300 shadow-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-200 bg-zinc-50">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-600">Tu pedido</p>
          </div>
          <div className="p-4 flex flex-col gap-3">
            {carrito.map((item, idx) => {
              const precio = item.producto.precio + (item.opcionSeleccionada?.precio || 0)
              return (
                <div key={idx} className="flex items-center justify-between gap-3 py-2 border-b border-zinc-100 last:border-none">
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-900 text-sm font-bold truncate">{item.producto.nombre}</p>
                    {item.opcionSeleccionada && <p className="text-xs text-zinc-500">{item.opcionSeleccionada.nombre}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center rounded-xl overflow-hidden border border-zinc-300 bg-zinc-50">
                      <button onClick={() => quitarDelCarrito(item.producto, item.opcionSeleccionada)}
                        className="w-8 h-8 flex items-center justify-center text-zinc-700 font-black text-lg transition-all active:scale-90 bg-zinc-200 hover:bg-zinc-300">−</button>
                      <span className="text-zinc-900 font-black text-sm w-8 text-center">{item.cantidad}</span>
                      <button onClick={() => agregarAlCarrito(item.producto, item.opcionSeleccionada)}
                        className="w-8 h-8 flex items-center justify-center text-zinc-700 font-black text-lg transition-all active:scale-90 bg-zinc-200 hover:bg-zinc-300">+</button>
                    </div>
                    <p className="text-zinc-900 font-black text-sm w-20 text-right">${(precio * item.cantidad).toLocaleString()}</p>
                  </div>
                </div>
              )
            })}
            <div className="pt-3 mt-1 flex justify-between items-center border-t border-zinc-300">
              <span className="text-zinc-900 font-black">Total</span>
              <span className="font-black text-xl text-zinc-900">${totalCarrito.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Datos personales */}
        <div className="rounded-2xl bg-white border border-zinc-300 shadow-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-200 bg-zinc-50">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-600">Tus datos</p>
          </div>
          <div className="p-4 flex flex-col gap-3">
            {[
              { label: 'Nombre', value: nombre, set: setNombre, type: 'text', placeholder: 'Tu nombre completo' },
              { label: 'WhatsApp', value: telefono, set: setTelefono, type: 'tel', placeholder: '11 1234-5678' },
            ].map(f => (
              <div key={f.label}>
                <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block text-zinc-500">{f.label}</label>
                <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                  className="w-full rounded-xl px-4 py-3 bg-zinc-50 text-zinc-900 border border-zinc-300 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-400 transition-all" />
              </div>
            ))}
          </div>
        </div>

        {/* Entrega */}
        <div className="rounded-2xl bg-white border border-zinc-300 shadow-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-200 bg-zinc-50">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-600">Entrega</p>
          </div>
          <div className="p-4 flex flex-col gap-3">
            <div className="flex gap-2">
              {(['delivery', 'takeaway'] as const).map(tipo => (
                <button key={tipo} onClick={() => setTipoEntrega(tipo)}
                  className="flex-1 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all active:scale-95 border"
                  style={tipoEntrega === tipo
                    ? { backgroundColor: acento, color: '#ffffff', borderColor: acento }
                    : { background: '#f4f4f5', color: '#71717a', borderColor: '#d4d4d8' }}>
                  {tipo === 'delivery' ? '🛵 Delivery' : '🏃 Retiro'}
                </button>
              ))}
            </div>
            {tipoEntrega === 'delivery' && (
              <div>
                <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block text-zinc-500">Dirección</label>
                <input type="text" value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Calle, número, piso/depto"
                  className="w-full rounded-xl px-4 py-3 bg-zinc-50 text-zinc-900 border border-zinc-300 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 transition-all" />
              </div>
            )}
          </div>
        </div>

        {/* Pago */}
        <div className="rounded-2xl bg-white border border-zinc-300 shadow-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-200 bg-zinc-50">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-600">Método de pago</p>
          </div>
          <div className="p-4 flex flex-col gap-2">
            {[
              { id: 'efectivo', emoji: '💵', label: 'Efectivo', desc: '10% de descuento' },
              { id: 'transferencia', emoji: '🏦', label: 'Transferencia', desc: local.alias_transferencia || 'Datos por WhatsApp' },
              { id: 'mercadopago', emoji: '💳', label: 'Mercado Pago', desc: 'Link de pago' },
            ].map(mp => (
              <button key={mp.id} onClick={() => setMetodoPago(mp.id as any)}
                className="flex items-center justify-between px-4 py-3.5 rounded-xl transition-all active:scale-[0.98] text-left border"
                style={metodoPago === mp.id
                  ? { background: '#fafafa', borderColor: '#18181b', borderWidth: '1.5px' }
                  : { background: '#ffffff', borderColor: '#e4e4e7' }}>
                <div className="flex items-center gap-3">
                  <span className="text-xl">{mp.emoji}</span>
                  <div>
                    <p className="text-zinc-900 text-sm font-bold">{mp.label}</p>
                    <p className="text-xs text-zinc-500">{mp.desc}</p>
                  </div>
                </div>
                <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 border-zinc-300">
                  {metodoPago === mp.id && <div className="w-2.5 h-2.5 rounded-full bg-zinc-900" />}
                </div>
              </button>
            ))}
            {metodoPago === 'efectivo' && (
              <div className="mt-1">
                <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block text-zinc-500">¿Con cuánto pagás? (opcional)</label>
                <input type="number" value={pagaCon} onChange={e => setPagaCon(e.target.value)} placeholder="Ej: 10000"
                  className="w-full rounded-xl px-4 py-3 bg-zinc-50 text-zinc-900 border border-zinc-300 text-sm placeholder:text-zinc-400 focus:outline-none" />
              </div>
            )}
          </div>
        </div>

        {/* Notas */}
        <div className="rounded-2xl bg-white border border-zinc-300 shadow-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-200 bg-zinc-50">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-600">Aclaraciones generales</p>
          </div>
          <div className="p-4">
            <textarea value={notasPedido} onChange={e => setNotasPedido(e.target.value)}
              placeholder="Alergia, sin algo en particular, aclaración general..." rows={3}
              className="w-full rounded-xl px-4 py-3 bg-zinc-50 text-zinc-900 border border-zinc-300 text-sm placeholder:text-zinc-400 focus:outline-none resize-none" />
          </div>
        </div>

        <button onClick={() => {
          if (!nombre.trim()) return alert('Ingresá tu nombre')
          if (!telefono.trim()) return alert('Ingresá tu WhatsApp')
          if (tipoEntrega === 'delivery' && !direccion.trim()) return alert('Ingresá tu dirección')
          abrirWhatsApp()
        }}
          className="w-full py-4 rounded-2xl font-black text-base uppercase tracking-widest text-white flex items-center justify-center gap-3 transition-all active:scale-[0.98] bg-emerald-600 hover:bg-emerald-700 shadow-md">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Enviar pedido por WhatsApp
        </button>
        <p className="text-center text-xs text-zinc-500 pb-6">
          Se abre WhatsApp con tu pedido completo ya escrito
        </p>
      </div>
    </div>
  )

  // ─── MENÚ PRINCIPAL ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-28 bg-zinc-100 text-zinc-800">
      {/* Inyección de Tipografía Genos + Saira Condensed */}
      <link href="https://fonts.googleapis.com/css2?family=Genos:ital,wght@0,100..900;1,100..900&family=Saira+Condensed:wght@500&display=swap" rel="stylesheet" />

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-white border-b border-zinc-300 shadow-md">
        <div className="max-w-7xl mx-auto px-4 pt-4 pb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {local.logo_url
              ? <img src={local.logo_url} alt={local.nombre_comercial} className="w-11 h-11 rounded-2xl object-cover border border-zinc-300" />
              : <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-lg bg-zinc-200 border border-zinc-300 text-zinc-800">
                  {local.nombre_comercial[0]}
                </div>
            }
            <div>
              <p className="text-zinc-900 font-black text-base leading-tight">{local.nombre_comercial}</p>
              {local.direccion && <p className="text-xs leading-tight text-zinc-500">{local.direccion}</p>}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {local.bot_activo && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Abierto</span>
              </div>
            )}

            {/* Carrito de compras visible arriba a la derecha en Desktop y Mobile */}
            <button 
              onClick={() => cantidadTotal > 0 && setPaso('datos')} 
              disabled={cantidadTotal === 0}
              className={`relative p-2.5 rounded-xl border transition-all ${
                cantidadTotal > 0 
                  ? 'bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-800 cursor-pointer' 
                  : 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed'
              }`}
              title="Ver mi pedido"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              {cantidadTotal > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-red-500 text-white font-black text-[10px] rounded-full flex items-center justify-center border border-white">
                  {cantidadTotal}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Buscador */}
        <div className="max-w-7xl mx-auto px-4 pb-3 mt-2">
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Buscar en el menú..." value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full rounded-xl pl-10 pr-4 py-2.5 bg-zinc-50 text-zinc-900 text-sm placeholder:text-zinc-400 border border-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-all" />
            {busqueda && (
              <button onClick={() => setBusqueda('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>

        {/* Tabs categorías */}
        {!busqueda && (
          <div ref={tabsRef} className="max-w-7xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {categorias.map(cat => (
              <button key={cat.id} onClick={() => scrollACategoria(cat.id)}
                className="shrink-0 px-4 py-2 rounded-xl text-xs uppercase tracking-wider transition-all border"
                style={categoriaActiva === cat.id
                  ? { backgroundColor: acento, color: '#ffffff', borderColor: acento, fontFamily: 'Saira Condensed, sans-serif', fontWeight: 500 }
                  : { background: '#ffffff', color: '#52525b', borderColor: '#e4e4e7', fontFamily: 'Saira Condensed, sans-serif', fontWeight: 500 }}>
                {cat.nombre}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* ── Layout Dividido: Listados de Productos (3 columnas) + Carrito Fijo Lateral (1 columna) ── */}
      <div className="max-w-7xl mx-auto px-4 py-6 lg:grid lg:grid-cols-4 lg:gap-8">
        
        {/* Contenedor Izquierdo: Menú de Productos */}
        <div className="lg:col-span-3 flex flex-col gap-8">
          {/* ── Búsqueda ── */}
          {busqueda && (
            <section>
              <p className="text-xs mb-4 text-zinc-500">
                {productosFiltrados.length} resultado{productosFiltrados.length !== 1 ? 's' : ''} para "<span className="text-zinc-900 font-bold">{busqueda}</span>"
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                {productosFiltrados.map(prod => (
                  <ProductoCard key={prod.id} prod={prod} acento={acento}
                    cantTotal={totalCantidadProducto(prod.id)}
                    onTap={() => abrirModal(prod)}
                    onQuitar={() => {
                      const enCarrito = carrito.find(i => i.producto.id === prod.id)
                      if (enCarrito) quitarDelCarrito(prod, enCarrito.opcionSeleccionada)
                    }} />
                ))}
              </div>
            </section>
          )}

          {/* ── Destacados ── */}
          {!busqueda && destacados.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-black uppercase tracking-widest text-zinc-700">⭐ Lo más pedido</span>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                {destacados.map(prod => {
                  const cant = totalCantidadProducto(prod.id)
                  return (
                    <button key={prod.id} onClick={() => abrirModal(prod)}
                      className="shrink-0 w-48 rounded-2xl overflow-hidden transition-all active:scale-95 bg-white border border-zinc-300 shadow-xl text-left">
                      <div className="relative">
                        {prod.foto_url
                          ? <img src={prod.foto_url} alt={prod.nombre} className="w-full h-32 object-cover" />
                          : <div className="w-full h-32 flex items-center justify-center bg-zinc-100 text-4xl">🍣</div>
                        }
                        {cant > 0 && (
                          <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black bg-zinc-900 text-white shadow-md">
                            {cant}
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-zinc-900 text-xs font-bold leading-tight line-clamp-2">{prod.nombre}</p>
                        <p className="font-black text-sm mt-1.5 text-zinc-900">${prod.precio.toLocaleString()}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {/* ── Categorías — Encabezado estilo imagen de marca: fondo negro, primera palabra blanca, resto azul ── */}
          {!busqueda && categorias.map(cat => {
            const prods = productos.filter(p => p.categoria_id === cat.id)
            if (prods.length === 0) return null
            return (
              <section key={cat.id} ref={el => { catRefs.current[cat.id] = el }}>
                <div className="mb-4">
                  <div
                    className="w-full px-6 py-3 rounded-2xl flex items-center justify-center gap-2"
                    style={{ backgroundColor: '#111111' }}
                  >
                    <h2
                      className="uppercase tracking-wider flex gap-2 items-baseline"
                      style={{
                        fontFamily: 'Genos, sans-serif',
                        fontWeight: 700,
                        fontSize: '1.75rem',
                        lineHeight: 1.1,
                        letterSpacing: '0.04em',
                      }}
                    >
                      {renderNombreCategoria(cat.nombre)}
                    </h2>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
                  {prods.map(prod => (
                    <ProductoCard key={prod.id} prod={prod} acento={acento}
                      cantTotal={totalCantidadProducto(prod.id)}
                      onTap={() => abrirModal(prod)}
                      onQuitar={() => {
                        const enCarrito = carrito.find(i => i.producto.id === prod.id)
                        if (enCarrito) quitarDelCarrito(prod, enCarrito.opcionSeleccionada)
                      }} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>

        {/* Contenedor Derecho: Panel de Carrito Fijo y Desglose Activo */}
        <aside className="mt-8 lg:mt-0 lg:col-span-1">
          <div className="sticky top-28 bg-white border border-zinc-300 shadow-xl rounded-2xl p-4 flex flex-col gap-4">
            <div className="border-b border-zinc-200 pb-2 flex justify-between items-center">
              <h3 className="font-black text-xs uppercase tracking-wider text-zinc-700">Tu Pedido</h3>
              <span className="bg-zinc-900 text-white text-xs px-2.5 py-0.5 rounded-full font-bold">{cantidadTotal}</span>
            </div>

            {carrito.length === 0 ? (
              <p className="text-zinc-400 text-xs text-center py-10">Tu carrito está vacío. Agregá rolls para comenzar.</p>
            ) : (
              <div className="flex flex-col gap-3 max-h-[260px] overflow-y-auto pr-1">
                {carrito.map((item, idx) => {
                  const precio = item.producto.precio + (item.opcionSeleccionada?.precio || 0)
                  return (
                    <div key={idx} className="flex flex-col gap-1 border-b border-zinc-100 pb-2 last:border-none">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="text-xs font-bold text-zinc-900 line-clamp-1">{item.producto.nombre}</p>
                          {item.opcionSeleccionada && <p className="text-[10px] text-zinc-500">{item.opcionSeleccionada.nombre}</p>}
                        </div>
                        <span className="text-xs font-black text-zinc-900 shrink-0">${(precio * item.cantidad).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <button onClick={() => quitarDelCarrito(item.producto, item.opcionSeleccionada)} className="w-5 h-5 rounded bg-zinc-200 flex items-center justify-center font-bold text-xs hover:bg-zinc-300">−</button>
                        <span className="text-xs font-bold w-4 text-center text-zinc-800">{item.cantidad}</span>
                        <button onClick={() => agregarAlCarrito(item.producto, item.opcionSeleccionada)} className="w-5 h-5 rounded bg-zinc-200 flex items-center justify-center font-bold text-xs hover:bg-zinc-300">+</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Opciones Obligatorias de Retiro o Delivery al final del card */}
            <div className="border-t border-zinc-200 pt-3 flex flex-col gap-3">
              <div className="flex gap-2">
                {(['delivery', 'takeaway'] as const).map(tipo => (
                  <button key={tipo} onClick={() => setTipoEntrega(tipo)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all border"
                    style={tipoEntrega === tipo
                      ? { backgroundColor: acento, color: '#ffffff', borderColor: acento }
                      : { background: '#f4f4f5', color: '#71717a', borderColor: '#d4d4d8' }}>
                    {tipo === 'delivery' ? '🛵 Delivery' : '🏃 Retiro'}
                  </button>
                ))}
              </div>

              {tipoEntrega === 'delivery' && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">Dirección de Envío</label>
                  <input type="text" value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Calle, altura..."
                    className="w-full rounded-lg px-3 py-1.5 bg-zinc-50 text-zinc-900 text-xs border border-zinc-300 focus:outline-none" />
                </div>
              )}

              <div className="pt-2 border-t border-zinc-100 flex justify-between items-center text-zinc-900 font-black text-sm">
                <span>Total:</span>
                <span>${totalCarrito.toLocaleString()}</span>
              </div>

              <button onClick={() => {
                if (carrito.length === 0) return alert('El carrito está vacío')
                setPaso('datos')
              }}
                className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all text-center"
                style={carrito.length > 0
                  ? { backgroundColor: acento, cursor: 'pointer' }
                  : { backgroundColor: '#d4d4d8', cursor: 'not-allowed' }}>
                Confirmar y Pagar
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* ── Barra fija inferior de soporte para Mobile ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-gradient-to-t from-zinc-100 via-zinc-100 to-transparent lg:hidden">
        <div className="max-w-7xl mx-auto">
          {cantidadTotal > 0 && (
            <button onClick={() => setPaso('datos')}
              className="w-full py-4 rounded-2xl font-black text-base uppercase tracking-widest text-white flex items-center justify-between px-6 transition-all shadow-xl hover:bg-zinc-800"
              style={{ backgroundColor: acento }}>
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black bg-white/20 text-white">{cantidadTotal}</span>
                <span>Ver pedido</span>
              </div>
              <span className="font-black">${totalCarrito.toLocaleString()}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Modal de Selección de Unidades y Sugerencia de Salsas (Radio Buttons) ── */}
      {productoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) setProductoModal(null) }}>
          <div className="bg-white rounded-3xl overflow-hidden w-full max-w-2xl border border-zinc-300 shadow-2xl flex flex-col max-h-[85vh]">
            
            {/* Cabecera / Foto */}
            <div className="relative shrink-0">
              {productoModal.foto_url
                ? <img src={productoModal.foto_url} alt={productoModal.nombre} className="w-full h-44 object-cover" />
                : <div className="w-full h-32 flex items-center justify-center bg-zinc-100 text-4xl">🍣</div>
              }
              <button onClick={() => setProductoModal(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center bg-black/50 text-white border border-white/20 hover:bg-black/70">
                ✕
              </button>
            </div>

            {/* Contenido / Opciones de Salsas */}
            <div className="p-5 flex flex-col gap-4 overflow-y-auto flex-1">
              <div className="text-center">
                <h3 className="text-zinc-900 font-black text-lg">{productoModal.nombre}</h3>
                {productoModal.descripcion && <p className="text-xs text-zinc-500 mt-1 leading-normal">{productoModal.descripcion}</p>}
              </div>

              {/* Módulo de Opciones / Salsas Requerido */}
              <div>
                <div className="flex justify-between items-center border-b border-zinc-200 pb-1.5 mb-2">
                  <p className="text-xs font-black uppercase tracking-wider text-zinc-700">Elegí tu salsa</p>
                  <span className="text-[10px] text-zinc-400 font-medium">Elegí 1 opción</span>
                </div>
                
                {productoModal.opciones && productoModal.opciones.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {productoModal.opciones.map(op => (
                      <label key={op.id} onClick={() => setOpcionModal(op)}
                        className="flex items-center justify-between px-3 py-2 rounded-xl border text-xs cursor-pointer transition-colors"
                        style={opcionModal?.id === op.id ? { background: '#fafafa', borderColor: '#18181b' } : { background: '#ffffff', borderColor: '#e4e4e7' }}>
                        <div className="flex items-center gap-2.5">
                          <input type="radio" checked={opcionModal?.id === op.id} readOnly className="accent-zinc-900 w-4 h-4" />
                          <span className="text-zinc-800 font-medium">{op.nombre}</span>
                        </div>
                        <span className="text-zinc-500 font-bold">{op.precio > 0 ? `+$${op.precio}` : '+$0'}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  /* Estructura estática fallback mapeando de forma idéntica tu foto de ejemplo si no tiene opciones en DB */
                  <div className="flex flex-col gap-2">
                    {[
                      { nombre: 'Salsa de Soja (Sin cargo)', precio: 0 },
                      { nombre: 'Cambio Salsa Agridulce', precio: 450 },
                      { nombre: 'Cambio Salsa Buenos Aires', precio: 450 },
                      { nombre: 'Cambio Salsa Teriyaki', precio: 450 }
                    ].map((salsa, i) => (
                      <div key={i} className="flex items-center justify-between py-2 text-xs text-zinc-800 border-b border-zinc-100 last:border-none">
                        <div className="flex items-center gap-2">
                          <input type="radio" name="salsa_fallback_radio" defaultChecked={i === 0} className="accent-zinc-900 w-4 h-4" />
                          <span className="font-medium text-zinc-700">{salsa.nombre}</span>
                        </div>
                        <span className="text-zinc-400 font-bold">${salsa.precio}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Campo Aclaraciones */}
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-zinc-500 mb-1">Aclaraciones</p>
                <input type="text" value={notasModal} onChange={e => setNotasModal(e.target.value)}
                  placeholder="Sin jengibre, sin wasabi, etc."
                  className="w-full rounded-xl px-3 py-2 bg-zinc-50 text-zinc-900 text-xs border border-zinc-300 focus:outline-none" />
              </div>
            </div>

            {/* Barra Inferior del Modal */}
            <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center rounded-xl overflow-hidden border border-zinc-300 bg-white">
                <button onClick={() => setCantidadModal(Math.max(1, cantidadModal - 1))} className="w-10 h-10 flex items-center justify-center font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200">−</button>
                <span className="text-zinc-900 font-bold text-sm w-8 text-center">{cantidadModal}</span>
                <button onClick={() => setCantidadModal(cantidadModal + 1)} className="w-10 h-10 flex items-center justify-center font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200">+</button>
              </div>
              
              <button onClick={confirmarModal}
                className="flex-1 h-10 rounded-xl font-black text-xs uppercase tracking-widest text-white bg-zinc-900 hover:bg-zinc-800 shadow-md">
                Agregar al pedido — ${((productoModal.precio + (opcionModal?.precio || 0)) * cantidadModal).toLocaleString()}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Card de producto ─────────────────────────────────────────────────────────
function ProductoCard({ prod, acento, cantTotal, onTap, onQuitar }: {
  prod: Producto
  acento: string
  cantTotal: number
  onTap: () => void
  onQuitar: () => void
}) {
  return (
    <div
      className="w-full flex flex-col rounded-2xl overflow-hidden bg-white border border-zinc-300 shadow-md transition-all"
      style={{ opacity: prod.disponible ? 1 : 0.6 }}>
      
      {/* Imagen / Selector */}
      <div className="relative w-full h-28 bg-zinc-50 cursor-pointer overflow-hidden" onClick={onTap}>
        {prod.foto_url
          ? <img src={prod.foto_url} alt={prod.nombre} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-3xl">🍣</div>
        }
        
        {cantTotal > 0 && (
          <div className="absolute top-2 right-2 min-w-[22px] h-5 px-1 rounded-full flex items-center justify-center text-xs font-black bg-zinc-900 text-white shadow-md z-10">
            {cantTotal}
          </div>
        )}

        {!prod.disponible && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <span className="text-red-600 text-[10px] font-black uppercase tracking-wider bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
              Sin stock
            </span>
          </div>
        )}
      </div>

      {/* Textos Informativos */}
      <div className="p-3 flex flex-col flex-1 justify-between gap-2">
        <div className="cursor-pointer" onClick={onTap}>
          <div className="flex items-start justify-between gap-1">
            <p className="text-zinc-900 font-bold text-xs line-clamp-1">{prod.nombre}</p>
            {prod.opciones && prod.opciones.length > 0 && prod.disponible && (
              <span className="shrink-0 text-[9px] px-1 py-0.5 rounded bg-zinc-100 text-zinc-500 border border-zinc-200 uppercase font-bold tracking-tighter">
                Opciones
              </span>
            )}
          </div>
          {prod.descripcion && (
            <p className="text-[11px] mt-0.5 leading-tight text-zinc-500 line-clamp-2">{prod.descripcion}</p>
          )}
        </div>

        {/* Controles de Cantidad Rectangulares Gris Síncronos */}
        <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-zinc-100 mt-auto">
          <p className="font-black text-xs text-zinc-900">
            ${prod.precio.toLocaleString()}
          </p>
          
          {prod.disponible && (
            <div className="flex items-center">
              {/* Botón de Menos pegado a la izquierda */}
              <button onClick={onQuitar}
                className="w-6 h-6 rounded-l bg-zinc-200 border-y border-l border-zinc-300 flex items-center justify-center font-bold text-xs text-zinc-700 hover:bg-zinc-300">
                −
              </button>
              <div className="w-6 h-6 bg-zinc-50 border-y border-zinc-300 flex items-center justify-center text-[11px] font-black text-zinc-900">
                {cantTotal}
              </div>
              {/* Botón de Más en un rectángulo gris */}
              <button onClick={onTap}
                className="w-6 h-6 rounded-r bg-zinc-200 border-y border-r border-zinc-300 flex items-center justify-center font-bold text-xs text-zinc-700 hover:bg-zinc-300">
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}