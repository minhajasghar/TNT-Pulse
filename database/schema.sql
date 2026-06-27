-- ============================================================
-- TNT Pulse - Database Schema
-- Engine: MySQL / InnoDB
-- ============================================================

-- 1. users: Stores all team members (super admins, managers, developers, designers, viewers)
CREATE TABLE users (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    email       VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role        ENUM('super_admin','manager','developer','designer','viewer') NOT NULL DEFAULT 'developer',
    status      ENUM('active','suspended') NOT NULL DEFAULT 'active',
    last_seen   DATETIME DEFAULT NULL,
    created_by  INT UNSIGNED DEFAULT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_users_email (email),
    CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. roles_permissions: Granular module-level permissions per user (projects, tasks, reports, etc.)
CREATE TABLE roles_permissions (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED NOT NULL,
    module_name VARCHAR(100) NOT NULL,
    can_view    BOOLEAN NOT NULL DEFAULT FALSE,
    can_create  BOOLEAN NOT NULL DEFAULT FALSE,
    can_edit    BOOLEAN NOT NULL DEFAULT FALSE,
    can_delete  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_rp_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. projects: All company projects with status, priority, client info, and deadlines
CREATE TABLE projects (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    client_name VARCHAR(255) DEFAULT NULL,
    start_date  DATE DEFAULT NULL,
    deadline    DATE DEFAULT NULL,
    status      ENUM('planning','in_progress','review','completed','on_hold') NOT NULL DEFAULT 'planning',
    priority    ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
    created_by  INT UNSIGNED DEFAULT NULL,
    deleted_by  INT UNSIGNED DEFAULT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at  DATETIME DEFAULT NULL,
    CONSTRAINT fk_projects_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_projects_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. project_members: Which users are assigned to which project
CREATE TABLE project_members (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    project_id  INT UNSIGNED NOT NULL,
    user_id     INT UNSIGNED NOT NULL,
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pm_project_id FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_pm_user_id    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. tasks: Tasks inside each project with assignment, priority, estimation, and blocking support
CREATE TABLE tasks (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    project_id      INT UNSIGNED NOT NULL,
    title           VARCHAR(255) NOT NULL,
    description     TEXT DEFAULT NULL,
    assigned_to     INT UNSIGNED DEFAULT NULL,
    created_by      INT UNSIGNED DEFAULT NULL,
    status          ENUM('todo','in_progress','blocked','done') NOT NULL DEFAULT 'todo',
    priority        ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
    estimated_hours DECIMAL(8,2) DEFAULT NULL,
    due_date        DATE DEFAULT NULL,
    blocked_reason  TEXT DEFAULT NULL,
    completed_at    DATETIME DEFAULT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tasks_project_id  (project_id),
    INDEX idx_tasks_assigned_to (assigned_to),
    CONSTRAINT fk_tasks_project_id  FOREIGN KEY (project_id)   REFERENCES projects(id) ON DELETE CASCADE   ON UPDATE CASCADE,
    CONSTRAINT fk_tasks_assigned_to FOREIGN KEY (assigned_to)  REFERENCES users(id)    ON DELETE SET NULL  ON UPDATE CASCADE,
    CONSTRAINT fk_tasks_created_by  FOREIGN KEY (created_by)   REFERENCES users(id)    ON DELETE SET NULL  ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. milestones: Major checkpoints per project
CREATE TABLE milestones (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    project_id  INT UNSIGNED NOT NULL,
    title       VARCHAR(255) NOT NULL,
    due_date    DATE DEFAULT NULL,
    status      ENUM('pending','completed') NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_milestones_project_id FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. requirements: Project requirements list (functional, technical, or client notes)
CREATE TABLE requirements (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    project_id      INT UNSIGNED NOT NULL,
    title           VARCHAR(255) NOT NULL,
    description     TEXT DEFAULT NULL,
    type            ENUM('functional','technical','client_note') NOT NULL DEFAULT 'functional',
    approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    created_by      INT UNSIGNED DEFAULT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_req_project_id FOREIGN KEY (project_id)  REFERENCES users(id) ON DELETE CASCADE  ON UPDATE CASCADE,
    CONSTRAINT fk_req_created_by FOREIGN KEY (created_by)  REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. comments: Polymorphic comments on tasks or projects
CREATE TABLE comments (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    entity_type ENUM('task','project') NOT NULL,
    entity_id   INT UNSIGNED NOT NULL,
    user_id     INT UNSIGNED DEFAULT NULL,
    content     TEXT NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_comments_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. attachments: Files attached to projects, tasks, requirements, or comments
CREATE TABLE attachments (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    entity_type ENUM('project','task','requirement','comment') NOT NULL,
    entity_id   INT UNSIGNED NOT NULL,
    file_name   VARCHAR(255) NOT NULL,
    file_path   VARCHAR(500) NOT NULL,
    uploaded_by INT UNSIGNED DEFAULT NULL,
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_attachments_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. alerts: Notification log for deadline warnings, task overdues, assignments, etc.
CREATE TABLE alerts (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id             INT UNSIGNED NOT NULL,
    type                VARCHAR(50) NOT NULL,
    message             TEXT NOT NULL,
    is_read             BOOLEAN NOT NULL DEFAULT FALSE,
    related_entity_type VARCHAR(50) DEFAULT NULL,
    related_entity_id   INT UNSIGNED DEFAULT NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_alerts_user_id (user_id),
    CONSTRAINT fk_alerts_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. activity_logs: Full audit trail of all user actions across the system
CREATE TABLE activity_logs (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED DEFAULT NULL,
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id   INT UNSIGNED DEFAULT NULL,
    old_value   TEXT DEFAULT NULL,
    new_value   TEXT DEFAULT NULL,
    ip_address  VARCHAR(45) DEFAULT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_al_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. notification_preferences: Per-user alert channel and deadline reminder settings
CREATE TABLE notification_preferences (
    id                         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id                    INT UNSIGNED NOT NULL,
    email_enabled              BOOLEAN NOT NULL DEFAULT TRUE,
    in_app_enabled             BOOLEAN NOT NULL DEFAULT TRUE,
    alert_days_before_deadline INT NOT NULL DEFAULT 3,
    created_at                 TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                 TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_np_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
