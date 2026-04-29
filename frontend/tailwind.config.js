/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        black: "#000000",
        surface: {
          0: "#000000",
          1: "#0a0a0a",
          2: "#111111",
          3: "#1a1a1a",
          4: "#222222",
          5: "#2a2a2a",
        },
        accent: {
          DEFAULT: "#7c3aed",
          light: "#a78bfa",
          glow: "rgba(124, 58, 237, 0.3)",
        },
        blue: {
          accent: "#3b82f6",
          glow: "rgba(59, 130, 246, 0.3)",
        },
        gray: {
          850: "#1a1a1a",
          900: "#111111",
          950: "#0a0a0a",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-right": "slideRight 0.3s ease-out",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        shimmer: "shimmer 1.5s infinite",
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: "translateY(10px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        slideRight: { from: { opacity: 0, transform: "translateX(-10px)" }, to: { opacity: 1, transform: "translateX(0)" } },
        pulseGlow: { "0%, 100%": { boxShadow: "0 0 0 0 rgba(124,58,237,0)" }, "50%": { boxShadow: "0 0 20px 4px rgba(124,58,237,0.3)" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
      },
      boxShadow: {
        accent: "0 0 20px rgba(124, 58, 237, 0.4)",
        "accent-sm": "0 0 10px rgba(124, 58, 237, 0.2)",
        glass: "0 8px 32px rgba(0, 0, 0, 0.8)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(ellipse at center, var(--tw-gradient-stops))",
        "shimmer-gradient": "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
      },
    },
  },
  plugins: [],
};
