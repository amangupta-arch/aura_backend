const { isConfigured } = require('../lib/drive');

module.exports = function handler(req, res) {
  res.status(200).json({
    drive_configured: isConfigured(),
  });
};
