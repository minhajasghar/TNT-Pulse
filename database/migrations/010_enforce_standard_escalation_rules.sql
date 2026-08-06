-- Migration 010: Enforce standard escalation rules only
-- Removes any rules whose threshold is not one of the 5 approved values:
--   percentage: 50
--   fixed_days: 7, 3, 1, 0
-- Also ensures the 5 default rules exist if they were deleted.

DELETE FROM alert_escalation_rules
WHERE
  (trigger_type = 'percentage' AND threshold_value != 50)
  OR (trigger_type = 'fixed_days' AND threshold_value NOT IN (0, 1, 3, 7));

-- Re-insert any missing default rules (INSERT IGNORE skips duplicates if a unique key exists)
INSERT IGNORE INTO alert_escalation_rules (rule_name, trigger_type, threshold_value, frequency, applies_to, display_order)
SELECT 'Halfway Point', 'percentage', 50, 'once', 'both', 1
WHERE NOT EXISTS (
  SELECT 1 FROM alert_escalation_rules WHERE trigger_type = 'percentage' AND threshold_value = 50
);

INSERT IGNORE INTO alert_escalation_rules (rule_name, trigger_type, threshold_value, frequency, applies_to, display_order)
SELECT 'One Week Remaining', 'fixed_days', 7, 'daily', 'both', 2
WHERE NOT EXISTS (
  SELECT 1 FROM alert_escalation_rules WHERE trigger_type = 'fixed_days' AND threshold_value = 7
);

INSERT IGNORE INTO alert_escalation_rules (rule_name, trigger_type, threshold_value, frequency, applies_to, display_order)
SELECT 'Three Days Remaining', 'fixed_days', 3, 'daily', 'both', 3
WHERE NOT EXISTS (
  SELECT 1 FROM alert_escalation_rules WHERE trigger_type = 'fixed_days' AND threshold_value = 3
);

INSERT IGNORE INTO alert_escalation_rules (rule_name, trigger_type, threshold_value, frequency, applies_to, display_order)
SELECT 'One Day Remaining', 'fixed_days', 1, 'daily', 'both', 4
WHERE NOT EXISTS (
  SELECT 1 FROM alert_escalation_rules WHERE trigger_type = 'fixed_days' AND threshold_value = 1
);

INSERT IGNORE INTO alert_escalation_rules (rule_name, trigger_type, threshold_value, frequency, applies_to, display_order)
SELECT 'Overdue/Expired', 'fixed_days', 0, 'daily', 'both', 5
WHERE NOT EXISTS (
  SELECT 1 FROM alert_escalation_rules WHERE trigger_type = 'fixed_days' AND threshold_value = 0
);
