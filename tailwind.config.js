/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.html', './src/**/*.js'],
  theme: {
    extend: {
      colors: {
        // PIVTEK Design Tokens
        pv: {
          bg:    '#0c0e14',   // page background
          s:     '#151820',   // surface
          s2:    '#1c1f2a',   // surface elevated
          ink:   '#f0f2f5',   // primary text
          ink2:  '#c9d1d9',   // secondary text
          mu:    '#8b949e',   // muted text
          mu2:   '#484f58',   // very muted
          pur:   '#7B6FD6',   // brand purple (primary)
          blu:   '#5B8DEF',   // brand blue (secondary)
          grn:   '#10b981',   // green accent
        },
      },
      fontFamily: {
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        serif: ['DM Serif Display', 'Georgia', 'serif'],
      },
      borderRadius: {
        pv: '14px',
      },
      borderColor: {
        DEFAULT: 'rgba(255,255,255,0.07)',
        strong:  'rgba(255,255,255,0.12)',
      },
      maxWidth: {
        content: '720px',
      },
      fontSize: {
        '2xs': ['10px', '1.4'],
        '3xs': ['9px',  '1.4'],
      },
      letterSpacing: {
        widest2: '0.2em',
        widest3: '0.3em',
      },
    },
  },
  plugins: [],
};
