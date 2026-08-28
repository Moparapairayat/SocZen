CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION generate_request_reference_code()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT 'SZ-' || upper(substr(hex, 1, 4)) || '-' || upper(substr(hex, 5, 4)) || '-' || upper(substr(hex, 9, 4))
  FROM (SELECT encode(gen_random_bytes(6), 'hex') AS hex) AS source
$$;

CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected', 'contacted');
CREATE TYPE form_field_type AS ENUM ('text', 'textarea', 'email', 'select', 'checkbox');
CREATE TYPE grant_status AS ENUM ('active', 'expired', 'revoked');

CREATE TABLE subscription_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code TEXT NOT NULL DEFAULT generate_request_reference_code(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  selected_services TEXT[] NOT NULL DEFAULT '{}'::text[],
  use_case TEXT,
  message TEXT,
  status request_status NOT NULL DEFAULT 'pending',
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT subscription_requests_name_length CHECK (char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT subscription_requests_email_length CHECK (char_length(email) BETWEEN 3 AND 255),
  CONSTRAINT subscription_requests_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT subscription_requests_company_length CHECK (
    company IS NULL OR char_length(company) <= 150
  ),
  CONSTRAINT subscription_requests_use_case_length CHECK (
    use_case IS NULL OR char_length(use_case) <= 2000
  ),
  CONSTRAINT subscription_requests_message_length CHECK (
    message IS NULL OR char_length(message) <= 1000
  ),
  CONSTRAINT subscription_requests_selected_count CHECK (
    cardinality(selected_services) BETWEEN 1 AND 10
  )
);

CREATE INDEX idx_subscription_requests_created_at
  ON subscription_requests (created_at DESC);
CREATE INDEX idx_subscription_requests_status
  ON subscription_requests (status);
CREATE UNIQUE INDEX idx_subscription_requests_reference_code
  ON subscription_requests (reference_code);

CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  emoji TEXT NOT NULL DEFAULT '✨',
  bg_class TEXT NOT NULL DEFAULT 'bg-brand-lime',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_services_active_sort
  ON services (is_active, sort_order);

CREATE TABLE form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  field_type form_field_type NOT NULL DEFAULT 'text',
  placeholder TEXT,
  help_text TEXT,
  options TEXT[] NOT NULL DEFAULT '{}'::text[],
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  max_length INTEGER NOT NULL DEFAULT 1000,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_form_fields_active_sort
  ON form_fields (is_active, sort_order);

CREATE TABLE granted_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  service_name TEXT NOT NULL,
  request_id UUID REFERENCES subscription_requests(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  status grant_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_grants_email ON granted_subscriptions (email);
CREATE INDEX idx_grants_expires ON granted_subscriptions (expires_at);
CREATE INDEX idx_grants_status ON granted_subscriptions (status);

CREATE TABLE request_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES subscription_requests(id) ON DELETE CASCADE,
  status request_status NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT
);

CREATE INDEX idx_request_status_history_request_id
  ON request_status_history (request_id, changed_at);

CREATE TABLE admin_credentials (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION log_request_status_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO request_status_history (request_id, status, changed_at, note)
  VALUES (NEW.id, NEW.status, COALESCE(NEW.created_at, now()), NULL);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION log_request_status_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(current_setting('app.skip_request_status_history', true), '') = '1' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO request_status_history (request_id, status, changed_at, note)
    VALUES (NEW.id, NEW.status, now(), NULL);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION mark_expired_grants()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  rows_updated INTEGER;
BEGIN
  UPDATE granted_subscriptions
    SET status = 'expired'
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at < now();
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated;
END;
$$;

CREATE TRIGGER trg_services_updated
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_form_fields_updated
  BEFORE UPDATE ON form_fields
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_grants_updated
  BEFORE UPDATE ON granted_subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_log_request_status_insert
  AFTER INSERT ON subscription_requests
  FOR EACH ROW EXECUTE FUNCTION log_request_status_insert();

CREATE TRIGGER trg_log_request_status_update
  AFTER UPDATE OF status ON subscription_requests
  FOR EACH ROW EXECUTE FUNCTION log_request_status_update();

INSERT INTO services (slug, name, category, emoji, bg_class, sort_order) VALUES
  ('chatgpt-plus', 'ChatGPT Plus', 'AI', '🤖', 'bg-brand-lime', 10),
  ('canva-pro', 'Canva Pro', 'Design', '🎨', 'bg-brand-cyan', 20),
  ('netflix', 'Netflix', 'Streaming', '🎬', 'bg-brand-pink', 30),
  ('spotify', 'Spotify Premium', 'Music', '🎵', 'bg-brand-lime', 40),
  ('youtube-premium', 'YouTube Premium', 'Streaming', '📺', 'bg-brand-pink', 50),
  ('adobe-cc', 'Adobe Creative Cloud', 'Design', '🖌️', 'bg-brand-violet text-white', 60),
  ('notion-ai', 'Notion AI', 'Productivity', '📝', 'bg-brand-yellow', 70),
  ('midjourney', 'Midjourney', 'AI', '🪄', 'bg-brand-violet text-white', 80),
  ('grammarly', 'Grammarly Premium', 'Productivity', '✍️', 'bg-brand-cyan', 90),
  ('disney-plus', 'Disney+', 'Streaming', '🏰', 'bg-brand-orange', 100);

INSERT INTO form_fields (
  field_key,
  label,
  field_type,
  placeholder,
  is_required,
  is_builtin,
  max_length,
  sort_order
) VALUES
  ('company', 'Company', 'text', 'Analytical Engines Inc.', false, true, 150, 10),
  ('use_case', 'What will you use these for?', 'textarea', 'Tell us a bit about how you''ll use these...', false, true, 2000, 20),
  ('message', 'Anything else?', 'textarea', 'Optional message', false, true, 1000, 30);
