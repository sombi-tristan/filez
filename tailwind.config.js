/** @type {import('tailwindcss').Config} */
module.exports = {
  // Keyed off data-theme on <html>, the design system's switch (design/house.css), set by the
  // pre-paint script in app/layout.js and by the house ThemeControl.
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./screens/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // The house type (design/README.md): Source Sans 3 to read, Outfit for headings.
        sans: ['"Source Sans 3"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        display: ['Outfit', '"Source Sans 3"', 'system-ui', 'sans-serif'],
      },
      // A card's thin line around its fill (StationMGR's solid look; --edge in app/globals.css).
      borderWidth: {
        card: '1px',
      },
      // StationMGR's corner (--corner, overridden in app/globals.css).
      borderRadius: {
        house: '8px',
        // Buttons: half the corner (app/globals.css halves Ionic's buttons the same way).
        'house-btn': '4px',
      },
      colors: {
        // Semantic neutral tokens (light/dark via CSS vars in app/globals.css). Screens use
        // bg-surface / text-content / border-line instead of raw white and grays, so dark
        // mode is a variable swap rather than a per-class rewrite.
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        subtle: 'rgb(var(--subtle) / <alpha-value>)',
        line: {
          DEFAULT: 'rgb(var(--line-ch) / <alpha-value>)',
          strong: 'rgb(var(--line-strong) / <alpha-value>)',
        },
        content: {
          DEFAULT: 'rgb(var(--content) / <alpha-value>)',
          strong: 'rgb(var(--content-strong) / <alpha-value>)',
          muted: 'rgb(var(--content-muted) / <alpha-value>)',
          faint: 'rgb(var(--content-faint) / <alpha-value>)',
        },
        // The house blue accent (#0093DD at 500, data-accent="blue"), as a scale so existing
        // bg-primary-* classes take it. Channels live in app/globals.css.
        primary: {
          DEFAULT: 'rgb(var(--primary-500) / <alpha-value>)',
          50: 'rgb(var(--primary-50) / <alpha-value>)',
          100: 'rgb(var(--primary-100) / <alpha-value>)',
          200: 'rgb(var(--primary-200) / <alpha-value>)',
          300: 'rgb(var(--primary-300) / <alpha-value>)',
          400: 'rgb(var(--primary-400) / <alpha-value>)',
          500: 'rgb(var(--primary-500) / <alpha-value>)',
          600: 'rgb(var(--primary-600) / <alpha-value>)',
          700: 'rgb(var(--primary-700) / <alpha-value>)',
          800: 'rgb(var(--primary-800) / <alpha-value>)',
          900: 'rgb(var(--primary-900) / <alpha-value>)',
          950: 'rgb(var(--primary-950) / <alpha-value>)',
        },
        // Kept as a name so existing bg-accent-* classes still build, but the house allows one
        // accent per app, so app/globals.css points these at the same blue as primary.
        accent: {
          DEFAULT: 'rgb(var(--accent-500) / <alpha-value>)',
          50: 'rgb(var(--accent-50) / <alpha-value>)',
          100: 'rgb(var(--accent-100) / <alpha-value>)',
          200: 'rgb(var(--accent-200) / <alpha-value>)',
          300: 'rgb(var(--accent-300) / <alpha-value>)',
          400: 'rgb(var(--accent-400) / <alpha-value>)',
          500: 'rgb(var(--accent-500) / <alpha-value>)',
          600: 'rgb(var(--accent-600) / <alpha-value>)',
          700: 'rgb(var(--accent-700) / <alpha-value>)',
          800: 'rgb(var(--accent-800) / <alpha-value>)',
          900: 'rgb(var(--accent-900) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [
    // compact: everywhere but the Android app (html.android-app, app/layout.js), which keeps
    // the house sizes. The website's smaller boxes use it, as app/globals.css does.
    ({ addVariant }) => addVariant('compact', 'html:not(.android-app) &'),
  ],
};
