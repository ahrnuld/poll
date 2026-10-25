FROM node:22-alpine
WORKDIR /app
COPY server.js vote.html ./
ENV PORT=3000 DATA_FILE=/data/votes.json
EXPOSE 3000
CMD ["node", "server.js"]
