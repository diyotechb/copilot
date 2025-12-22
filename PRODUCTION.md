Production deployment checklist and quick commands

1) Build the frontend

```bash
npm install --production
npm run build
```

2) Serve the built frontend from Node (server will serve `dist/` when `NODE_ENV=production`)

```bash
# using cross-env (already in devDependencies)
npm run start:prod

# or using pm2 (recommended for process management)
pm install -g pm2
pm run build
pm run start:prod
# or start with ecosystem file
pm2 start ecosystem.config.js
```

3) Required environment variables (do NOT commit secrets):

- `ASSEMBLYAI_API_KEY` - AssemblyAI API key (used by the realtime proxy)
- `NODE_ENV=production` - ensures static serving
- `PORT` - server port (default 3001)
- `REALTIME_DEBUG=false` - disable verbose upstream logging in production

4) Reverse proxy / TLS

- Configure nginx (or your cloud load balancer) to terminate TLS and proxy `/` and `/realtime` to the Node server on `PORT`.
- Ensure WebSocket (`wss://`) proxying is enabled.

5) Security & scaling notes

- Never store secrets in source control. Use environment variables or a secret manager.
- The current proxy creates one upstream AssemblyAI WebSocket per connected client; plan capacity and sticky sessions or a central forwarding service for scale.

6) Process management examples

- PM2 (recommended for Node process management):

```bash
# install pm2 globally if you don't have it
npm install -g pm2

# start the server using the included ecosystem file
pm2 start ecosystem.config.js

# save the process list so it restarts on reboot
pm2 save

# generate and run the startup script for your init system (systemd)
pm2 startup systemd

# view logs
pm2 logs copilot-remote-server
```

- systemd (example unit file below). Copy the file to `/etc/systemd/system/copilot-remote.service`, edit `WorkingDirectory` and `ExecStart` to match your install path, then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now copilot-remote
sudo journalctl -u copilot-remote -f
```

Example `systemd` unit (place in `deploy/copilot-remote.service` in repo as an example):

```
[Unit]
Description=Copilot Remote Node Server
After=network.target

[Service]
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=REALTIME_DEBUG=false
# Set this in production securely; leave blank here as a placeholder
Environment=ASSEMBLYAI_API_KEY=
WorkingDirectory=/var/www/copilot-remote-clone
ExecStart=/usr/bin/node /var/www/copilot-remote-clone/server/server.js
Restart=always
RestartSec=5
User=www-data
Group=www-data
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=copilot-remote

[Install]
WantedBy=multi-user.target
```
