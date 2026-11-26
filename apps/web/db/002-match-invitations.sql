CREATE TABLE match_invitations (
  id uuid PRIMARY KEY REFERENCES recommendations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE match_invitation_recipients (
  invitation_id uuid NOT NULL REFERENCES match_invitations(id) ON DELETE CASCADE,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  response text NOT NULL DEFAULT 'pending' CHECK (response IN ('pending', 'accepted', 'declined')),
  responded_at timestamptz,
  PRIMARY KEY (invitation_id, account_id)
);

CREATE INDEX match_invitation_recipients_by_account ON match_invitation_recipients (account_id);
