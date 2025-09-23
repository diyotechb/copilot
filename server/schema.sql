CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT,
  startTime TEXT,
  endTime TEXT,
  lastActive TEXT
);

CREATE TABLE IF NOT EXISTS interviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId INTEGER,
  question TEXT,
  answer TEXT,
  transcript TEXT,
  FOREIGN KEY(sessionId) REFERENCES sessions(id)
);