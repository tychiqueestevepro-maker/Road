CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  base_url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  poll_interval_seconds INTEGER,
  last_polled_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES data_sources(id),
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'partial', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  records_received INTEGER NOT NULL DEFAULT 0,
  records_created INTEGER NOT NULL DEFAULT 0,
  records_updated INTEGER NOT NULL DEFAULT 0,
  records_failed INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS raw_source_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES data_sources(id),
  external_id TEXT,
  record_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  source_updated_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS raw_source_records_source_hash_idx
  ON raw_source_records(source_id, record_hash);
CREATE INDEX IF NOT EXISTS raw_source_records_source_external_idx
  ON raw_source_records(source_id, external_id);

CREATE TABLE IF NOT EXISTS road_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES data_sources(id),
  external_id TEXT,
  event_type TEXT NOT NULL,
  title TEXT,
  description TEXT,
  road_name TEXT,
  direction TEXT,
  severity INTEGER,
  declared_status TEXT NOT NULL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  geometry GEOMETRY(Geometry, 4326),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  raw_record_id UUID REFERENCES raw_source_records(id),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS road_events_source_external_idx
  ON road_events(source_id, external_id);
CREATE INDEX IF NOT EXISTS road_events_geometry_gix
  ON road_events USING gist(geometry);
CREATE INDEX IF NOT EXISTS road_events_road_name_idx
  ON road_events(road_name);

CREATE TABLE IF NOT EXISTS road_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT,
  name TEXT,
  geometry GEOMETRY(Geometry, 4326) NOT NULL,
  center GEOMETRY(Point, 4326),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS road_segments_geometry_gix
  ON road_segments USING gist(geometry);

CREATE TABLE IF NOT EXISTS cameras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES data_sources(id),
  external_id TEXT,
  name TEXT NOT NULL,
  road_name TEXT,
  direction TEXT,
  location GEOMETRY(Point, 4326),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  snapshot_url TEXT,
  stream_url TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_success_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cameras_source_external_idx
  ON cameras(source_id, external_id);
CREATE INDEX IF NOT EXISTS cameras_location_gix
  ON cameras USING gist(location);

CREATE TABLE IF NOT EXISTS camera_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_id UUID NOT NULL REFERENCES cameras(id),
  captured_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  image_url TEXT,
  storage_path TEXT,
  image_hash TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  analysis_status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS camera_snapshots_camera_hash_idx
  ON camera_snapshots(camera_id, image_hash);

CREATE TABLE IF NOT EXISTS road_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES data_sources(id),
  camera_id UUID REFERENCES cameras(id),
  snapshot_id UUID REFERENCES camera_snapshots(id),
  observation_type TEXT NOT NULL,
  road_name TEXT,
  geometry GEOMETRY(Geometry, 4326),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  observed_state TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  observed_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS road_observations_geometry_gix
  ON road_observations USING gist(geometry);
CREATE INDEX IF NOT EXISTS road_observations_road_name_idx
  ON road_observations(road_name);
CREATE INDEX IF NOT EXISTS road_observations_observed_at_idx
  ON road_observations(observed_at DESC);

CREATE TABLE IF NOT EXISTS discrepancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  road_segment_id UUID REFERENCES road_segments(id),
  road_name TEXT,
  geometry GEOMETRY(Geometry, 4326),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  discrepancy_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  declared_state TEXT NOT NULL,
  observed_state TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  severity INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  explanation JSONB NOT NULL DEFAULT '[]'::jsonb,
  first_detected_at TIMESTAMPTZ NOT NULL,
  last_detected_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discrepancies_geometry_gix
  ON discrepancies USING gist(geometry);
CREATE INDEX IF NOT EXISTS discrepancies_status_idx
  ON discrepancies(status);
CREATE INDEX IF NOT EXISTS discrepancies_type_idx
  ON discrepancies(discrepancy_type);

CREATE TABLE IF NOT EXISTS discrepancy_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discrepancy_id UUID NOT NULL REFERENCES discrepancies(id),
  evidence_type TEXT NOT NULL,
  road_event_id UUID REFERENCES road_events(id),
  observation_id UUID REFERENCES road_observations(id),
  snapshot_id UUID REFERENCES camera_snapshots(id),
  weight DOUBLE PRECISION NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discrepancy_id UUID NOT NULL REFERENCES discrepancies(id),
  alert_type TEXT NOT NULL,
  severity INTEGER NOT NULL,
  message TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
