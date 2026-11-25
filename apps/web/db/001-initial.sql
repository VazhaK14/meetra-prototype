CREATE TABLE accounts (
  id text PRIMARY KEY,
  username text UNIQUE NOT NULL,
  password_hash text,
  profile jsonb NOT NULL DEFAULT '{}',
  onboarding_step smallint NOT NULL DEFAULT 0 CHECK (onboarding_step BETWEEN 0 AND 4),
  dummy_profile jsonb,
  CHECK ((password_hash IS NULL) <> (dummy_profile IS NULL))
);

CREATE TABLE login_sessions (
  token_hash text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);

CREATE TABLE login_attempts (
  bucket text PRIMARY KEY,
  attempts integer NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE TABLE pods (
  id text PRIMARY KEY,
  owner_id text REFERENCES accounts(id),
  title text NOT NULL,
  topic text NOT NULL,
  goal text NOT NULL,
  schedule text NOT NULL
);

CREATE TABLE pod_members (
  pod_id text NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
  account_id text NOT NULL REFERENCES accounts(id),
  role text NOT NULL CHECK (role IN ('Mentor', 'Mentor tambahan', 'Mentee')),
  PRIMARY KEY (pod_id, account_id)
);

CREATE TABLE recommendations (
  id uuid PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('offer', 'need', 'exchange')),
  result jsonb NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes')
);

CREATE TABLE learning_sessions (
  id uuid PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  recommendation_id uuid UNIQUE REFERENCES recommendations(id),
  pod_id text REFERENCES pods(id),
  snapshot jsonb NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'feedback', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE UNIQUE INDEX learning_one_open_per_account
  ON learning_sessions (account_id) WHERE status <> 'completed';

CREATE INDEX learning_history_by_account
  ON learning_sessions (account_id, completed_at DESC) WHERE status = 'completed';

CREATE TABLE feedback (
  session_id uuid PRIMARY KEY REFERENCES learning_sessions(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  note text NOT NULL
);
