/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
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
          strong: 'hsl(var(--destructive-strong))',
          foreground: 'hsl(var(--destructive-foreground))',
          text: 'hsl(var(--error-text))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
          text: 'hsl(var(--success-text))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
          text: 'hsl(var(--warning-text))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
        cyan: {
          400: 'hsl(var(--cyan-400))',
          500: 'hsl(var(--cyan-500))',
          600: 'hsl(var(--cyan-600))',
        },
        // DMND auth design-system tokens (flip light/dark via .dmnd-auth vars).
        canvas: 'hsl(var(--canvas))',
        heading: 'hsl(var(--heading))',
        'heading-alt': 'hsl(var(--heading-alt))',
        'btn-secondary': 'hsl(var(--btn-secondary))',
        grid: 'hsl(var(--grid))',
        tooltip: 'hsl(var(--tooltip))',
        'on-solid': 'hsl(var(--on-solid))',
        'on-solid-alt': 'hsl(var(--on-solid-alt))',
        'body-alt': 'hsl(var(--body-alt))',
        placeholder: 'hsl(var(--placeholder))',
        'secondary-label': 'hsl(var(--secondary-label))',
        btn: {
          DEFAULT: 'hsl(var(--btn))',
          foreground: 'hsl(var(--btn-foreground))',
          disabled: 'hsl(var(--btn-disabled))',
        },
        link: 'hsl(var(--link))',
        toast: {
          success: 'hsl(var(--toast-success))',
          error: 'hsl(var(--toast-error))',
          warning: 'hsl(var(--toast-warning))',
          info: 'hsl(var(--toast-info))',
          neutral: 'hsl(var(--toast-neutral))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 8px)',
        pill: '9999px',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        /* The design sets several card titles in the body face even though they are
           semantic headings, which the .dmnd-app heading rule would otherwise override. */
        body: ['Geist Variable', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        /* Big numeric readouts are set in the heading face even though they are not
           heading elements, so they need an explicit utility. */
        heading: ['Radio Canada Big Variable', 'Geist Variable', 'sans-serif'],
      },
      letterSpacing: {
        heading: '-0.025em',
        section: '0.1em',
      },
      transitionTimingFunction: {
        apple: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      boxShadow: {
        glass: '0 2px 8px -2px hsl(var(--glass-shadow) / 0.08), 0 4px 16px -4px hsl(var(--glass-shadow) / 0.04)',
        'glass-hover': '0 4px 12px -2px hsl(var(--glass-shadow) / 0.12), 0 8px 24px -4px hsl(var(--glass-shadow) / 0.06)',
        'glow-cyan': '0 0 20px hsl(190 100% 50% / 0.15), 0 0 40px hsl(190 100% 50% / 0.05)',
      },
    },
  },
  plugins: [],
};
