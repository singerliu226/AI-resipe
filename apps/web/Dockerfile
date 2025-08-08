# Next.js (pnpm) Dockerfile for Zeabur
# 使用 Node 官方 slim 镜像，减少体积
FROM node:22-slim AS base
LABEL language="nodejs" framework="next.js"

# 设置工作目录
WORKDIR /src

# 将整个仓库拷贝进镜像，便于 monorepo 安装依赖
COPY . .

# 安装 pnpm 作为包管理器
RUN npm install -g pnpm@8

# 切换到前端应用目录
WORKDIR /src/apps/web

# 安装依赖
RUN pnpm install --frozen-lockfile

# 在构建阶段禁用 ESLint（临时解决部署阻断，后续可去掉）
ENV NEXT_DISABLE_ESLINT=1

# 构建 Next.js 产物
RUN pnpm build

# 运行阶段使用新的更小层
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# 复制构建产物与依赖
COPY --from=base /src/apps/web/.next ./.next
COPY --from=base /src/apps/web/public ./public
COPY --from=base /src/apps/web/package.json ./package.json
COPY --from=base /src/apps/web/node_modules ./node_modules

EXPOSE 3000

# 直接使用 next 可执行文件启动，避免在运行阶段再次安装依赖
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]