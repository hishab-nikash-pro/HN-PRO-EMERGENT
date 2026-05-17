# Hishab Nikash Pro VPS Deployment Guide

This guide assumes:

- Ubuntu 22.04 or newer
- domain name already pointed to your VPS
- MongoDB available locally or through MongoDB Atlas
- backend served on port `8001`
- frontend built statically and served by Nginx

## 1. Install System Packages

```bash
sudo apt update
sudo apt install -y nginx python3 python3-venv python3-pip nodejs npm
sudo npm install -g yarn
```

## 2. Copy Project To Server

Example:

```bash
scp -r ./your-project-folder user@your-vps:/var/www/accounting-app
```

## 3. Backend Setup

```bash
cd /var/www/accounting-app/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` for production:

- set real `MONGO_URL`
- set `DB_NAME`
- set `CORS_ORIGINS=https://yourdomain.com`
- set `COOKIE_SECURE=true`
- set `COOKIE_SAMESITE=none`
- set `APP_DISPLAY_NAME`
- set email and AI keys if used
- optionally set `GOOGLE_SESSION_EXCHANGE_URL`
- disable Google OAuth if you no longer want external OAuth fallback:
  `ALLOW_GOOGLE_OAUTH=false`

## 4. Frontend Setup

```bash
cd /var/www/accounting-app/frontend
cp .env.example .env
yarn install
yarn build
```

Set frontend `.env` values:

- `REACT_APP_BACKEND_URL=https://api.yourdomain.com` or `https://yourdomain.com`
- your app name and support email
- optionally set `REACT_APP_GOOGLE_AUTH_URL`

## 5. systemd Service For FastAPI

Create `/etc/systemd/system/accounting-backend.service`

```ini
[Unit]
Description=Hishab Nikash Pro Backend
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/accounting-app/backend
Environment="PATH=/var/www/accounting-app/backend/.venv/bin"
ExecStart=/var/www/accounting-app/backend/.venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable accounting-backend
sudo systemctl start accounting-backend
sudo systemctl status accounting-backend
```

## 6. Nginx

Create `/etc/nginx/sites-available/accounting-app`

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    root /var/www/accounting-app/frontend/build;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri /index.html;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/accounting-app /etc/nginx/sites-enabled/accounting-app
sudo nginx -t
sudo systemctl reload nginx
```

## 7. HTTPS

Install Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

After HTTPS is active:

- keep `COOKIE_SECURE=true`
- keep `COOKIE_SAMESITE=none`

## 8. Updates

When you deploy changes:

```bash
cd /var/www/accounting-app/frontend
yarn install
yarn build

cd /var/www/accounting-app/backend
source .venv/bin/activate
pip install -r requirements.txt

sudo systemctl restart accounting-backend
sudo systemctl reload nginx
```

## 9. Recommended Production Additions

- MongoDB backups
- Sentry or equivalent error tracking
- daily database snapshot automation
- log rotation
- admin email domain restrictions
- stronger password policy
- per-company owner assignment review
- object storage for uploads instead of base64 payloads
- recurring schedule trigger via cron hitting the recurring run endpoint if you want unattended generation
- bank statement CSV imports should be backed up along with Mongo so reconciliations stay auditable
