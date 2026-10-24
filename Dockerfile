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
# Cleanup must happen in the SAME step as the install: files deleted in a later
# step still exist in this layer and still count toward the image size.
# - npm's download cache is not needed at runtime
# - onnxruntime-node ships GPU (CUDA/TensorRT, ~270 MB) and macOS/Windows binaries; we run on Linux CPU
# - onnxruntime-web is the browser runtime (~140 MB); Node uses onnxruntime-node
RUN npm ci --omit=dev \
 && npm cache clean --force \
 && rm -rf node_modules/onnxruntime-web \
 && rm -rf node_modules/onnxruntime-node/bin/napi-v*/darwin node_modules/onnxruntime-node/bin/napi-v*/win32 \
 && rm -f node_modules/onnxruntime-node/bin/napi-v*/linux/*/libonnxruntime_providers_cuda.so \
          node_modules/onnxruntime-node/bin/napi-v*/linux/*/libonnxruntime_providers_tensorrt.so

# Download the embedding model into the image, so the server never downloads at runtime.
# Only embeddings.js is copied first: Docker reuses this layer (no re-download)
# unless embeddings.js itself changes.
COPY --from=build /app/dist/embeddings.js ./dist/embeddings.js
RUN node -e "import('./dist/embeddings.js').then((m) => m.embedQuery('warm up'))"

COPY --from=build /app/dist ./dist
# Skill files are baked in: after editing them, rebuild the image.
COPY knowledge/ ./knowledge/

# Run as the non-root "node" user (uid 1000, same as the host user, so files in data/ stay editable).
RUN mkdir -p data && chown node:node data
USER node

ENV HOST=0.0.0.0
EXPOSE 8081
CMD ["node", "dist/mcp.js"]
