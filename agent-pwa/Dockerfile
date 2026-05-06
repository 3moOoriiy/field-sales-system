FROM node:20-alpine AS builder
WORKDIR /app
ARG VITE_AGENT_API_URL=http://localhost:3000
ENV VITE_AGENT_API_URL=$VITE_AGENT_API_URL
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
