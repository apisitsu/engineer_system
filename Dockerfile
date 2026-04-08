# ใช้ Nginx ตัวเล็กและเสถียร
FROM nginx:stable-alpine

# 1. ก๊อปปี้ไฟล์เว็บที่ Build เสร็จแล้วจากเครื่องเรา เข้าไปใน Nginx
COPY apps/ENG-Frontend/build /usr/share/nginx/html

# 2. ก๊อปปี้ไฟล์ Config เพื่อจัดการ Routing ของ React
COPY nginx.conf /etc/nginx/conf.d/default.conf

# เปิด Port 80 สำหรับให้ Container คุยกับโลกภายนอก
EXPOSE 80

# สั่งให้ Nginx รันตลอดเวลา
CMD ["nginx", "-g", "daemon off;"]