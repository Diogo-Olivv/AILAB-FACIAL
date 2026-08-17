/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#0F0F1A",
        surface: "#1A1A2E",
        accent: "#6C47FF",
      },
    },
  },
  plugins: [],
};
