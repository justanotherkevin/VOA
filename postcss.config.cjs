/* PostCSS config for Webpack - Tailwind v4 requires the separate PostCSS plugin */
module.exports = {
  plugins: {
    // Use the new PostCSS plugin package for Tailwind v4
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
};
