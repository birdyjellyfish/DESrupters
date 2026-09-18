import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";

export const metadata = {
  title: "Wayfinder — Smart Commuter Companion",
  description: "A proactive, personalised commute companion for Singapore.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en-SG">
      <body>{children}</body>
    </html>
  );
}
