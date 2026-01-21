CREATE TABLE marketing_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL UNIQUE,
    sender_name TEXT,
    sender_email TEXT,
    reply_to_email TEXT,
    tracking_enabled_default INTEGER NOT NULL DEFAULT 1,
    double_opt_in INTEGER NOT NULL DEFAULT 0,
    sending_provider TEXT NOT NULL DEFAULT 'ses',
    webhook_signing_secret TEXT,
    tracking_domain TEXT,
    unsubscribe_base_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE marketing_sender_domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    domain TEXT NOT NULL,
    status TEXT NOT NULL,
    dkim_status TEXT NOT NULL,
    spf_status TEXT NOT NULL,
    tracking_domain TEXT,
    verified_at TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(business_id, domain)
);

CREATE TABLE marketing_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    source TEXT,
    tracking_opt_in INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    UNIQUE(business_id, email)
);

CREATE INDEX idx_marketing_contacts_business_email
    ON marketing_contacts (business_id, email);

CREATE TABLE marketing_contact_consents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    consent_type TEXT NOT NULL,
    status TEXT NOT NULL,
    source TEXT,
    granted_at TEXT,
    revoked_at TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX idx_marketing_contact_consents_contact
    ON marketing_contact_consents (business_id, contact_id, consent_type, status);

CREATE TABLE marketing_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(business_id, name)
);

CREATE TABLE marketing_contact_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(contact_id, tag_id)
);

CREATE INDEX idx_marketing_contact_tags_contact
    ON marketing_contact_tags (business_id, contact_id);

CREATE TABLE marketing_segments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    rule_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    last_evaluated_at TEXT,
    member_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE marketing_segment_memberships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    segment_id INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    added_at TEXT NOT NULL,
    UNIQUE(segment_id, contact_id)
);

CREATE INDEX idx_marketing_segment_memberships_segment
    ON marketing_segment_memberships (business_id, segment_id);

CREATE TABLE marketing_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    current_version_id INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE marketing_template_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    template_id INTEGER NOT NULL,
    version INTEGER NOT NULL,
    subject TEXT NOT NULL,
    html_body TEXT,
    text_body TEXT,
    mjml_body TEXT,
    design_json TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX idx_marketing_template_versions_template
    ON marketing_template_versions (business_id, template_id, version);

CREATE TABLE marketing_campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    segment_id INTEGER,
    template_version_id INTEGER,
    subject_override TEXT,
    from_name TEXT,
    from_email TEXT,
    reply_to_email TEXT,
    primary_link_url TEXT,
    scheduled_at TEXT,
    sent_at TEXT,
    tracking_enabled INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_marketing_campaigns_status
    ON marketing_campaigns (business_id, status);

CREATE TABLE marketing_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    campaign_id INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    html_body TEXT,
    text_body TEXT,
    from_name TEXT,
    from_email TEXT,
    reply_to_email TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    provider TEXT,
    provider_message_id TEXT,
    tracking_enabled INTEGER NOT NULL DEFAULT 1,
    tracking_open_token TEXT,
    unsubscribe_token TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(campaign_id, contact_id)
);

CREATE INDEX idx_marketing_messages_campaign_status
    ON marketing_messages (business_id, campaign_id, status);

CREATE TABLE marketing_message_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    message_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    token TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(token)
);

CREATE TABLE marketing_campaign_recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    campaign_id INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    message_id INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    queued_at TEXT,
    sent_at TEXT,
    last_event_at TEXT,
    error TEXT,
    UNIQUE(campaign_id, contact_id)
);

CREATE INDEX idx_marketing_campaign_recipients_status
    ON marketing_campaign_recipients (business_id, campaign_id, status);

CREATE TABLE marketing_email_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    message_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    event_time TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_event_id TEXT NOT NULL,
    meta_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(provider, provider_event_id)
);

CREATE INDEX idx_marketing_email_events_message_time
    ON marketing_email_events (business_id, message_id, event_time);

CREATE TABLE marketing_suppressions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    reason TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(business_id, email)
);

CREATE TABLE marketing_erasure_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    requested_at TEXT NOT NULL,
    processed_at TEXT,
    requested_by TEXT
);

CREATE TABLE marketing_automations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    trigger_type TEXT NOT NULL,
    trigger_config_json TEXT NOT NULL,
    current_version_id INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE marketing_automation_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    automation_id INTEGER NOT NULL,
    version INTEGER NOT NULL,
    steps_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE marketing_automation_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    automation_id INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    last_step_index INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_marketing_automation_runs_status
    ON marketing_automation_runs (business_id, automation_id, status);

CREATE TABLE marketing_automation_step_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    automation_run_id INTEGER NOT NULL,
    step_index INTEGER NOT NULL,
    status TEXT NOT NULL,
    scheduled_at TEXT,
    executed_at TEXT,
    result_json TEXT,
    error TEXT
);

CREATE TABLE marketing_analytics_daily (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    campaign_id INTEGER,
    automation_id INTEGER,
    date TEXT NOT NULL,
    sent_count INTEGER NOT NULL DEFAULT 0,
    delivered_count INTEGER NOT NULL DEFAULT 0,
    open_count INTEGER NOT NULL DEFAULT 0,
    click_count INTEGER NOT NULL DEFAULT 0,
    bounce_count INTEGER NOT NULL DEFAULT 0,
    complaint_count INTEGER NOT NULL DEFAULT 0,
    unsubscribe_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    UNIQUE(business_id, date, campaign_id, automation_id)
);

CREATE TABLE marketing_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    input_json TEXT NOT NULL,
    output_json TEXT,
    error_detail TEXT,
    dedupe_key TEXT NOT NULL,
    run_at TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(business_id, dedupe_key)
);

CREATE INDEX idx_marketing_jobs_status
    ON marketing_jobs (business_id, status, run_at);

CREATE TABLE marketing_webhook_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER,
    provider TEXT NOT NULL,
    event_id TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    dedupe_key TEXT NOT NULL,
    received_at TEXT NOT NULL,
    UNIQUE(provider, event_id)
);

CREATE TABLE marketing_billing_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    plan_code TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT
);

CREATE TABLE marketing_billing_usage_daily (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    sends_count INTEGER NOT NULL DEFAULT 0,
    contacts_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    UNIQUE(business_id, date)
);
