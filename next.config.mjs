/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    /**
     * pdfkit reads its font metrics (.afm) from disk at render time, building
     * the path at runtime rather than `require`-ing the files. Next's
     * dependency tracer only follows static requires, so on a serverless
     * deploy those files are left out of the bundle and the first PDF export
     * dies on `ENOENT .../data/Helvetica.afm` — locally it works fine,
     * because the whole node_modules tree is sitting there.
     *
     * Naming them here puts them in the function bundle. Scoped to the one
     * route that draws a PDF, so nothing else carries the weight.
     *
     * On Next 14 this key lives under `experimental`; it only moved to the
     * top level in 15. Set at the top level here it is silently ignored —
     * the build prints "Invalid next.config.mjs options detected" and carries
     * on without the files.
     */
    outputFileTracingIncludes: {
      "/api/export/alert/[id]": ["./node_modules/pdfkit/js/data/**"],
    },
  },
};

export default nextConfig;
