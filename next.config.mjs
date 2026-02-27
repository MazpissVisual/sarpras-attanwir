/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Untuk upload foto nota (default 1MB)
    },
  },
};

export default nextConfig;
