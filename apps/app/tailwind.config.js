/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        canvas: "#f7f6f2",
        ink: "#111827",
        accent: "#0f766e",
        accentSoft: "#dff7f3",
      },
    },
  },
  plugins: [],
};
