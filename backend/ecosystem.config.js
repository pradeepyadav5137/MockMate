module.exports = {
  apps: [
    {
      name: 'mockmate-api',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
    },
    {
      name: 'mockmate-agent',
      script: 'agent.js',
      instances: 2,
      exec_mode: 'fork',
      args: 'start',
      watch: false,
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
