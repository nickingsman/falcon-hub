import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Falcon Hub",
    short_name: "Falcon Hub",
    description: "Falcon Hub internal operating workspace",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F7F2E8",
    theme_color: "#111214",
    icons: [
      {
        src: "/icons/falcon-hub-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/falcon-hub-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
