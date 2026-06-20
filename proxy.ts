import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Se agrega 'default' para cumplir con el requerimiento de Next.js 16
export default async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll().map(({ name, value }) => ({ name, value }))
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set({ name, value, ...options }))
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set({ name, value, ...options }))
        },
      },
    }
  )

  // --- LÓGICA MULTI-TENANT INTELIGENTE ---
  const url = request.nextUrl.clone()
  const hostname = request.headers.get('host') || ''

  // Obtenemos el dominio raíz desde el .env (localhost:3000 en desarrollo)
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000'

  // SI EL HOSTNAME ES EXACTAMENTE EL DOMINIO RAÍZ (O TIENE WWW)
  // No se altera nada, sigue su flujo normal (ej: app/page.tsx o app/admin/page.tsx)
  if (hostname === rootDomain || hostname === `www.${rootDomain}`) {
    return response
  }

  // SI TIENE UN SUBDOMINIO (Ej: sushiblue.localhost:3000 o sushiblue.debotz.vercel.app)
  // Extraemos la palabra limpia del subdominio
  let subdomain = hostname.replace(`.${rootDomain}`, '').replace(rootDomain, '')

  if (subdomain && subdomain !== 'www') {
    // Si el subdominio es 'admin', va al panel maestro de Pablo (app/admin)
    if (subdomain === 'admin') {
      url.pathname = `/admin${url.pathname}`
    } else {
      // Cualquier otro subdominio va a la carpeta interna del cliente (app/[subdomain]/...)
      url.pathname = `/${subdomain}${url.pathname}`
    }

    return NextResponse.rewrite(url, {
      request: {
        headers: request.headers,
      }
    })
  }
  // ---------------------------------------

  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}