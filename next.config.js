/** @type {import('next').NextConfig} */
const nextConfig = {
  // public/index.htmlをルートとして使えるようにする
  async rewrites() {
    return [
      {
        source: '/',
        destination: '/index.html',
      },
    ]
  },
}
module.exports = nextConfig
