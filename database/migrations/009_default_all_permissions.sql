-- Grant all permissions (view/create/edit/delete) on every module to existing
-- users who do not yet have a permission row for that module. New members are
-- granted all permissions automatically at registration (see authController).
INSERT INTO roles_permissions (user_id, module_name, can_view, can_create, can_edit, can_delete)
SELECT u.id, m.module_name, TRUE, TRUE, TRUE, TRUE
FROM users u
CROSS JOIN (
  SELECT 'dashboard' AS module_name
  UNION ALL SELECT 'projects' AS module_name
  UNION ALL SELECT 'tasks'
  UNION ALL SELECT 'team'
  UNION ALL SELECT 'documents'
  UNION ALL SELECT 'reports'
  UNION ALL SELECT 'activity'
  UNION ALL SELECT 'announcements'
  UNION ALL SELECT 'subscriptions'
) m
WHERE NOT EXISTS (
  SELECT 1 FROM roles_permissions rp WHERE rp.user_id = u.id AND rp.module_name = m.module_name
);
