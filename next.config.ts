import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Resto de tus configuraciones si tenés (como images, etc) */
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;