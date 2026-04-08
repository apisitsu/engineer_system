# Stage 1: Build stage
FROM node:20-alpine AS build

WORKDIR /app

# คัดลอกไฟล์ package.json และติดตั้ง dependencies
COPY package*.json ./
RUN npm install

# คัดลอกไฟล์ทั้งหมดและ Build โปรเจกต์
COPY . .
RUN npm run build

# Stage 2: Production stage
FROM nginx:stable-alpine

# คัดลอกไฟล์ที่ Build เสร็จแล้วจาก Stage 1 ไปยัง Nginx
# หมายเหตุ: หากใช้ Vite โฟลเดอร์จะเป็น /dist แต่ถ้าเป็น CRA จะเป็น /build
COPY --from=build /app/dist /usr/share/nginx/html

# คัดลอกไฟล์ config ของ Nginx (ถ้ามี)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]