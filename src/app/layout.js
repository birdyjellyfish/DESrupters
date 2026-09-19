import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";

export const metadata = {
  title: "Wayfinder — Smart Commuter Companion",
  description: "A proactive, personalised commute companion for Singapore.",
  manifest: "/manifest.json",
  icons: { icon: { url: "/branding/wayfinder-bird-512.png", type: "image/png", sizes: "512x512" }, apple: "/branding/wayfinder-bird-512.png" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en-SG">
      <body>{children}</body>
    </html>
  );
}
