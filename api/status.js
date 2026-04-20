const { isConfigured } = require('../lib/supabase');

module.exports = function handler(req, res) {
  res.status(200).json({
    storage_configured: isConfigured(),
  });
};
