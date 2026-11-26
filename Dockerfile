FROM node:22-alpine AS shell
WORKDIR /src
COPY scripts/build-shell.mjs scripts/build-shell.mjs
COPY dist/ dist/
RUN node scripts/build-shell.mjs

FROM nginx:1.28-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=shell /src/dist/ /usr/share/nginx/html/
EXPOSE 8080
