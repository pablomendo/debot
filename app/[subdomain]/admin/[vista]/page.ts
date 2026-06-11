import { supabaseAdmin } from "@/lib/supabase"
import { notFound } from "next/navigation"

interface PageProps {
  params: Promise<{
    subdomain: string
    vista: string
  }>
}

export default async function MenuPage({ params }: PageProps) {
  const resolvedParams = await params
  const subdomain = resolvedParams?.subdomain || ""
  const vista = resolvedParams?.vista || ""

  // 1. Validamos la URL de la vista
  if (vista !== "menu" && vista !== "catalogo") {
    notFound()
  }

  // Guardrail para evitar que Vercel falle pre-renderizando el archivo dinámico sin datos
  if (!subdomain || subdomain === "[subdomain]") {
    notFound()
  }

  // 2. Traemos los datos del local desde Supabase
  const { data: local, error: localError } = await supabaseAdmin
    .from("locales")
    .select("id, nombre_comercial, color_primario, color_acento, rubro_id")
    .eq("subdominio", subdomain)
    .maybeSingle()

  if (localError || !local) {
    notFound()
  }

  // 3. Traemos las categorías de este local
  const { data: categorias } = await supabaseAdmin
    .from("categorias")
    .select("id, nombre")
    .eq("local_id", local.id)
    .order("id", { ascending: true })

  // 4. Traemos todos los productos disponibles de este local
  const { data: productos } = await supabaseAdmin
    .from("productos")
    .select("id, categoria_id, nombre, descripcion, precio, disponible")
    .eq("local_id", local.id)
    .eq("disponible", true)
    .order("nombre", { ascending: true })

  const bgPrimario = local.color_primario || "#030B1E"
  const acentoNeon = local.color_acento || "#00D2FF"

  return (
    <div 
      style={{ backgroundColor: bgPrimario }} 
      className="min-h-screen text-white font-sans selection:bg-cyan-500 selection:text-black"
    >
      {/* HEADER */}
      <header 
        style={{ backgroundColor: `${bgPrimario}CD` }}
        className="sticky top-0 z-50 backdrop-blur-md bg-opacity-80 border-b border-white/10 p-4" 
      >
        <div className="max-w-md mx-auto flex flex-col items-center justify-center">
          <h1 className="text-2xl font-black tracking-widest uppercase" style={{ color: acentoNeon }}>
            {local.nombre_comercial}
          </h1>
          <p className="text-[10px] tracking-widest text-zinc-400 uppercase mt-0.5">Experience & Delivery</p>
          
          {/* BARRA DE CATEGORÍAS */}
          <nav className="w-full flex gap-3 overflow-x-auto no-scrollbar mt-4 pb-1 scroll-smooth">
            {categorias?.map((cat) => (
              <a
                key={cat.id}
                href={`#cat-${cat.id}`}
                className="whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold border border-white/10 bg-white/5 active:scale-95 transition-all hover:border-cyan-400"
              >
                {cat.nombre}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {/* CONTENIDO */}
      <main className="max-w-md mx-auto px-4 pt-4 pb-24">
        {categorias?.map((cat) => {
          const productosDeCategoria = productos?.filter(p => p.categoria_id === cat.id) || []
          if (productosDeCategoria.length === 0) return null

          return (
            <section key={cat.id} id={`cat-${cat.id}`} className="scroll-mt-32 mb-10">
              <h2 className="text-xl font-black tracking-wide mb-4 flex items-center gap-2 border-l-4 pl-3" style={{ borderLeftColor: acentoNeon }}>
                {cat.nombre}
              </h2>

              <div className="grid gap-4">
                {productosDeCategoria.map((prod) => (
                  <div 
                    key={prod.id} 
                    className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex gap-3 justify-between items-center hover:border-white/10 transition-colors"
                  >
                    <div className="flex-1 pr-2">
                      <h3 className="font-bold text-base tracking-wide text-zinc-100">{prod.nombre}</h3>
                      {prod.descripcion && (
                        <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">{prod.descripcion}</p>
                      )}
                      <span className="text-lg font-extrabold block mt-3" style={{ color: acentoNeon }}>
                        ${padding_precio(prod.precio)}
                      </span>
                    </div>

                    <button 
                      style={{ backgroundColor: acentoNeon }}
                      className="text-zinc-950 font-black px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/5 active:scale-95 transition-transform flex-shrink-0"
                    >
                      Agregar
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </main>

      {/* MINI FOOTER */}
      <div className="fixed bottom-4 left-0 right-0 px-4 z-50">
        <div className="max-w-md mx-auto bg-zinc-900/90 border border-white/10 backdrop-blur-lg p-3 rounded-2xl flex justify-between items-center shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm text-zinc-950" style={{ backgroundColor: acentoNeon }}>
              0
            </div>
            <span className="text-xs font-bold text-zinc-300">No hay productos seleccionados</span>
          </div>
          <button className="text-xs font-black uppercase tracking-wider opacity-50 cursor-not-allowed">
            Ver Pedido
          </button>
        </div>
      </div>
    </div>
  )
}

// Tipamos correctamente el parámetro para evitar que las reglas estrictas de Vercel fuercen el error de compilación
function padding_precio(precio: string | number | null | undefined): string {
  if (precio === null || precio === undefined) return "0"
  const num = Number(precio)
  return isNaN(num) ? "0" : num.toLocaleString('es-AR')
}