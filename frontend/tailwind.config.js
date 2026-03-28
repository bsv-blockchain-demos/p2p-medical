/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'pulse-violet': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 15px rgba(139, 92, 246, 0.2)' },
          '50%': { boxShadow: '0 0 30px rgba(139, 92, 246, 0.4)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0) translateX(0)' },
          '33%': { transform: 'translateY(-8px) translateX(4px)' },
          '66%': { transform: 'translateY(4px) translateX(-4px)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0) translateX(0)' },
          '50%': { transform: 'translateY(-12px) translateX(6px)' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(24px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'shimmer-sweep': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'breathing': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(139, 92, 246, 0)' },
          '50%': { boxShadow: '0 0 20px 2px rgba(139, 92, 246, 0.15)' },
        },
        'progress-fill': {
          from: { width: '0%' },
          to: { width: '100%' },
        },
      },
      animation: {
        'pulse-violet': 'pulse-violet 2s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'float': 'float 12s ease-in-out infinite',
        'float-slow': 'float-slow 15s ease-in-out infinite',
        'fade-in-up': 'fade-in-up 0.5s ease-out',
        'slide-in-right': 'slide-in-right 0.4s ease-out',
        'scale-in': 'scale-in 0.3s ease-out',
        'shimmer': 'shimmer-sweep 2.5s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 8s ease infinite',
        'breathing': 'breathing 3s ease-in-out infinite',
      },
      boxShadow: {
        'violet-sm': '0 0 10px rgba(139, 92, 246, 0.1)',
        'violet-md': '0 0 20px rgba(139, 92, 246, 0.15)',
        'violet-lg': '0 0 40px rgba(139, 92, 246, 0.2)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
