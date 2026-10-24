# Stage 1 "build": all packages (incl. TypeScript), compile src/ to dist/.
FROM node:26-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src/ ./src/
RUN npm run build

# Stage 2 "run": fresh image with only runtime packages + compiled code.
# The compiler and dev tools never reach the final image.
FROM node:26-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
# Skill files are baked in: after editing them, rebuild the image.
COPY knowledge/ ./knowledge/

# Run as the non-root "node" user (uid 1000, same as the host user, so files in data/ stay editable).
RUN mkdir -p data && chown node:node data
USER node

ENV HOST=0.0.0.0
EXPOSE 8081
CMD ["node", "dist/mcp.js"]
