/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/**/*.{ts,tsx,js,jsx,html,ejs}',
    './src/**/*.{ts,tsx,js,jsx,html,ejs}',
  ],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [
    // tailwindcss-animate will be used when installed
    require('tailwindcss-animate'),
  ],
}
