import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const hostname = request.headers.get('host') || ''

  // 1. Definimos los dominios raíz del sistema (tu dominio real de Vercel)
  const ROOT_DOMAINS = ['localhost:3000', 'debotz.vercel.app']

  // 2. Filtro de seguridad: Ignorar archivos estáticos, imágenes, API y bundles de Next
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/api') ||
    url.pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // 3. Extraer el subdominio dinámicamente limpiando la extensión de Vercel
  let subdomain = ''
  
  if (hostname.includes('vercel.app')) {
    // Si entran a 'pablo.debotz.vercel.app', limpia '.vercel.app' -> queda 'pablo.debotz'
    const currentHost = hostname.replace('.vercel.app', '')
    const parts = currentHost.split('.')
    
    // Si tiene más de una parte (ej: 'pablo' y 'debotz'), la primera es el inquilino/subdominio
    if (parts.length > 1) {
      subdomain = parts[0]
    }
  } else {
    // Lógica para cuando le metas un dominio propio definitivo en el futuro
    const parts = hostname.split('.')
    if (parts.length > 1 && !ROOT_DOMAINS.includes(hostname)) {
      subdomain = parts[0]
    }
  }

  // 4. Si el subdominio existe y NO es el dominio principal ('debotz'), reescribimos la ruta hacia la carpeta dinámica
  if (subdomain && subdomain !== 'debotz' && !ROOT_DOMAINS.includes(hostname)) {
    url.pathname = `/[subdomain]${url.pathname}`
    return NextResponse.rewrite(url)
  }

  // Si es la raíz pura (debotz.vercel.app), pasa directo a la página principal sin alterar la URL
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Ejecuta el middleware en todas las rutas excepto archivos estáticos del sistema
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}