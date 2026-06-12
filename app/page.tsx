import Image from "next/image";

export const dynamic = "force-dynamic"

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <main className="text-center">
        <h1 className="text-3xl font-semibold text-black">
          Debotz
        </h1>
        <p className="mt-4 text-zinc-600">Bienvenido</p>
      </main>
    </div>
  );
}
