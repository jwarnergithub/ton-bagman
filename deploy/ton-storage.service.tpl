[Unit]
Description=TON Storage Daemon
After=network-online.target ssh.service sshd.service
Wants=network-online.target

[Service]
Type=simple
User=__APP_USER__
Group=__APP_USER__
WorkingDirectory=__TON_ROOT__
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=__TON_BIN_DIR__/storage-daemon --storage-provider -v 3 -C __TON_GLOBAL_CONFIG_PATH__ -I __TON_ADNL_IP__:__TON_ADNL_PORT__ -p __TON_CONTROL_PORT__ -D __TON_DB_DIR__
Restart=on-failure
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
