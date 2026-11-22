import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is intentionally off: every page in this prototype reads
  // live data (reports, sessions), so the classic dynamic rendering model is simpler.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
