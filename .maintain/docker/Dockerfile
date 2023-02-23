FROM node:16.19.1-buster-slim@sha256:815309603d8729c22fdea62b0bd641ec929c782919817ec2bf9274c68515c4b2 AS dependencies
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 100000

FROM node:16.19.1-buster-slim@sha256:815309603d8729c22fdea62b0bd641ec929c782919817ec2bf9274c68515c4b2 AS builder
WORKDIR /app
COPY . .
COPY --from=dependencies /app/node_modules ./node_modules
RUN yarn build \
  && yarn install --production --prefer-offline --network-timeout 100000

FROM node:16.19.1-buster-slim@sha256:815309603d8729c22fdea62b0bd641ec929c782919817ec2bf9274c68515c4b2 AS runner
LABEL social.myriad.image.authors="dev@myriad.social"
RUN useradd -m -u 1001 -U -s /bin/sh -d /home/myriad myriad
WORKDIR /app
COPY --from=builder /app/public ./public
COPY --from=builder /app/seed-data ./seed-data
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
USER myriad
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
EXPOSE ${PORT}
ENTRYPOINT ["node", "dist/index.js"]
