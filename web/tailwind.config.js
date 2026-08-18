/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#F4EFE4",
        card: "#FBF8F1",
        navy: "#1E2D5F",
        green: "#166534",
        ink: "#141A33",
        muted: "#6B6F82",
        warn: "#DC2626",
        line: "rgba(30,45,95,0.14)",
      },
    },
  },
  plugins: [],
};
