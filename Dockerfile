# WatermarksXR — static site served by nginx (used by Coolify: build pack "Dockerfile")
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html app.css app.js ar.js sw.js manifest.webmanifest /usr/share/nginx/html/
COPY assets /usr/share/nginx/html/assets
COPY vendor /usr/share/nginx/html/vendor
COPY targets /usr/share/nginx/html/targets
EXPOSE 80
