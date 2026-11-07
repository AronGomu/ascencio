export const USER_DATA_SCHEMA_SQL = `
PRAGMA journal_mode=DELETE;
PRAGMA user_version=1;
CREATE TABLE user_data_meta (
  singleton INTEGER PRIMARY KEY CHECK (singleton=1),
  format TEXT NOT NULL CHECK (format='ascencio-user-data'),
  schema_version INTEGER NOT NULL CHECK (schema_version=1),
  revision INTEGER NOT NULL CHECK (revision>=0)
);
INSERT INTO user_data_meta VALUES (1,'ascencio-user-data',1,0);
CREATE TABLE user_records (
  namespace TEXT NOT NULL,
  record_key TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision>=1),
  payload_json TEXT NOT NULL,
  PRIMARY KEY (namespace,record_key)
);`;
