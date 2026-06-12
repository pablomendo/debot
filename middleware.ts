import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const hostname = request.headers.get('host') || ''

  // 1. Si es la raíz pura de Vercel o localhost, pasa directo sin tocar nada
  if (
    hostname === 'debotz.vercel.app' || 
    hostname === 'localhost:3000' ||
    hostname.startsWith('debot-git-main') // Ignora dominios de preview de Vercel
  ) {
    return NextResponse.next()
  }

  // 2. Filtro estricto: Ignorar archivos del sistema, assets y APIs
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/api') ||
    url.pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // 3. Extraer el subdominio de forma segura
  let subdomain = ''
  if (hostname.includes('debotz.vercel.app')) {
    subdomain = hostname.replace('.debotz.vercel.app', '')
  } else {
    const parts = hostname.split('.')
    if (parts.length > 1) subdomain = parts[0]
  }

  // 4. Si hay un subdominio válido, reescribimos la ruta hacia la carpeta interna
  if (subdomain && subdomain !== 'www') {
    url.pathname = `/[subdomain]${url.pathname}`
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}