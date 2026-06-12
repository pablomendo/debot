// app/[subdomain]/admin/page.tsx
export default function MerchantAdminPage({ params }: { params: { subdomain: string } }) {
  return (
    <div className="p-8 font-sans">
      <h1 className="text-2xl font-bold text-blue-600">Panel de Control Interno</h1>
      <p className="mt-2 text-zinc-600">
        Bienvenido al administrador del local comercial: <strong className="text-black uppercase">{params.subdomain}</strong>
      </p>
      <div className="mt-4 p-4 bg-zinc-100 rounded-lg border border-zinc-200">
        Acá el ayudante de cocina va a ver las comandas en tiempo real y manejar el stock.
      </div>
    </div>
  )
}