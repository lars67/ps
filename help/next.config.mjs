import dotenv from 'dotenv';
dotenv.config();
/** @type {import('next').NextConfig} */
const nextConfig = {
    basePath: process.env.BASE_PATH,
    output: 'export',
};

export default nextConfig;
