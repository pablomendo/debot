export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#030712] text-[#F5F7FA] overflow-x-hidden">
      <link
        href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap"
        rel="stylesheet"
      />

      <style>{`
        @keyframes debotFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes debotPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .35; }
        }
        @keyframes debotPing {
          0% { transform: scale(1); opacity: .55; }
          100% { transform: scale(2.6); opacity: 0; }
        }
        .debot-display { font-family: 'Space Grotesk', sans-serif; }
        .debot-mono { font-family: 'JetBrains Mono', monospace; }
        .debot-fade { opacity: 0; animation: debotFadeUp .7s cubic-bezier(.16,1,.3,1) forwards; }
      `}</style>

      {/* ── NAV ── */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#030712]/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#00D2FF]/10 border border-[#00D2FF]/30 flex items-center justify-center">
              <span className="debot-display text-[#00D2FF] font-black text-sm">D</span>
            </div>
            <span className="debot-display font-extrabold tracking-tight text-lg">debot</span>
          </div>
          <a
            href="https://wa.me/5491178984773?text=Hola!%20Quiero%20saber%20m%C3%A1s%20sobre%20Debot"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#00D2FF] text-[#030712] hover:bg-[#3DDBFF] transition-colors"
          >
            Pedí tu demo
          </a>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 lg:pt-24 lg:pb-28 grid lg:grid-cols-2 gap-14 items-center">
        <div>
          <div
            className="debot-fade inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-[11px] font-semibold uppercase tracking-widest text-[#8B93A7] mb-6"
            style={{ animationDelay: '0s' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#00D2FF]" />
            Para negocios en Argentina
          </div>

          <h1
            className="debot-fade debot-display text-4xl sm:text-5xl lg:text-[3.4rem] font-extrabold leading-[1.05] tracking-tight"
            style={{ animationDelay: '.08s' }}
          >
            Mientras dormís,
            <br />
            tu WhatsApp <span className="text-[#00D2FF]">vende.</span>
          </h1>

          <p
            className="debot-fade text-base sm:text-lg text-[#A6ADC2] mt-6 max-w-md leading-relaxed"
            style={{ animationDelay: '.16s' }}
          >
            Debot arma el pedido, agenda el turno o reserva la cancha — todo en el
            mismo chat que tus clientes ya usan, sin que nadie tenga que atender el teléfono.
          </p>

          <div className="debot-fade flex flex-wrap items-center gap-3 mt-9" style={{ animationDelay: '.24s' }}>
            <a
              href="https://wa.me/5491178984773?text=Hola!%20Quiero%20mi%20bot%20de%20Debot"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3.5 rounded-2xl font-bold text-sm uppercase tracking-wider bg-[#00D2FF] text-[#030712] hover:bg-[#3DDBFF] transition-all active:scale-[0.97]"
            >
              Quiero mi bot
            </a>
            <a
              href="#como-funciona"
              className="px-6 py-3.5 rounded-2xl font-bold text-sm uppercase tracking-wider border border-white/15 text-[#F5F7FA] hover:bg-white/5 transition-all active:scale-[0.97]"
            >
              Ver cómo funciona
            </a>
          </div>
        </div>

        {/* ── Mock de chat ── */}
        <div className="debot-fade" style={{ animationDelay: '.3s' }}>
          <div className="relative mx-auto w-full max-w-sm rounded-[2rem] border border-white/10 bg-[#0A1330] shadow-2xl overflow-hidden">
            {/* Header del chat */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5 bg-white/[0.02]">
              <div className="w-9 h-9 rounded-full bg-[#00D2FF]/15 border border-[#00D2FF]/30 flex items-center justify-center">
                <span className="debot-display text-[#00D2FF] font-bold text-xs">SY</span>
              </div>
              <div>
                <p className="text-sm font-bold leading-tight">Sushi Yama</p>
                <p className="text-[11px] text-[#6FCF97] flex items-center gap-1.5 leading-tight mt-0.5">
                  <span className="relative w-1.5 h-1.5">
                    <span className="absolute inset-0 rounded-full bg-[#6FCF97]" style={{ animation: 'debotPing 1.8s ease-out infinite' }} />
                    <span className="absolute inset-0 rounded-full bg-[#6FCF97]" />
                  </span>
                  en línea · responde Debot
                </p>
              </div>
            </div>

            {/* Burbujas */}
            <div className="px-4 py-5 flex flex-col gap-3 min-h-[320px] justify-end">
              <div className="debot-fade self-end max-w-[78%]" style={{ animationDelay: '.55s' }}>
                <div className="bg-white/[0.06] border border-white/10 rounded-2xl rounded-br-sm px-3.5 py-2.5 text-sm">
                  Hola! Tienen roll de salmón? 🍣
                </div>
              </div>

              <div className="debot-fade self-start max-w-[78%]" style={{ animationDelay: '.85s' }}>
                <div className="bg-[#00D2FF]/10 border border-[#00D2FF]/25 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm">
                  ¡Sí! Salmón Roll <span className="debot-mono">$4.500</span>. ¿Te lo agrego al pedido?
                </div>
              </div>

              <div className="debot-fade self-end max-w-[78%]" style={{ animationDelay: '1.15s' }}>
                <div className="bg-white/[0.06] border border-white/10 rounded-2xl rounded-br-sm px-3.5 py-2.5 text-sm">
                  Dale, y dos gyozas también
                </div>
              </div>

              <div className="debot-fade self-start max-w-[85%]" style={{ animationDelay: '1.45s' }}>
                <div className="bg-[#00D2FF]/10 border border-[#00D2FF]/25 rounded-2xl rounded-bl-sm px-3.5 py-3 text-sm">
                  <p className="mb-1.5">Pedido confirmado ✅</p>
                  <p className="debot-mono text-[12px] text-[#A6ADC2] leading-relaxed">
                    Salmón Roll x1
                    <br />
                    Gyozas x2
                    <br />
                    <span className="text-[#F5F7FA] font-semibold">Total: $7.200</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PARA QUIÉN ES ── */}
      <section className="max-w-6xl mx-auto px-6 py-16 lg:py-20 border-t border-white/5">
        <p className="debot-mono text-xs uppercase tracking-[0.2em] text-[#00D2FF] mb-3">Para quién es</p>
        <h2 className="debot-display text-2xl sm:text-3xl font-bold tracking-tight max-w-lg mb-12">
          Si tu negocio vive en el chat de WhatsApp, Debot fue hecho para vos.
        </h2>

        <div className="grid sm:grid-cols-3 gap-5">
          {[
            {
              titulo: 'Gastronomía',
              detalle: 'Restós, bares, heladerías, sushi.',
              texto: 'El bot conoce tu menú, el stock del día y arma el pedido completo.',
            },
            {
              titulo: 'Peluquerías y estética',
              detalle: 'Peluquerías, barberías, centros de estética.',
              texto: 'Reserva turnos sola, sin que nadie tenga que atender el teléfono.',
            },
            {
              titulo: 'Clubes y canchas',
              detalle: 'Fútbol 5, pádel, gimnasios.',
              texto: 'Tu cliente reserva la cancha y paga, todo dentro del chat.',
            },
          ].map((item) => (
            <div
              key={item.titulo}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-colors"
            >
              <h3 className="debot-display font-bold text-lg mb-1.5">{item.titulo}</h3>
              <p className="text-xs text-[#6B7390] mb-3">{item.detalle}</p>
              <p className="text-sm text-[#A6ADC2] leading-relaxed">{item.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ── */}
      <section id="como-funciona" className="max-w-6xl mx-auto px-6 py-16 lg:py-20 border-t border-white/5">
        <p className="debot-mono text-xs uppercase tracking-[0.2em] text-[#00D2FF] mb-3">Cómo funciona</p>
        <h2 className="debot-display text-2xl sm:text-3xl font-bold tracking-tight max-w-lg mb-12">
          De cero a vendiendo por WhatsApp, en tres pasos.
        </h2>

        <div className="grid sm:grid-cols-3 gap-5">
          {[
            {
              n: '01',
              titulo: 'Cargamos tu menú o tus servicios',
              texto: 'Productos, precios, fotos y promociones, todo dentro de Debot.',
            },
            {
              n: '02',
              titulo: 'Conectamos tu WhatsApp',
              texto: 'El mismo número que ya usás hoy, ahora con un bot atrás.',
            },
            {
              n: '03',
              titulo: 'Tu bot empieza a vender',
              texto: 'Responde, cobra y avisa. Vos solo mirás el panel.',
            },
          ].map((item) => (
            <div
              key={item.n}
              className="relative rounded-2xl border border-dashed border-white/15 bg-white/[0.015] p-6"
            >
              <span className="debot-mono text-[11px] text-[#6B7390]">{item.n}</span>
              <h3 className="debot-display font-bold text-base mt-2 mb-2">{item.titulo}</h3>
              <p className="text-sm text-[#A6ADC2] leading-relaxed">{item.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="max-w-6xl mx-auto px-6 py-16 lg:py-20 border-t border-white/5">
        <div className="rounded-3xl border border-[#00D2FF]/20 bg-gradient-to-br from-[#00D2FF]/[0.07] to-transparent p-10 lg:p-14 text-center">
          <h2 className="debot-display text-2xl sm:text-3xl font-bold tracking-tight mb-3">
            Armemos tu bot esta semana.
          </h2>
          <p className="text-[#A6ADC2] max-w-md mx-auto mb-8">
            Contanos qué tipo de negocio tenés y te mostramos cómo se vería tu chat funcionando.
          </p>
          <a
            href="https://wa.me/5491178984773?text=Hola!%20Quiero%20mi%20bot%20de%20Debot"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-7 py-3.5 rounded-2xl font-bold text-sm uppercase tracking-wider bg-[#00D2FF] text-[#030712] hover:bg-[#3DDBFF] transition-all active:scale-[0.97]"
          >
            Hablar por WhatsApp
          </a>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="max-w-6xl mx-auto px-6 py-10 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#00D2FF]/10 border border-[#00D2FF]/30 flex items-center justify-center">
            <span className="debot-display text-[#00D2FF] font-black text-[10px]">D</span>
          </div>
          <span className="debot-display font-bold text-sm">debot</span>
        </div>
        <p className="text-xs text-[#6B7390]">Hecho en Argentina, para negocios argentinos.</p>
      </footer>
    </div>
  )
}