# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────
# 多阶段构建:Node.js 应用镜像优化 demo
#
# 设计目标(对应 package.json description):
#   ① 体积小      ── alpine 基础镜像;runner 阶段不装构建工具
#   ② 构建快      ── 依赖层独立缓存,源码改动不重装 npm
#   ③ 分层缓存友好 ── COPY 顺序由低频→高频:lockfile → package.json → 源码
#   ④ 安全        ── 非 root 运行;NODE_ENV=production 关闭 dev 依赖
# ─────────────────────────────────────────────────────────────

# ============ 阶段 1: deps(装依赖) ============
FROM node:20-alpine AS deps
WORKDIR /assets-system

# 关键技巧:先只拷 lockfile,利用 Docker 层缓存
# 平时改 app.js 时,这一层命中缓存,跳过 npm ci
COPY package.json package-lock.json ./
# --omit=dev 不装 devDependencies;production 环境不需要测试/lint 工具
RUN npm ci --omit=dev

# ============ 阶段 2: runner(运行时) ============
FROM node:20-alpine AS runner
WORKDIR /assets-system

# dumb-init 正确转发 SIGTERM/SIGINT,k8s 滚动更新时不会卡 30s
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
ENV PORT=3000

# node:20-alpine 自带一个 uid=1000 的 node 用户,直接用
COPY --chown=node:node --from=deps /assets-system/node_modules ./node_modules
COPY --chown=node:node app.js ./
COPY --chown=node:node package.json ./

USER node

EXPOSE 3000

# dumb-init PID 1 → node → app.js,信号链完整
CMD ["dumb-init", "node", "app.js"]