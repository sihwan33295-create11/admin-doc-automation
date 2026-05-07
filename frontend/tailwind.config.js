/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cb: {
          blue:              '#0052ff',
          'blue-active':     '#003ecc',
          'blue-disabled':   '#a8b8cc',
          canvas:            '#ffffff',
          'surface-soft':    '#f7f7f7',
          'surface-strong':  '#eef0f3',
          'surface-dark':    '#0a0b0d',
          'surface-dark-el': '#16181c',
          hairline:          '#dee1e6',
          ink:               '#0a0b0d',
          body:              '#5b616e',
          muted:             '#7c828a',
          'muted-soft':      '#a8acb3',
          'on-dark':         '#ffffff',
          'on-dark-soft':    '#a8acb3',
        },
      },
      borderRadius: {
        pill: '100px',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
