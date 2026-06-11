import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const url = request.nextUrl.clone()

  // Dominio raíz en desarrollo y producción
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000'

  // Extraer el subdominio limpiando de forma segura
  let subdomain = hostname
    .replace(`.${rootDomain}`, '')
    .replace(rootDomain, '')

  // REGLA DE ORO: Si entramos directo al dominio principal (sin subdominio real delante)
  if (!subdomain || hostname === rootDomain || subdomain === 'www') {
    // Si querés que al entrar a debotz.vercel.app cargue por defecto el menú de sushiblue de prueba:
    url.pathname = `/sushiblue/menu`
    return NextResponse.rewrite(url)
    
    // NOTA: Si en el futuro creás una landing page en app/page.tsx, cambiá las 2 líneas de arriba por:
    // return NextResponse.next()
  }

  // Si es el subdominio "admin" → panel super admin de Debot (vos)
  if (subdomain === 'admin') {
    url.pathname = `/admin${url.pathname}`
    return NextResponse.rewrite(url)
  }

  // Cualquier otro subdominio (ej: sushiblue) → panel del local
  url.pathname = `/${subdomain}${url.pathname}`
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}