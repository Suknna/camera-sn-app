export const LOCAL_DB_NAME = 'camerasn_app'
export const LOCAL_DB_VERSION = 1

export const LOCAL_DB_SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  operator_name TEXT NOT NULL CHECK (length(trim(operator_name)) > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS catalog_seed (
  version TEXT PRIMARY KEY,
  imported_at TEXT NOT NULL,
  source_hash TEXT NOT NULL CHECK (length(trim(source_hash)) > 0)
);

CREATE TABLE IF NOT EXISTS data_centers (
  id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  seed_version TEXT NOT NULL,
  PRIMARY KEY (id, seed_version),
  FOREIGN KEY (seed_version) REFERENCES catalog_seed(version) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT NOT NULL,
  data_center_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  seed_version TEXT NOT NULL,
  PRIMARY KEY (id, seed_version),
  FOREIGN KEY (data_center_id, seed_version)
    REFERENCES data_centers(id, seed_version) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS racks (
  id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  seed_version TEXT NOT NULL,
  PRIMARY KEY (id, seed_version),
  FOREIGN KEY (room_id, seed_version)
    REFERENCES rooms(id, seed_version) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scan_batches (
  local_batch_id TEXT PRIMARY KEY,
  client_batch_id TEXT NOT NULL UNIQUE,
  batch_no TEXT NOT NULL UNIQUE,
  arrival_batch_name TEXT NOT NULL CHECK (length(trim(arrival_batch_name)) > 0),
  operator_name TEXT NOT NULL CHECK (length(trim(operator_name)) > 0),
  data_center_id TEXT NOT NULL,
  data_center_name TEXT NOT NULL CHECK (length(trim(data_center_name)) > 0),
  room_id TEXT NOT NULL,
  room_name TEXT NOT NULL CHECK (length(trim(room_name)) > 0),
  catalog_seed_version TEXT NOT NULL,
  machine_config_summary TEXT NOT NULL CHECK (length(trim(machine_config_summary)) > 0),
  default_config_note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft', 'completed', 'exported')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  last_exported_at TEXT,
  FOREIGN KEY (data_center_id, catalog_seed_version)
    REFERENCES data_centers(id, seed_version),
  FOREIGN KEY (room_id, catalog_seed_version)
    REFERENCES rooms(id, seed_version)
);

CREATE TABLE IF NOT EXISTS batch_attributes (
  local_attribute_id TEXT PRIMARY KEY,
  local_batch_id TEXT NOT NULL,
  key TEXT NOT NULL CHECK (length(trim(key)) > 0),
  value TEXT NOT NULL,
  FOREIGN KEY (local_batch_id) REFERENCES scan_batches(local_batch_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scan_items (
  local_item_id TEXT PRIMARY KEY,
  client_item_id TEXT NOT NULL,
  local_batch_id TEXT NOT NULL,
  raw_value TEXT NOT NULL CHECK (length(raw_value) > 0),
  serial_number TEXT NOT NULL CHECK (length(trim(serial_number)) > 0),
  barcode_format TEXT NOT NULL CHECK (length(trim(barcode_format)) > 0),
  rack_id TEXT NOT NULL CHECK (length(trim(rack_id)) > 0),
  rack_name TEXT NOT NULL CHECK (length(trim(rack_name)) > 0),
  u_position INTEGER CHECK (u_position IS NULL OR (u_position BETWEEN 1 AND 60)),
  scanned_at TEXT NOT NULL,
  config_note_override TEXT NOT NULL DEFAULT '',
  has_config_override INTEGER NOT NULL DEFAULT 0 CHECK (has_config_override IN (0, 1)),
  FOREIGN KEY (local_batch_id) REFERENCES scan_batches(local_batch_id) ON DELETE CASCADE,
  UNIQUE (local_batch_id, client_item_id),
  UNIQUE (local_batch_id, serial_number)
);

CREATE TABLE IF NOT EXISTS scan_item_attributes (
  local_attribute_id TEXT PRIMARY KEY,
  local_item_id TEXT NOT NULL,
  key TEXT NOT NULL CHECK (length(trim(key)) > 0),
  value TEXT NOT NULL,
  FOREIGN KEY (local_item_id) REFERENCES scan_items(local_item_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS batch_export_records (
  local_export_id TEXT PRIMARY KEY,
  local_batch_id TEXT NOT NULL,
  file_name TEXT NOT NULL CHECK (length(trim(file_name)) > 0),
  file_uri TEXT NOT NULL CHECK (length(trim(file_uri)) > 0),
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_hash TEXT NOT NULL CHECK (length(trim(file_hash)) > 0),
  exported_at TEXT NOT NULL,
  shared_at TEXT,
  FOREIGN KEY (local_batch_id) REFERENCES scan_batches(local_batch_id) ON DELETE CASCADE
);
`
