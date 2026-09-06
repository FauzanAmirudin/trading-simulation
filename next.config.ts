import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  reactStrictMode: false,
  serverExternalPackages: ["pg", "bcryptjs", "exceljs", "archiver"],
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "@base-ui/react",
      "dayjs",
      "sonner",
    ],
  },
};

export default nextConfig;

