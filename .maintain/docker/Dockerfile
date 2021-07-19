# Check out https://hub.docker.com/_/node to select a new base image
FROM node:14-buster-slim

ARG VCS_REF
ARG BUILD_DATE

LABEL social.myriad.image.title="myriadsocial/myriad-api" \
  social.myriad.image.description="myriad-api" \
  social.myriad.image.authors="myriad.dev@blocksphere.id" \
  social.myriad.image.vendor="Blocksphere" \
  social.myriad.image.revision="${VCS_REF}" \
  social.myriad.image.created="${BUILD_DATE}" \
  social.myriad.image.source="https://github.com/myriadsocial/myriad-api/blob/${VCS_REF}/.maintain/docker/Dockerfile" \
  social.myriad.image.documentation="https://github.com/myriadsocial/myriad-api/tree/${VCS_REF}"

# Change default user name
RUN usermod -d /home/myriad -l myriad node && \
  groupmod -n myriad node && \
  mkdir -p /home/myriad && \
  chown -R myriad:myriad /home/myriad

# Set to a non-root built-in user `myriad`
USER myriad

# Create app directory (with user `myriad`)
RUN mkdir -p /home/myriad/app

WORKDIR /home/myriad/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY --chown=myriad package*.json ./

RUN yarn install

# Bundle app source code
COPY --chown=myriad . .

RUN yarn run build

ENV NODE_ENV=production
# Bind to all network interfaces so that it can be mapped to the host OS
ENV HOST=0.0.0.0 PORT=3000

EXPOSE ${PORT}
CMD [ "node", "." ]
