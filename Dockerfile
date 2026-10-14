FROM node:22-alpine

ENV NODE_ENV=production HOST=0.0.0.0 PORT=3069
WORKDIR /app

# zero dependencies: nothing to install, only the code and content
COPY package.json ./
COPY server ./server
COPY shared ./shared
COPY public ./public
COPY content ./content
COPY scripts/validate-content.js ./scripts/validate-content.js

# a broken content file fails the image build instead of the running site
RUN node scripts/validate-content.js

USER node
EXPOSE 3069
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "require('http').get({host:'127.0.0.1',port:3069,path:'/api/streamers',headers:{host:process.env.ALLOWED_HOSTS.split(',')[0]}},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "server/index.js"]
