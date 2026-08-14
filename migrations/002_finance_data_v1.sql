BEGIN;

CREATE TABLE IF NOT EXISTS owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT owners_google_sub_not_blank CHECK (BTRIM(google_sub) <> '')
);

CREATE TABLE IF NOT EXISTS finance_meta (
  owner_id UUID PRIMARY KEY,
  schema_version SMALLINT NOT NULL,
  as_of DATE NOT NULL,
  currency TEXT NOT NULL,
  monthly_income_cents BIGINT NOT NULL,
  salary_day SMALLINT,
  CONSTRAINT finance_meta_owner_fk FOREIGN KEY (owner_id) REFERENCES owners (id),
  CONSTRAINT finance_meta_schema_version_v1 CHECK (schema_version = 1),
  CONSTRAINT finance_meta_currency_eur CHECK (currency = 'EUR'),
  CONSTRAINT finance_meta_monthly_income_safe CHECK (
    monthly_income_cents BETWEEN -9007199254740991 AND 9007199254740991
  ),
  CONSTRAINT finance_meta_salary_day_valid CHECK (salary_day IS NULL OR salary_day BETWEEN 1 AND 31)
);

CREATE TABLE IF NOT EXISTS accounts (
  owner_id UUID NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  display_order BIGINT NOT NULL,
  active BOOLEAN NOT NULL,
  PRIMARY KEY (owner_id, id),
  CONSTRAINT accounts_owner_fk FOREIGN KEY (owner_id) REFERENCES owners (id),
  CONSTRAINT accounts_id_kebab_case CHECK (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT accounts_name_not_blank CHECK (BTRIM(name) <> ''),
  CONSTRAINT accounts_kind_valid CHECK (kind IN ('bank', 'wallet', 'cash')),
  CONSTRAINT accounts_display_order_safe CHECK (
    display_order BETWEEN -9007199254740991 AND 9007199254740991
  )
);

CREATE TABLE IF NOT EXISTS account_snapshots (
  owner_id UUID NOT NULL,
  account_id TEXT NOT NULL,
  as_of DATE NOT NULL,
  balance_cents BIGINT NOT NULL,
  PRIMARY KEY (owner_id, account_id, as_of),
  CONSTRAINT account_snapshots_account_fk
    FOREIGN KEY (owner_id, account_id) REFERENCES accounts (owner_id, id),
  CONSTRAINT account_snapshots_balance_safe CHECK (
    balance_cents BETWEEN -9007199254740991 AND 9007199254740991
  )
);

CREATE TABLE IF NOT EXISTS pockets (
  owner_id UUID NOT NULL,
  id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  display_order BIGINT NOT NULL,
  active BOOLEAN NOT NULL,
  PRIMARY KEY (owner_id, id),
  CONSTRAINT pockets_owner_fk FOREIGN KEY (owner_id) REFERENCES owners (id),
  CONSTRAINT pockets_account_fk
    FOREIGN KEY (owner_id, account_id) REFERENCES accounts (owner_id, id),
  CONSTRAINT pockets_id_kebab_case CHECK (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT pockets_account_id_kebab_case CHECK (account_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT pockets_name_not_blank CHECK (BTRIM(name) <> ''),
  CONSTRAINT pockets_display_order_safe CHECK (
    display_order BETWEEN -9007199254740991 AND 9007199254740991
  )
);

CREATE TABLE IF NOT EXISTS pocket_snapshots (
  owner_id UUID NOT NULL,
  pocket_id TEXT NOT NULL,
  as_of DATE NOT NULL,
  balance_cents BIGINT NOT NULL,
  PRIMARY KEY (owner_id, pocket_id, as_of),
  CONSTRAINT pocket_snapshots_pocket_fk
    FOREIGN KEY (owner_id, pocket_id) REFERENCES pockets (owner_id, id),
  CONSTRAINT pocket_snapshots_balance_safe CHECK (
    balance_cents BETWEEN -9007199254740991 AND 9007199254740991
  )
);

CREATE TABLE IF NOT EXISTS budget_items (
  owner_id UUID NOT NULL,
  id TEXT NOT NULL,
  label TEXT NOT NULL,
  monthly_amount_cents BIGINT NOT NULL,
  necessity_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  display_order BIGINT NOT NULL,
  active BOOLEAN NOT NULL,
  note TEXT,
  due_day SMALLINT,
  PRIMARY KEY (owner_id, id),
  CONSTRAINT budget_items_owner_fk FOREIGN KEY (owner_id) REFERENCES owners (id),
  CONSTRAINT budget_items_id_kebab_case CHECK (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT budget_items_label_not_blank CHECK (BTRIM(label) <> ''),
  CONSTRAINT budget_items_amount_safe CHECK (
    monthly_amount_cents BETWEEN -9007199254740991 AND 9007199254740991
  ),
  CONSTRAINT budget_items_necessity_valid CHECK (
    necessity_id IN ('essential', 'necessary', 'worthwhile', 'optional', 'unnecessary')
  ),
  CONSTRAINT budget_items_kind_valid CHECK (kind IN ('expense', 'reserve')),
  CONSTRAINT budget_items_display_order_safe CHECK (
    display_order BETWEEN -9007199254740991 AND 9007199254740991
  ),
  CONSTRAINT budget_items_note_not_blank CHECK (note IS NULL OR BTRIM(note) <> ''),
  CONSTRAINT budget_items_due_day_valid CHECK (due_day IS NULL OR due_day BETWEEN 1 AND 31)
);

CREATE TABLE IF NOT EXISTS debts (
  owner_id UUID NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  monthly_payment_cents BIGINT NOT NULL,
  display_order BIGINT NOT NULL,
  active BOOLEAN NOT NULL,
  note TEXT,
  due_day SMALLINT,
  PRIMARY KEY (owner_id, id),
  CONSTRAINT debts_owner_fk FOREIGN KEY (owner_id) REFERENCES owners (id),
  CONSTRAINT debts_id_kebab_case CHECK (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT debts_name_not_blank CHECK (BTRIM(name) <> ''),
  CONSTRAINT debts_kind_valid CHECK (kind IN ('loan', 'installment')),
  CONSTRAINT debts_monthly_payment_safe CHECK (
    monthly_payment_cents BETWEEN -9007199254740991 AND 9007199254740991
  ),
  CONSTRAINT debts_display_order_safe CHECK (
    display_order BETWEEN -9007199254740991 AND 9007199254740991
  ),
  CONSTRAINT debts_note_not_blank CHECK (note IS NULL OR BTRIM(note) <> ''),
  CONSTRAINT debts_due_day_valid CHECK (due_day IS NULL OR due_day BETWEEN 1 AND 31)
);

CREATE TABLE IF NOT EXISTS debt_snapshots (
  owner_id UUID NOT NULL,
  debt_id TEXT NOT NULL,
  as_of DATE NOT NULL,
  payoff_balance_cents BIGINT NOT NULL,
  remaining_payment_count BIGINT NOT NULL,
  remaining_scheduled_total_cents BIGINT NOT NULL,
  PRIMARY KEY (owner_id, debt_id, as_of),
  CONSTRAINT debt_snapshots_debt_fk
    FOREIGN KEY (owner_id, debt_id) REFERENCES debts (owner_id, id),
  CONSTRAINT debt_snapshots_payoff_balance_safe CHECK (
    payoff_balance_cents BETWEEN -9007199254740991 AND 9007199254740991
  ),
  CONSTRAINT debt_snapshots_payment_count_safe CHECK (
    remaining_payment_count BETWEEN 0 AND 9007199254740991
  ),
  CONSTRAINT debt_snapshots_scheduled_total_safe CHECK (
    remaining_scheduled_total_cents BETWEEN -9007199254740991 AND 9007199254740991
  )
);

CREATE TABLE IF NOT EXISTS debt_milestones (
  owner_id UUID NOT NULL,
  debt_id TEXT NOT NULL,
  milestone_date DATE NOT NULL,
  date_precision TEXT NOT NULL,
  balance_cents BIGINT NOT NULL,
  PRIMARY KEY (owner_id, debt_id, milestone_date, date_precision),
  CONSTRAINT debt_milestones_debt_fk
    FOREIGN KEY (owner_id, debt_id) REFERENCES debts (owner_id, id),
  CONSTRAINT debt_milestones_precision_valid CHECK (date_precision IN ('month', 'day')),
  CONSTRAINT debt_milestones_month_first CHECK (
    date_precision <> 'month' OR EXTRACT(DAY FROM milestone_date) = 1
  ),
  CONSTRAINT debt_milestones_balance_safe CHECK (
    balance_cents BETWEEN -9007199254740991 AND 9007199254740991
  )
);

CREATE TABLE IF NOT EXISTS relief_milestones (
  owner_id UUID NOT NULL,
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  milestone_date DATE NOT NULL,
  date_precision TEXT NOT NULL,
  monthly_relief_cents BIGINT NOT NULL,
  event TEXT NOT NULL,
  event_detail TEXT,
  PRIMARY KEY (owner_id, id),
  CONSTRAINT relief_milestones_owner_fk FOREIGN KEY (owner_id) REFERENCES owners (id),
  CONSTRAINT relief_milestones_precision_valid CHECK (date_precision IN ('month', 'day')),
  CONSTRAINT relief_milestones_month_first CHECK (
    date_precision <> 'month' OR EXTRACT(DAY FROM milestone_date) = 1
  ),
  CONSTRAINT relief_milestones_amount_safe CHECK (
    monthly_relief_cents BETWEEN -9007199254740991 AND 9007199254740991
  ),
  CONSTRAINT relief_milestones_event_not_blank CHECK (BTRIM(event) <> ''),
  CONSTRAINT relief_milestones_detail_not_blank CHECK (
    event_detail IS NULL OR BTRIM(event_detail) <> ''
  )
);

CREATE INDEX IF NOT EXISTS accounts_owner_order_idx
  ON accounts (owner_id, display_order, id);
CREATE INDEX IF NOT EXISTS pockets_owner_order_idx
  ON pockets (owner_id, display_order, id);
CREATE INDEX IF NOT EXISTS budget_items_owner_order_idx
  ON budget_items (owner_id, display_order, id);
CREATE INDEX IF NOT EXISTS debts_owner_order_idx
  ON debts (owner_id, display_order, id);
CREATE INDEX IF NOT EXISTS relief_milestones_owner_order_idx
  ON relief_milestones (owner_id, milestone_date, event, event_detail, id);

COMMIT;
