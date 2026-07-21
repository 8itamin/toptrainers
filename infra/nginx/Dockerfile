# syntax=docker/dockerfile:1
FROM nginx:1.27.5-alpine

RUN rm -f /etc/nginx/conf.d/default.conf

COPY toptrainers.conf.template /etc/nginx/templates/toptrainers.conf.template
COPY snippets/toptrainers-proxy-headers.conf /etc/nginx/snippets/toptrainers-proxy-headers.conf

EXPOSE 8080
