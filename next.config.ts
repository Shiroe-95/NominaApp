import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: 1024 * 1024 * 1024,
  },
};

export default withNextIntl(nextConfig);
