const { DEFAULT_PORT } = require('./dev-port.json');

module.exports = {
  apps: [
    {
      name: 'taxi-backend',
      script: 'server.js',
      cwd: './backend',
      watch: true,
      env: {
        NODE_ENV: 'development',
        PORT: DEFAULT_PORT,
        DATABASE_URL: 'postgresql://taxi:taxi@127.0.0.1:5433/taxi_free'
      }
    },
    {
      name: 'taxi-frontend',
      script: 'npm',
      args: 'run dev -- --host',
      cwd: './frontend',
      watch: false
    }
  ]
};
