import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * 允许预览/远程环境访问 dev 资源（例如 /_next/webpack-hmr）。
   * 否则会出现“页面能渲染但点击不生效”的情况（React 未能正确挂载事件）。
   *
   * 注意：这里只用于开发环境预览；上线前可按需收敛。
   */
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    // 预览网关域名（来自 dev server 日志的 blocked origin 提示）
    "run-agent-6a114697bfcfe0eba87dd73d-mphyiu7s-preview.agent-sandbox-my-b1-gw.trae.ai",
    "run-agent-6a114697bfcfe0eba87dd73d-mphyiu7s.remote-agent.svc.cluster.local",
  ],
};

export default nextConfig;
