import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export default function proxy(request: NextRequest) {
  const url = request.nextUrl.clone()
  const hostname = request.headers.get('host') || ''

  if (
    hostname.endsWith('vercel.app') ||
    hostname === 'localhost:3000'
  ) {
    return NextResponse.next()
  }

  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/api') ||
    url.pathname.includes('.')
  ) {
    return NextResponse.next()
  }

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