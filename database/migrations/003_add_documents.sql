-- ============================================================
-- TNT Pulse - Migration 003: Add Documents Table
-- ============================================================

CREATE TABLE IF NOT EXISTS documents (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    file_name   VARCHAR(255) NOT NULL,
    file_path   VARCHAR(500) NOT NULL,
    file_size   INT UNSIGNED DEFAULT NULL,
    file_type   VARCHAR(50) DEFAULT NULL,
    project_id  INT UNSIGNED DEFAULT NULL,
    uploaded_by INT UNSIGNED DEFAULT NULL,
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_docs_project_id  FOREIGN KEY (project_id)  REFERENCES projects(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_docs_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id)   ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
