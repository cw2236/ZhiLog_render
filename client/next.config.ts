import remarkGfm from 'remark-gfm'
import createMDX from '@next/mdx'

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Configure `pageExtensions` to include markdown and MDX files
    pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
    // Add image remote patterns configuration
    images: {
        remotePatterns: [
            {
                protocol: 'https' as const,
                hostname: 'assets.khoj.dev',
                port: '',
                pathname: '/**',
            },
            {
                protocol: 'https' as const,
                hostname: 'openpaper.ai',
                port: '',
                pathname: '/**',
            },
            {
                protocol: 'https' as const,
                hostname: '*.onrender.com',
                port: '',
                pathname: '/**',
            }
        ],
    },
    async rewrites() {
        // 根据环境变量动态配置API URL
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const celeryApiUrl = process.env.NEXT_PUBLIC_CELERY_API_URL || 'http://localhost:8001';
        
        return [
            {
                source: '/static/pdf/:path*',
                destination: `${apiUrl}/static/pdf/:path*`
            },
            {
                source: '/api/:path*',
                destination: `${apiUrl}/api/:path*`
            },
            {
                source: '/celery/:path*',
                destination: `${celeryApiUrl}/:path*`
            }
        ];
    },
    // 移除有问题的output属性
    experimental: {
        // 移除有问题的配置
    },
}

const withMDX = createMDX({
    // Add markdown plugins here, as desired
    options: {
        remarkPlugins: [remarkGfm],
    }
})

// Merge MDX config with Next.js config
export default withMDX(nextConfig)
