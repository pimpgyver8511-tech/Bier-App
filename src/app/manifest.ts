import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bier App",
    short_name: "Bier App",
    description:
      "Wer bringt den Kasten mit? Anwesenheit, Kasten-Historie und faire Zuteilung fürs Team.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f8f4",
    theme_color: "#0a3d24",
    lang: "de",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
