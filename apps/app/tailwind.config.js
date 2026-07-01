/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{ts,tsx,native.tsx}", "./index.{ts,tsx}", "./components/**/*.{ts,tsx}", "./screens/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}", "./hooks/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        cta: "#F9192D",
        link: "#1E4B95",
        brand: "#0F8B8D",
        heading: "#0F0F2C",
        text: "#101720",
        subtle: "#9CB0C1",
        accent: "#ECF1F6",
        canvas: "#F4EFED",
        success: "#EFBF3A",
        white: "#FFFFFF",
        dangerSoft: "#FFE6EA",
        successSoft: "#FFF3CE",
      },
    },
  },
  plugins: [],
};
