[Unit]
Description=TON Bagman Next.js app
After=network-online.target __SERVICE_AFTER__
Wants=network-online.target
__SERVICE_REQUIREMENT__

[Service]
Type=simple
User=__APP_USER__
Group=__APP_USER__
WorkingDirectory=__APP_DIR__
Environment=NODE_ENV=production
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/bin/env npm run start -- --hostname 127.0.0.1 --port __APP_PORT__
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
