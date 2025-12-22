module.exports = {
  apps: [
    {
      name: 'copilot-remote-server',
      script: 'server/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    }
  ]
};
