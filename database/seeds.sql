-- ============================================================
-- TNT Pulse - Seed Data
-- ============================================================

-- Admin user (password: admin123)
INSERT INTO users (name, email, password_hash, role, status, created_by)
VALUES ('Admin User', 'admin@tntpulse.com', '$2b$12$KazWRHckDQDR3qtjmglMJeEoohupJf7dJm0ou1iE6rhqUMsEno/ju', 'super_admin', 'active', NULL);

-- Manager user (password: manager123)
INSERT INTO users (name, email, password_hash, role, status, created_by)
VALUES ('Sarah Manager', 'sarah@tntpulse.com', '$2b$12$tAcsXIMiiNg6lELKqYDWqu5S.ylNLusdE4kHkStY8d84qqWrbI1hi', 'manager', 'active', 1);

-- Developer users (password: dev123)
INSERT INTO users (name, email, password_hash, role, status, created_by)
VALUES ('John Developer', 'john@tntpulse.com', '$2b$12$3136JGCRSvITXNRCkjVhK.DTwB03xzCkjf3I/mFmj433MGkfYuwLu', 'developer', 'active', 1);

INSERT INTO users (name, email, password_hash, role, status, created_by)
VALUES ('Emily Coder', 'emily@tntpulse.com', '$2b$12$3136JGCRSvITXNRCkjVhK.DTwB03xzCkjf3I/mFmj433MGkfYuwLu', 'developer', 'active', 1);

-- Designer user (password: design123)
INSERT INTO users (name, email, password_hash, role, status, created_by)
VALUES ('Mike Designer', 'mike@tntpulse.com', '$2b$12$9ekINvF7wvMSP1hiwvFYj.NC0hoUdTQau33f6iSbmu2l927VmhZta', 'designer', 'active', 1);

-- Notification preferences for all users
INSERT INTO notification_preferences (user_id, email_enabled, in_app_enabled, alert_days_before_deadline)
VALUES (1, TRUE, TRUE, 3), (2, TRUE, TRUE, 3), (3, TRUE, TRUE, 3), (4, TRUE, TRUE, 3), (5, TRUE, TRUE, 3);

-- Sample projects
INSERT INTO projects (name, description, client_name, start_date, deadline, status, priority, created_by)
VALUES
('Website Redesign', 'Complete redesign of TNT Innovations website with modern UI/UX, CMS integration, and SEO optimization.', 'TNT Innovations', '2025-01-15', '2025-04-15', 'in_progress', 'high', 1),
('Mobile App v2', 'Version 2 of the TNT Pulse mobile app with offline support, push notifications, and dark mode.', 'TNT Innovations', '2025-02-01', '2025-06-30', 'planning', 'critical', 1),
('Client Portal', 'Self-service portal for external clients to view project status, invoices, and communication history.', 'Acme Corp', '2025-01-10', '2025-03-01', 'review', 'medium', 2),
('Internal Dashboard', 'Internal analytics dashboard for tracking company KPIs, resource allocation, and team productivity.', 'TNT Innovations', '2024-11-01', '2025-01-20', 'completed', 'low', 2),
('Legacy Migration', 'Migrate legacy systems to new cloud infrastructure with zero downtime.', 'Global Tech Inc', '2025-03-01', '2025-05-15', 'in_progress', 'critical', 1);

-- Project members
INSERT INTO project_members (project_id, user_id)
VALUES
(1, 2), (1, 3), (1, 4), (1, 5),
(2, 2), (2, 3), (2, 4),
(3, 2), (3, 3),
(4, 2), (4, 3), (4, 4),
(5, 1), (5, 2), (5, 3);

-- Tasks
INSERT INTO tasks (project_id, title, description, assigned_to, created_by, status, priority, estimated_hours, due_date)
VALUES
(1, 'Design homepage wireframes', 'Create wireframes for the new homepage layout with hero section, features grid, and CTA.', 5, 2, 'done', 'high', 16, '2025-01-30'),
(1, 'Set up CMS backend', 'Configure headless CMS with content models for pages, blog posts, and case studies.', 3, 2, 'in_progress', 'high', 24, '2025-02-15'),
(1, 'Implement responsive navigation', 'Build responsive navbar with mobile hamburger menu and dropdown support.', 4, 2, 'todo', 'medium', 12, '2025-02-20'),
(1, 'SEO meta tag system', 'Implement dynamic meta tags, Open Graph, and structured data for all pages.', 3, 2, 'blocked', 'medium', 8, '2025-02-10'),
(2, 'Offline data sync', 'Implement local storage caching and background sync for offline functionality.', 3, 1, 'todo', 'high', 40, '2025-04-15'),
(2, 'Push notification service', 'Build push notification system using Firebase Cloud Messaging.', 4, 1, 'todo', 'high', 24, '2025-04-30'),
(3, 'Invoice generation module', 'Build invoice PDF generation with customizable templates.', 3, 2, 'done', 'medium', 20, '2025-02-10'),
(3, 'Client communication log', 'Create a threaded message system between clients and project managers.', 4, 2, 'in_progress', 'medium', 16, '2025-02-18'),
(4, 'KPI dashboard design', 'Design analytics dashboard with charts, graphs, and export functionality.', 5, 2, 'done', 'low', 16, '2024-12-01'),
(4, 'Resource allocation tracker', 'Build tool for tracking team member allocation across projects.', 3, 2, 'done', 'low', 20, '2025-01-05'),
(5, 'Database migration plan', 'Document and plan the database migration from on-prem to cloud.', 2, 1, 'in_progress', 'critical', 16, '2025-03-20'),
(5, 'Zero-downtime deployment', 'Implement blue-green deployment strategy for seamless cutover.', 3, 1, 'todo', 'critical', 32, '2025-04-15');

-- Milestones
INSERT INTO milestones (project_id, title, due_date, status)
VALUES
(1, 'Design phase complete', '2025-02-01', 'pending'),
(1, 'Frontend development complete', '2025-03-01', 'pending'),
(1, 'QA and deployment', '2025-04-10', 'pending'),
(2, 'Architecture review', '2025-03-01', 'pending'),
(2, 'Beta release', '2025-05-15', 'pending'),
(3, 'UAT sign-off', '2025-02-25', 'pending'),
(5, 'Migration complete', '2025-05-01', 'pending');

-- Requirements
INSERT INTO requirements (project_id, title, description, type, approval_status, created_by)
VALUES
(1, 'Mobile-first responsive design', 'All pages must be fully responsive and work on mobile, tablet, and desktop.', 'functional', 'approved', 2),
(1, 'Page load under 2 seconds', 'All pages must load in under 2 seconds on standard broadband.', 'technical', 'approved', 2),
(1, 'Use brand color palette', 'Design must adhere to the TNT Innovations brand guidelines.', 'client_note', 'approved', 5),
(2, 'Support offline task management', 'Users should be able to view and update tasks offline.', 'functional', 'approved', 2),
(2, 'End-to-end encryption', 'All offline data must be encrypted at rest.', 'technical', 'pending', 3),
(3, 'Client login with SSO', 'Clients should be able to log in using Google SSO.', 'functional', 'approved', 2),
(3, 'Invoice PDF styling', 'Invoices should match company branding with logo and colors.', 'client_note', 'rejected', 2);

-- Comments
INSERT INTO comments (entity_type, entity_id, user_id, content)
VALUES
('task', 3, 5, 'I recommend using a CSS Grid approach for this. It will make the responsive behavior much cleaner.'),
('task', 4, 3, 'This is blocked until the CMS decision is finalized. We need to know which framework to use.'),
('task', 7, 2, 'Invoice template looks great. Just need to add the company tax ID field.'),
('task', 8, 2, 'Let me know when the initial version is ready for review.');

-- Alerts
INSERT INTO alerts (user_id, type, message, related_entity_type, related_entity_id, is_read)
VALUES
(3, 'task_assigned', 'You have been assigned a new task: Implement responsive navigation', 'task', 3, FALSE),
(4, 'task_assigned', 'You have been assigned a new task: Implement responsive navigation', 'task', 3, FALSE),
(2, 'deadline_warning', 'Project "Client Portal" deadline is in 3 days (2025-03-01)', 'project', 3, TRUE),
(3, 'task_assigned', 'You have been assigned a new task: Offline data sync', 'task', 5, FALSE);

-- Activity logs
INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_value, new_value, ip_address)
VALUES
(1, 'create_project', 'project', 1, NULL, '{"name":"Website Redesign"}', '127.0.0.1'),
(2, 'create_task', 'task', 1, NULL, '{"title":"Design homepage wireframes"}', '127.0.0.1'),
(2, 'add_member', 'project', 1, NULL, '{"user_id":3}', '127.0.0.1'),
(3, 'update_task_status', 'task', 4, '{"status":"todo"}', '{"status":"blocked"}', '127.0.0.1');

-- Permissions for manager user
INSERT INTO roles_permissions (user_id, module_name, can_view, can_create, can_edit, can_delete)
VALUES
(2, 'projects', TRUE, TRUE, TRUE, TRUE),
(2, 'tasks', TRUE, TRUE, TRUE, TRUE),
(2, 'reports', TRUE, TRUE, FALSE, FALSE);
