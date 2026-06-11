import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const url = request.nextUrl.clone()

  // Dominio raíz en desarrollo y producción
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000'

  // Extraer el subdominio
  const subdomain = hostname
    .replace(`.${rootDomain}`, '')
    .replace(rootDomain, '')

  // Si no hay subdominio o es www → landing page principal
  if (!subdomain || subdomain === hostname || subdomain === 'www') {
    return NextResponse.next()
  }

  // Si es el subdominio "admin" → panel super admin de Debot (vos)
  if (subdomain === 'admin') {
    url.pathname = `/admin${url.pathname}`
    return NextResponse.rewrite(url)
  }

  // Cualquier otro subdominio → panel del local
  url.pathname = `/${subdomain}${url.pathname}`
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}