import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0d1117',
          elev: '#161b22',
          muted: '#1c2128',
          inset: '#010409',
        },
        fg: {
          DEFAULT: '#e6edf3',
          muted: '#7d8590',
          subtle: '#484f58',
        },
        line: {
          DEFAULT: '#30363d',
          strong: '#484f58',
        },
        accent: {
          DEFAULT: '#f0b429',
          hover: '#f7c948',
          muted: '#8a6d1c',
        },
        ok: {
          DEFAULT: '#3fb950',
          muted: '#1f6f2c',
        },
        err: {
          DEFAULT: '#da6f6f',
          muted: '#6e2525',
        },
      },
      fontFamily: {
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        sans: ['var(--font-dm-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      transitionDuration: {
        fast: '150ms',
      },
    },
  },
  plugins: [],
};

export default config;
