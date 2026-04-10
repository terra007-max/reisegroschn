import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Evodia",
    short_name: "Evodia",
    description: "Travel expense management for Austria — §26 EStG compliant",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#1e3a8a",
    categories: ["finance", "business", "productivity"],
    lang: "de",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Neue Reise",
        short_name: "Neue Reise",
        description: "Neue Dienstreise erfassen",
        url: "/trips/new",
        icons: [{ src: "/icons/icon-96.png", sizes: "96x96" }],
      },
    ],
    screenshots: [],
  };
}
