# GRIEVANCE frontend: build with Vite, serve with nginx
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_API_BASE_URL=http://localhost:8000/api/v1
ARG VITE_SITE_URL=http://localhost:8080
ARG VITE_SUPPORT_EMAIL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL VITE_SITE_URL=$VITE_SITE_URL VITE_SUPPORT_EMAIL=$VITE_SUPPORT_EMAIL
RUN npm run build

FROM nginx:1.27-alpine
# Rendered at start-up by the image's envsubst step (only API_ORIGIN and ENFORCE_HTTPS are substituted).
ENV API_ORIGIN=http://localhost:8000 ENFORCE_HTTPS=false NGINX_ENVSUBST_FILTER="^(API_ORIGIN|ENFORCE_HTTPS)$"
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
