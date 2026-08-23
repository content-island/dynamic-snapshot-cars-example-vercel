FROM node:24-alpine AS builder
WORKDIR /app


COPY package*.json ./
RUN npm ci


COPY . .
RUN npm run build




FROM node:24-alpine AS runtime
WORKDIR /app


ENV NODE_ENV=production
ENV PORT=8080


COPY --from=builder /app/.output ./.output


EXPOSE 8080
CMD ["node", ".output/server/index.mjs"]
