const { getUserImages } = require('../../lib/store');

module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Missing id' });
  const row = getUserImages(id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  return res.status(200).json(row);
};
