/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    /**
     * pdfkit must not be bundled.
     *
     * Since 0.17 it loads its font metrics through package subpath imports
     * (`#standard-fonts/Helvetica`, declared in its own package.json
     * `imports` map). Webpack rewrites the requires but does not carry that
     * map across, so the bundled copy dies at the first `doc.font(...)` with
     * `Cannot find module '#standard-fonts/Helvetica'`. Locally nothing is
     * bundled, so the whole thing works and the bug only appears once
     * deployed.
     *
     * Marking it external leaves the require alone: Node resolves it from
     * node_modules at runtime, where the imports map is intact.
     */
    serverComponentsExternalPackages: ["pdfkit"],

    /**
     * External still means "traced", not "shipped" — the tracer follows
     * static requires and pdfkit's font files are reached dynamically, so
     * name them explicitly or the function bundle arrives without them.
     *
     * On Next 14 this key lives under `experimental`; it only moved to the
     * top level in 15. Set at the top level here it is silently ignored, with
     * an "Invalid next.config.mjs options detected" warning the only clue.
     */
    outputFileTracingIncludes: {
      "/api/export/alert/[id]": ["./node_modules/pdfkit/js/**"],
    },
  },
};

export default nextConfig;
