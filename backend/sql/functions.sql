-- =============================================
-- FUNCTION: Increment version (cache invalidation)
-- =============================================
CREATE OR REPLACE FUNCTION increment_version(p_store_id INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE stores SET version = version + 1, updated_at = NOW() WHERE id = p_store_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- FUNCTION: Auto-expire stores (run via cron)
-- =============================================
CREATE OR REPLACE FUNCTION auto_expire_stores()
RETURNS VOID AS $$
BEGIN
  UPDATE stores
  SET is_active = FALSE
  WHERE expires_at < NOW() AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql;
