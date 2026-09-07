import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  reactStrictMode: false,
  compress: true,
  poweredByHeader: false,
  serverExternalPackages: ["pg", "bcryptjs", "exceljs", "archiver"],
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@base-ui/react",
      "dayjs",
      "sonner",
      "framer-motion",
      "clsx",
      "tailwind-merge",
    ],
  },
};

export default nextConfig;

