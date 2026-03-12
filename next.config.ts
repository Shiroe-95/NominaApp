import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
};

export default withNextIntl(nextConfig);
