# Check out https://hub.docker.com/_/node to select a new base image
FROM node:15.14.0-buster-slim

LABEL social.myriad.api.image.authors="1@myriad.social" \
  social.myriad.api.image.vendor="Myriadsocial" \
  social.myriad.api.image.title="myriadsocial/myriad-api" \
  social.myriad.api.image.description="myriad backend" \
  social.myriad.api.image.source="https://github.com/myriadsocial/myriad-api/Dockerfile" \
  social.myriad.api.image.documentation="https://github.com/myriadsocial/myriad-node/"

# Set to a non-root built-in user `node`
USER node

# Create app directory (with user `node`)
RUN mkdir -p /home/node/app

WORKDIR /home/node/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY --chown=node package*.json ./

RUN npm install

# Bundle app source code
COPY --chown=node . .

RUN npm run build

# Bind to all network interfaces so that it can be mapped to the host OS
ENV HOST=0.0.0.0 PORT=3000

EXPOSE ${PORT}
CMD [ "node", "." ]
