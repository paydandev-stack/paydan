FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
# Migration and worker commands use checked-in TypeScript scripts through tsx,
# so the runtime image intentionally retains the pinned development toolchain.
RUN npm ci --include=dev
COPY . .
RUN npm run build
EXPOSE 3000
# The reusable image applies required migrations and fails closed if they fail.
# Local-only sample/user seeding is supplied by docker-compose.yml.
CMD ["sh", "-c", "npm run db:migrate && npm start"]
