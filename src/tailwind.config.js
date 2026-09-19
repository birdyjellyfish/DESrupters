/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#12221c",
        moss: "#486b5a",
        leaf: "#9bbf72",
        cream: "#f5f3ed",
        fog: "#e4e8e0",
        coral: "#db6f50",
        amber: "#e4a853",
      },
      fontFamily: {
        sans: ["Arial", "Helvetica", "sans-serif"],
        display: ["Georgia", "Times New Roman", "serif"],
      },
      boxShadow: {
        soft: "0 12px 35px rgba(32, 54, 42, 0.10)",
        card: "0 3px 0 rgba(18, 34, 28, 0.04), 0 14px 35px rgba(32, 54, 42, 0.07)",
      },
    },
  },
  plugins: [],
};
