CREATE TABLE IF NOT EXISTS subscriptions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category ENUM(
    'domain', 'hosting', 'api_service',
    'ssl_certificate', 'software_license',
    'database', 'email_service', 'other'
  ) NOT NULL,
  provider VARCHAR(255),
  description TEXT,
  cost DECIMAL(10,2) DEFAULT 0,
  billing_cycle ENUM(
    'monthly', 'quarterly', 
    'yearly', 'one_time'
  ) DEFAULT 'monthly',
  currency VARCHAR(10) DEFAULT 'USD',
  start_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  alert_days_before INT DEFAULT 7,
  auto_renew BOOLEAN DEFAULT false,
  status ENUM(
    'active', 'expired', 'cancelled'
  ) DEFAULT 'active',
  account_email VARCHAR(255),
  notes TEXT,
  created_by INT UNSIGNED,
  FOREIGN KEY (created_by) 
    REFERENCES users(id) 
    ON DELETE SET NULL,
  created_at TIMESTAMP 
    DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP 
    DEFAULT CURRENT_TIMESTAMP 
    ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscription_projects (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subscription_id INT UNSIGNED NOT NULL,
  project_id INT UNSIGNED NOT NULL,
  linked_at TIMESTAMP 
    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subscription_id) 
    REFERENCES subscriptions(id) 
    ON DELETE CASCADE,
  FOREIGN KEY (project_id) 
    REFERENCES projects(id) 
    ON DELETE CASCADE,
  UNIQUE KEY unique_link (subscription_id, project_id)
);
