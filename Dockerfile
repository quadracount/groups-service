FROM node:24-slim AS base
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
RUN corepack enable && corepack install

FROM base AS build
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM base AS prod-deps
RUN pnpm install --prod --frozen-lockfile

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# proto-loader lee los .proto en runtime
COPY protos ./protos
EXPOSE 50051
CMD ["node", "dist/main.js"]