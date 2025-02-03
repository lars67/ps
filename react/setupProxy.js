const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'https://top.softcapital.com',
      changeOrigin: true,
      secure: false,
      pathRewrite: {
        '^/api': '/ps2console'
      },
      onProxyRes: function(proxyRes, req, res) {
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      }
    })
  );

  app.use(
    '/ws',
    createProxyMiddleware({
      target: 'https://top.softcapital.com',
      changeOrigin: true,
      secure: false,
      ws: true,
      pathRewrite: {
        '^/ws': '/ps2l/'
      },
      headers: {
        'Origin': 'https://top.softcapital.com'
      }
    })
  );
};
