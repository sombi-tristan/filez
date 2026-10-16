-- StationMGR Desktop: the computers linked to a station.
--
-- The desktop app (desktop/* branches) runs offline. Its owner links it to their web station
-- once, online (POST /api/desktop/link); after that it pushes and pulls the station's records
-- with a device token, and checks the station's subscriptions offline from a signed licence the
-- web hands it on every link, push and pull.
--
-- Only a hash of the token is kept: the token itself is shown to the computer once and never
-- stored here. Revoking a computer (revoked_at) stops its pushes, pulls and licence renewals.
--
-- RLS on with no policies: the server reaches it with the service-role key only.
--
-- MANUAL MIGRATION: run this on production before shipping a desktop build that links.

CREATE TABLE IF NOT EXISTS desktop_devices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- the owner who linked it
  name          text DEFAULT '',                                         -- the computer's name, as reported
  token_hash    text NOT NULL UNIQUE,                                    -- sha256 of the device token
  created_at    timestamptz DEFAULT now(),
  last_seen_at  timestamptz,
  revoked_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_desktop_devices_org ON desktop_devices (org_id);

ALTER TABLE desktop_devices ENABLE ROW LEVEL SECURITY;
