import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const hostname = request.headers.get('host') || ''

  // Ignorar todo lo que sea Vercel o localhost
  if (
    hostname.endsWith('vercel.app') ||
    hostname === 'localhost:3000'
  ) {
    return NextResponse.next()
  }

  // Ignorar assets y APIs
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/api') ||
    url.pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Extraer subdominio solo para dominios custom
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || ''
  const parts = hostname.split('.')
  
  if (parts.length > 2) {
    const subdomain = parts[0]
    if (subdomain && subdomain !== 'www') {
      url.pathname = `/${subdomain}${url.pathname}`
      return NextResponse.rewrite(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}