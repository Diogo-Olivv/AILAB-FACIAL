/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#F6F8FD",
        card: "#FFFFFF",
        navy: "#0F172A",
        green: "#059669",
        ink: "#0F172A",
        muted: "#64748B",
        warn: "#DC2626",
        line: "rgba(0, 0, 0, 0.06)",
      },
    },
  },
  plugins: [],
};
