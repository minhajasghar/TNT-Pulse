import pool from '../config/db.js';

export const getAllRules = async (req, res) => {
  try {
    const [rules] = await pool.execute(
      'SELECT * FROM alert_escalation_rules ORDER BY display_order ASC'
    );
    res.json({ success: true, rules });
  } catch (error) {
    console.error('Error fetching escalation rules:', error);
    res.status(500).json({ success: false, message: 'Server error fetching escalation rules' });
  }
};

export const createRule = async (req, res) => {
  try {
    const { rule_name, trigger_type, threshold_value, frequency, applies_to } = req.body;

    if (!rule_name || !trigger_type || threshold_value === undefined || !frequency) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (trigger_type === 'percentage') {
      const val = Number(threshold_value);
      if (val < 1 || val > 100) {
        return res.status(400).json({ success: false, message: 'Percentage threshold must be between 1 and 100' });
      }
    } else if (trigger_type === 'fixed_days') {
      const val = Number(threshold_value);
      if (val < 0) {
        return res.status(400).json({ success: false, message: 'Fixed days threshold must be >= 0' });
      }
    }

    const [maxOrder] = await pool.execute('SELECT MAX(display_order) as max_order FROM alert_escalation_rules');
    const nextOrder = (maxOrder[0]?.max_order ?? -1) + 1;

    const [result] = await pool.execute(
      `INSERT INTO alert_escalation_rules (rule_name, trigger_type, threshold_value, frequency, applies_to, display_order, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [rule_name, trigger_type, threshold_value, frequency, applies_to || 'both', nextOrder, req.user.id]
    );

    const [newRule] = await pool.execute('SELECT * FROM alert_escalation_rules WHERE id = ?', [result.insertId]);

    res.status(201).json({ success: true, rule: newRule[0] });
  } catch (error) {
    console.error('Error creating escalation rule:', error);
    res.status(500).json({ success: false, message: 'Server error creating escalation rule' });
  }
};

export const updateRule = async (req, res) => {
  try {
    const { id } = req.params;
    const { rule_name, trigger_type, threshold_value, frequency, applies_to, is_active, display_order } = req.body;

    const [existing] = await pool.execute('SELECT * FROM alert_escalation_rules WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Rule not found' });
    }

    const updatableFields = [];
    const values = [];

    if (rule_name !== undefined) { updatableFields.push('rule_name = ?'); values.push(rule_name); }
    if (trigger_type !== undefined) { updatableFields.push('trigger_type = ?'); values.push(trigger_type); }
    if (threshold_value !== undefined) {
      const effectiveType = trigger_type || existing[0].trigger_type;
      if (effectiveType === 'percentage') {
        const val = Number(threshold_value);
        if (val < 1 || val > 100) {
          return res.status(400).json({ success: false, message: 'Percentage must be between 1 and 100' });
        }
      } else if (effectiveType === 'fixed_days') {
        const val = Number(threshold_value);
        if (val < 0) {
          return res.status(400).json({ success: false, message: 'Fixed days must be >= 0' });
        }
      }
      updatableFields.push('threshold_value = ?');
      values.push(threshold_value);
    }
    if (frequency !== undefined) { updatableFields.push('frequency = ?'); values.push(frequency); }
    if (applies_to !== undefined) { updatableFields.push('applies_to = ?'); values.push(applies_to); }
    if (is_active !== undefined) { updatableFields.push('is_active = ?'); values.push(is_active ? 1 : 0); }
    if (display_order !== undefined) { updatableFields.push('display_order = ?'); values.push(display_order); }

    if (updatableFields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    values.push(id);
    await pool.execute(
      `UPDATE alert_escalation_rules SET ${updatableFields.join(', ')} WHERE id = ?`,
      values
    );

    const [updated] = await pool.execute('SELECT * FROM alert_escalation_rules WHERE id = ?', [id]);

    res.json({ success: true, rule: updated[0] });
  } catch (error) {
    console.error('Error updating escalation rule:', error);
    res.status(500).json({ success: false, message: 'Server error updating escalation rule' });
  }
};

export const deleteRule = async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.execute('SELECT * FROM alert_escalation_rules WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Rule not found' });
    }
    await pool.execute('DELETE FROM alert_escalation_rules WHERE id = ?', [id]);
    res.json({ success: true, message: 'Rule deleted successfully' });
  } catch (error) {
    console.error('Error deleting escalation rule:', error);
    res.status(500).json({ success: false, message: 'Server error deleting escalation rule' });
  }
};

export const toggleRule = async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.execute('SELECT * FROM alert_escalation_rules WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Rule not found' });
    }
    const newStatus = existing[0].is_active ? 0 : 1;
    await pool.execute('UPDATE alert_escalation_rules SET is_active = ? WHERE id = ?', [newStatus, id]);
    const [updated] = await pool.execute('SELECT * FROM alert_escalation_rules WHERE id = ?', [id]);
    res.json({ success: true, rule: updated[0] });
  } catch (error) {
    console.error('Error toggling escalation rule:', error);
    res.status(500).json({ success: false, message: 'Server error toggling escalation rule' });
  }
};
