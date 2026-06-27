-- Add unique constraint for ON DUPLICATE KEY UPDATE support
-- Remove any duplicate rows first (keep the one with the highest id)
DELETE rp1 FROM roles_permissions rp1
INNER JOIN roles_permissions rp2
WHERE rp1.user_id = rp2.user_id
  AND rp1.module_name = rp2.module_name
  AND rp1.id < rp2.id;

ALTER TABLE roles_permissions
ADD UNIQUE KEY uk_user_module (user_id, module_name);
