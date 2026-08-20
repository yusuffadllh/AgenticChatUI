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
      // Jangan bundle package native/binding; require langsung dari node_modules
      // supaya resolusi path binding better_sqlite3.node tidak rusak saat runtime.
      const externals = Array.isArray(config.externals) ? config.externals : [config.externals];
      externals.unshift({
        "better-sqlite3": "commonjs better-sqlite3",
        bindings: "commonjs bindings",
      });
      config.externals = externals;
    }
    return config;
  },
};

export default nextConfig;
