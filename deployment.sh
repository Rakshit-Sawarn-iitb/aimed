#!/bin/bash

set -e

BASE_DIR="/var/www/aimed"
FRONTEND_DIR="$BASE_DIR/frontend"
BACKEND_DIR="$BASE_DIR/backend"
SERVER_IP="164.52.215.188"

echo "Updating package lists and installing dependencies..."
sudo apt update

echo "Installing nginx, supervisor, and nodejs..."
sudo apt install nginx -y
sudo apt install supervisor -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

echo "Setting up Python virtual environment..."
cd "$BACKEND_DIR"
python3 -m venv venv
source venv/bin/activate

echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "Installing frontend dependencies..."
cd "$FRONTEND_DIR"
npm install

echo "Creating environment files..."
# Frontend: VITE_API_BASE_URL=/api tells the app to hit /api/* which nginx proxies to FastAPI
echo "VITE_API_BASE_URL=/api" > .env.production
echo "VITE_API_BASE_URL=http://localhost:8000" > .env.development

echo "Building frontend..."
npm run build

echo "Writing nginx config..."
sudo bash -c 'cat > /etc/nginx/sites-available/default << '\''EOF'\''
server {
    listen 80;
    server_name '"$SERVER_IP"';
    client_max_body_size 100M;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;

    # API proxy — trailing slash on proxy_pass strips the /api prefix
    # so /api/consults → http://127.0.0.1:8000/consults
    location ^~ /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }

    # Vite static assets (hashed filenames — cache forever)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /var/www/aimed/frontend/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # React Router catch-all
    location / {
        root /var/www/aimed/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
EOF'

echo "Testing nginx configuration..."
sudo nginx -t

echo "Writing supervisor config for FastAPI..."
sudo bash -c 'cat > /etc/supervisor/conf.d/fastapi.conf << '\''EOF'\''
[program:fastapi]
directory=/var/www/aimed/backend
command=/var/www/aimed/backend/venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000
user=root
autostart=true
autorestart=true
stderr_logfile=/var/log/aimed-fastapi.err.log
stdout_logfile=/var/log/aimed-fastapi.out.log
environment=PATH="/var/www/aimed/backend/venv/bin"
EOF'

echo "Starting/reloading services..."
sudo supervisord -c /etc/supervisor/supervisord.conf 2>/dev/null || true
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl restart fastapi

sudo nginx -s reload 2>/dev/null || sudo nginx

echo ""
echo "Done. Backend: http://$SERVER_IP/api/health"
echo "      Frontend: http://$SERVER_IP"
