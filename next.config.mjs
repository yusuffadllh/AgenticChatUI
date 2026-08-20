/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "better-sqlite3",
      "@prisma/adapter-better-sqlite3",
      "@prisma/client",
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Jangan bundle native module; biarkan di-require langsung dari node_modules
      // supaya path binding better_sqlite3.node tidak rusak.
      config.externals.push({
        "better-sqlite3": "commonjs better-sqlite3",
      });
    }
    return config;
  },
};

export default nextConfig;
