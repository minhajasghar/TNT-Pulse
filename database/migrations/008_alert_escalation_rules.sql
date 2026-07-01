CREATE TABLE IF NOT EXISTS alert_escalation_rules (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  rule_name VARCHAR(255) NOT NULL,
  trigger_type ENUM('percentage', 'fixed_days') NOT NULL,
  threshold_value DECIMAL(10,2) NOT NULL,
  frequency ENUM('once', 'daily') DEFAULT 'once',
  applies_to ENUM('projects', 'subscriptions', 'both') DEFAULT 'both',
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_by INT UNSIGNED,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO alert_escalation_rules (rule_name, trigger_type, threshold_value, frequency, applies_to, display_order)
VALUES
  ('Halfway Point', 'percentage', 50, 'once', 'both', 1),
  ('One Week Remaining', 'fixed_days', 7, 'daily', 'both', 2),
  ('Three Days Remaining', 'fixed_days', 3, 'daily', 'both', 3),
  ('One Day Remaining', 'fixed_days', 1, 'daily', 'both', 4),
  ('Overdue/Expired', 'fixed_days', 0, 'daily', 'both', 5);

CREATE TABLE IF NOT EXISTS escalation_alert_history (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  rule_id INT UNSIGNED NOT NULL,
  entity_type ENUM('project', 'subscription') NOT NULL,
  entity_id INT NOT NULL,
  fired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rule_id) REFERENCES alert_escalation_rules(id) ON DELETE CASCADE,
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_rule_entity (rule_id, entity_type, entity_id)
);
