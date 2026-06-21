import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

// ─── Clientes ─────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

// ─── Tipos ────────────────────────────────────────────────────────────────────
type MensajeHistorial = { role: 'user' | 'assistant'; content: string }

// ─── GET: Verificación de webhook con Meta ────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

// ─── POST: Recibir mensajes entrantes ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Meta siempre manda un array de entries
    const entry = body?.entry?.[0]
    const change = entry?.changes?.[0]
    const value = change?.value
    const messages = value?.messages

    // Sin mensajes, ignorar (puede ser un status update)
    if (!messages || messages.length === 0) {
      return NextResponse.json({ status: 'ok' })
    }

    const mensaje = messages[0]
    const numeroCliente = mensaje.from
    const tipoMensaje = mensaje.type

    // Solo procesamos texto por ahora (audio va después con Whisper)
    if (tipoMensaje !== 'text') {
      return NextResponse.json({ status: 'tipo_no_soportado' })
    }

    const textoMensaje = mensaje.text?.body?.trim()
    if (!textoMensaje) return NextResponse.json({ status: 'ok' })

    // El número del local que recibió el mensaje (metadata de Meta)
    const numeroLocal = value?.metadata?.display_phone_number?.replace(/\D/g, '') || ''

    // ── Identificar el local por número de WhatsApp ───────────────────────────
    const { data: local } = await supabase
      .from('locales')
      .select(`
        id, nombre_comercial, subdominio, bot_activo,
        prompt_instrucciones, reglas_de_oro, nombre_bot,
        tratamiento, tono, telefono_dueno, codigo_status,
        alias_transferencia, whatsapp_numero,
        configuracion_gastronomia (
          tiempo_estimado_delivery, tiempo_estimado_takeaway,
          acepta_delivery, acepta_takeaway, monto_minimo_delivery,
          mensaje_demora
        )
      `)
      .or(`whatsapp_numero.eq.${numeroLocal},whatsapp_numero.eq.${numeroCliente}`)
      .single()

    if (!local) {
      console.error('Local no encontrado. numeroLocal recibido de Meta:', numeroLocal, '| numeroCliente:', numeroCliente)
      return NextResponse.json({ status: 'local_no_encontrado' })
    }

    // ── Canal del dueño: comando status ──────────────────────────────────────
    if (local.telefono_dueno && numeroCliente.includes(local.telefono_dueno.replace(/\D/g, ''))) {
      const textoLower = textoMensaje.toLowerCase()
      const codigoOk = !local.codigo_status || textoLower.includes(local.codigo_status.toLowerCase()) || textoLower === 'status'

      if (codigoOk && textoLower.includes('status')) {
        const resumen = await generarResumenCaja(local.id)
        await enviarMensajeWA(numeroCliente, resumen, local.whatsapp_numero)
        return NextResponse.json({ status: 'status_enviado' })
      }
    }

    // ── Bot inactivo ──────────────────────────────────────────────────────────
    if (!local.bot_activo) {
      return NextResponse.json({ status: 'bot_inactivo' })
    }

    // ── Verificar sesión del chat ─────────────────────────────────────────────
    let { data: sesion } = await supabase
      .from('sesiones_chat')
      .select('id, historial_json, bot_bloqueado, requiere_atencion, cliente_id')
      .eq('local_id', local.id)
      .eq('cliente_telefono', numeroCliente)
      .eq('canal', 'whatsapp')
      .maybeSingle()

    // Si el cajero bloqueó este chat, no responder
    if (sesion?.bot_bloqueado) {
      return NextResponse.json({ status: 'bot_bloqueado_en_sesion' })
    }

    // ── Cargar o crear cliente ────────────────────────────────────────────────
    let clienteId = sesion?.cliente_id || null
    let { data: cliente } = await supabase
      .from('clientes')
      .select('id, nombre, cantidad_pedidos, pedido_frecuente, ultimo_pedido_at')
      .eq('local_id', local.id)
      .eq('telefono', numeroCliente)
      .maybeSingle()

    if (!cliente) {
      const { data: nuevoCliente } = await supabase
        .from('clientes')
        .insert([{ local_id: local.id, telefono: numeroCliente, canal: 'whatsapp' }])
        .select()
        .single()
      cliente = nuevoCliente
      clienteId = nuevoCliente?.id || null
    }

    // ── Crear o actualizar sesión ─────────────────────────────────────────────
    if (!sesion) {
      const { data: nuevaSesion } = await supabase
        .from('sesiones_chat')
        .insert([{
          local_id: local.id,
          cliente_id: clienteId,
          cliente_telefono: numeroCliente,
          canal: 'whatsapp',
          historial_json: [],
        }])
        .select()
        .single()
      sesion = nuevaSesion
    }

    // ── Historial: últimos 15 mensajes ────────────────────────────────────────
    const historial: MensajeHistorial[] = Array.isArray(sesion?.historial_json)
      ? sesion.historial_json.slice(-14)
      : []

    // Agregar el mensaje actual del cliente
    historial.push({ role: 'user', content: textoMensaje })

    // ── Detectar si necesita atención humana ──────────────────────────────────
    const necesitaAtencion = detectarNecesidadAtencion(textoMensaje)

    // ── Cargar menú disponible ────────────────────────────────────────────────
    const menuTexto = await cargarMenuDisponible(local.id)

    // ── Cargar promociones del día ────────────────────────────────────────────
    const promosTexto = await cargarPromociones(local.id)

    // ── Construir prompt del sistema ──────────────────────────────────────────
    const config = Array.isArray((local as any).configuracion_gastronomia)
      ? (local as any).configuracion_gastronomia[0]
      : (local as any).configuracion_gastronomia

    const sistemaPrompt = construirPrompt({
      local,
      config,
      menuTexto,
      promosTexto,
      cliente,
    })

    // ── Llamar a GPT-4o ───────────────────────────────────────────────────────
    const respuestaGPT = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 600,
      temperature: 0.7,
      messages: [
        { role: 'system', content: sistemaPrompt },
        ...historial.slice(0, -1), // historial previo
        { role: 'user', content: textoMensaje }, // mensaje actual
      ],
    })

    const respuestaTexto = respuestaGPT.choices[0]?.message?.content || 'Disculpá, tuve un problema. ¿Podés repetir tu pedido?'

    // ── Guardar historial actualizado ─────────────────────────────────────────
    historial.push({ role: 'assistant', content: respuestaTexto })
    const historialActualizado = historial.slice(-15) // máximo 15 mensajes

    await supabase
      .from('sesiones_chat')
      .update({
        historial_json: historialActualizado,
        requiere_atencion: necesitaAtencion,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sesion!.id)

    // Si necesita atención, también actualizar el flag en la sesión
    if (necesitaAtencion) {
      await supabase
        .from('sesiones_chat')
        .update({ bot_bloqueado: true })
        .eq('id', sesion!.id)
    }

    // ── Enviar respuesta al cliente ───────────────────────────────────────────
    await enviarMensajeWA(numeroCliente, respuestaTexto, local.whatsapp_numero)

    return NextResponse.json({ status: 'ok' })

  } catch (error) {
    console.error('Error en webhook WhatsApp:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ─── Funciones auxiliares ─────────────────────────────────────────────────────

async function cargarMenuDisponible(localId: string): Promise<string> {
  const { data: categorias } = await supabase
    .from('categorias')
    .select('id, nombre')
    .eq('local_id', localId)
    .eq('activa', true)
    .order('orden')

  const { data: productos } = await supabase
    .from('productos')
    .select('id, nombre, descripcion, precio, disponible, categoria_id')
    .eq('local_id', localId)
    .order('orden')

  const { data: opciones } = await supabase
    .from('opciones_producto')
    .select('producto_id, nombre, precio, disponible')
    .eq('disponible', true)

  if (!productos || !categorias) return 'Menú no disponible.'

  const disponibles = productos.filter(p => p.disponible)
  const noDisponibles = productos.filter(p => !p.disponible)

  let texto = '=== MENÚ DISPONIBLE HOY ===\n\n'

  for (const cat of categorias) {
    const prods = disponibles.filter(p => p.categoria_id === cat.id)
    if (prods.length === 0) continue
    texto += `📌 ${cat.nombre.toUpperCase()}\n`
    for (const prod of prods) {
      texto += `• ${prod.nombre} — $${prod.precio.toLocaleString()}`
      if (prod.descripcion) texto += ` (${prod.descripcion})`
      // Opciones del producto
      const opsProd = (opciones || []).filter(o => o.producto_id === prod.id)
      if (opsProd.length > 0) {
        texto += `\n  Variantes: ${opsProd.map(o => `${o.nombre}${o.precio > 0 ? ` +$${o.precio}` : ''}`).join(', ')}`
      }
      texto += '\n'
    }
    texto += '\n'
  }

  if (noDisponibles.length > 0) {
    texto += `=== SIN STOCK HOY (NO OFRECER) ===\n`
    texto += noDisponibles.map(p => `• ${p.nombre}`).join('\n')
    texto += '\n'
  }

  return texto
}

async function cargarPromociones(localId: string): Promise<string> {
  const diaSemana = new Date().getDay() // 0=dom, 6=sab
  const { data: promos } = await supabase
    .from('promociones')
    .select('titulo, descripcion, descuento_pct, precio_fijo, dias_semana')
    .eq('local_id', localId)
    .eq('activa', true)

  if (!promos || promos.length === 0) return ''

  const promosHoy = promos.filter(p =>
    !p.dias_semana || p.dias_semana.length === 0 || p.dias_semana.includes(diaSemana)
  )

  if (promosHoy.length === 0) return ''

  let texto = '=== PROMOCIONES DE HOY ===\n'
  for (const promo of promosHoy) {
    texto += `• ${promo.titulo}`
    if (promo.descuento_pct > 0) texto += ` — ${promo.descuento_pct}% de descuento`
    if (promo.precio_fijo) texto += ` — Precio especial: $${promo.precio_fijo.toLocaleString()}`
    if (promo.descripcion) texto += ` (${promo.descripcion})`
    texto += '\n'
  }
  return texto
}

function construirPrompt({ local, config, menuTexto, promosTexto, cliente }: {
  local: any
  config: any
  menuTexto: string
  promosTexto: string
  cliente: any
}) {
  const esClienteRecurrente = cliente && cliente.cantidad_pedidos > 0
  const tiempoDelivery = config?.tiempo_estimado_delivery || 40
  const tiempoTakeaway = config?.tiempo_estimado_takeaway || 20
  const mensajeDemora = config?.mensaje_demora || ''
  const acepDelivery = config?.acepta_delivery !== false
  const acepTakeaway = config?.acepta_takeaway !== false
  const montoMin = config?.monto_minimo_delivery || 0

  let prompt = local.prompt_instrucciones || ''

  // Si no tiene prompt personalizado, usar el base
  if (!prompt) {
    prompt = `Sos ${local.nombre_bot || 'el asistente'} de ${local.nombre_comercial}.`
    prompt += ` Hablás de ${local.tratamiento || 'vos'} con tono ${local.tono || 'amigable'}.`
  }

  prompt += `\n\nFECHA Y HORA ACTUAL: ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}\n`

  if (esClienteRecurrente) {
    prompt += `\nCLIENTE RECURRENTE: ${cliente.nombre || 'cliente frecuente'} — ha pedido ${cliente.cantidad_pedidos} veces antes.`
    if (cliente.pedido_frecuente) {
      prompt += ` Su pedido habitual: ${JSON.stringify(cliente.pedido_frecuente)}.`
    }
    prompt += ' Saludalo con calidez mencionando que ya lo conocés.\n'
  }

  prompt += `\n${menuTexto}`

  if (promosTexto) prompt += `\n${promosTexto}`

  prompt += `\n=== CONFIGURACIÓN OPERATIVA ===\n`
  if (acepDelivery) prompt += `• Delivery: ${tiempoDelivery} minutos${mensajeDemora ? ` (${mensajeDemora})` : ''}\n`
  if (acepTakeaway) prompt += `• Take away: ${tiempoTakeaway} minutos\n`
  if (montoMin > 0) prompt += `• Monto mínimo para delivery: $${montoMin.toLocaleString()}\n`
  if (!acepDelivery) prompt += `• HOY NO HACEMOS DELIVERY\n`
  if (!acepTakeaway) prompt += `• HOY NO HACEMOS TAKE AWAY\n`

  if (local.reglas_de_oro) {
    prompt += `\n=== REGLAS DE ORO ===\n${local.reglas_de_oro}\n`
  }

  prompt += `
=== INSTRUCCIONES CRÍTICAS ===
1. NUNCA ofrezcas productos que están en la lista SIN STOCK. Si el cliente los pide, decile que no hay hoy y ofrecé 2 alternativas similares.
2. Al confirmar un pedido siempre resumí: productos elegidos, total, tiempo estimado y preguntá el método de pago.
3. Si el cliente elige efectivo, preguntá con cuánto va a pagar para calcular el vuelto.
4. Si el cliente elige transferencia, informá el alias: ${local.alias_transferencia || 'a confirmar'}.
5. Si el cliente menciona un retraso, demora excesiva o está molesto, respondé con empatía y decí que en un momento alguien del equipo lo contacta.
6. Siempre mencioná el tiempo estimado al confirmar el pedido.
7. Respondé siempre en español rioplatense, de forma concisa. Máximo 3-4 líneas por mensaje.
8. No inventes precios ni productos que no estén en el menú.
`

  return prompt
}

function detectarNecesidadAtencion(texto: string): boolean {
  const frases = [
    'donde esta', 'donde está', 'cuanto falta', 'cuánto falta',
    'hace mucho', 'mucho tiempo', 'no llega', 'no llegó',
    'cancelar', 'quiero cancelar', 'devuelvan', 'muy tarde',
    'media hora', 'una hora', 'tardaron', 'tardando',
    'enojado', 'molesto', 'mal', 'horrible', 'pesimo', 'pésimo',
    'quiero hablar', 'hablar con alguien', 'hablar con una persona',
  ]
  const textoLower = texto.toLowerCase()
  return frases.some(f => textoLower.includes(f))
}

async function generarResumenCaja(localId: string): Promise<string> {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const { data: pedidos } = await supabase
    .from('pedidos')
    .select('total, estado_pago, metodo_pago, estado_comanda')
    .eq('local_id', localId)
    .gte('created_at', hoy.toISOString())

  if (!pedidos || pedidos.length === 0) {
    return '🍣 Hola jefe! Por el momento no tenemos pedidos hoy todavía.'
  }

  const cerrados = pedidos.filter(p => !['cancelado'].includes(p.estado_comanda))
  const pagados = pedidos.filter(p => p.estado_pago === 'pagado')
  const totalFacturado = pagados.reduce((s, p) => s + p.total, 0)
  const enCamino = pedidos.filter(p => p.estado_comanda === 'en_camino').length
  const enCocina = pedidos.filter(p => p.estado_comanda === 'en_cocina').length

  const porMetodo = {
    efectivo: pagados.filter(p => p.metodo_pago === 'efectivo').reduce((s, p) => s + p.total, 0),
    transferencia: pagados.filter(p => p.metodo_pago === 'transferencia').reduce((s, p) => s + p.total, 0),
    mercadopago: pagados.filter(p => p.metodo_pago === 'mercadopago').reduce((s, p) => s + p.total, 0),
  }

  let msg = `🍣 *Hola jefe! Acá el resumen de hoy:*\n\n`
  msg += `✅ Pedidos cerrados: *${cerrados.length}*\n`
  msg += `💰 Facturación cobrada: *$${totalFacturado.toLocaleString()}*\n\n`
  msg += `📊 *Desglose por pago:*\n`
  if (porMetodo.efectivo > 0) msg += `   💵 Efectivo: $${porMetodo.efectivo.toLocaleString()}\n`
  if (porMetodo.transferencia > 0) msg += `   🏦 Transferencia: $${porMetodo.transferencia.toLocaleString()}\n`
  if (porMetodo.mercadopago > 0) msg += `   💳 Mercado Pago: $${porMetodo.mercadopago.toLocaleString()}\n`
  if (enCamino > 0) msg += `\n🛵 En camino ahora: *${enCamino}* pedido${enCamino > 1 ? 's' : ''}`
  if (enCocina > 0) msg += `\n👨‍🍳 En cocina: *${enCocina}* pedido${enCocina > 1 ? 's' : ''}`

  return msg
}

async function enviarMensajeWA(para: string, texto: string, numeroLocal: string): Promise<void> {
  const accessToken = process.env.META_ACCESS_TOKEN
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID

  if (!accessToken || !phoneNumberId || accessToken === 'placeholder') {
    console.log('META no configurado. Mensaje que se enviaría:', { para, texto })
    await supabase.from('debug_logs').insert([{
      mensaje: 'META no configurado (faltan variables de entorno). Para: ' + para,
    }])
    return
  }

  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: para,
      type: 'text',
      text: { body: texto },
    }),
  })

  const responseBody = await res.json().catch(() => null)

  // Guardamos el resultado en Supabase para verlo fácil en el Table Editor
  await supabase.from('debug_logs').insert([{
    mensaje: JSON.stringify({ ok: res.ok, status: res.status, to: para, body: responseBody }, null, 2),
  }])

  if (!res.ok) {
    console.error('❌ Meta rechazó el envío del mensaje:', { status: res.status, to: para, body: responseBody })
  } else {
    console.log('✅ Meta confirmó el envío:', responseBody)
  }
}