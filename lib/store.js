const { getClient } = require('./supabase');
const { SLOTS } = require('./slots');

const TABLE = 'photo_uploads';

async function upsertUserImages(userId, links) {
  const supabase = getClient();

  const { data: existing, error: selectErr } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (selectErr) throw new Error(`DB read failed: ${selectErr.message}`);

  const merged = { user_id: userId };
  for (const slot of SLOTS) {
    merged[slot] = links[slot] || (existing ? existing[slot] : null);
  }
  merged.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(merged, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw new Error(`DB write failed: ${error.message}`);
  return data;
}

async function getUserImages(userId) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`DB read failed: ${error.message}`);
  return data || null;
}

module.exports = { upsertUserImages, getUserImages };
