/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14110e",
        panel: "#1d1914",
        rule: "#3a3228",
        parchment: "#e8dcc4",
        muted: "#a89880",
        ember: "#c45c26",
        moss: "#7d9a6a",
        blood: "#b33a3a",
      },
    },
  },
  plugins: [],
};
