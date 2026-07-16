import pool from '../config/db.js';

export const getProjectReport = async (req, res, next) => {
  try {
    const { from, to, project_id } = req.query;
    const dateFilter = from && to ? `AND p.created_at BETWEEN ? AND ?` : '';
    const dateParams = from && to ? [from, `${to} 23:59:59`] : [];
    const projectFilter = project_id ? 'AND p.id = ?' : '';
    const projectParams = project_id ? [project_id] : [];

    const params = [...dateParams, ...projectParams];

    const [totalResult] = await pool.execute(
      `SELECT COUNT(*) AS count FROM projects p WHERE 1=1 AND p.deleted_at IS NULL ${dateFilter} ${projectFilter}`,
      params,
    );

    const [completedResult] = await pool.execute(
      `SELECT COUNT(*) AS count FROM projects p WHERE p.status = 'completed' AND p.deleted_at IS NULL ${dateFilter} ${projectFilter}`,
      params,
    );

    const [onHoldResult] = await pool.execute(
      `SELECT COUNT(*) AS count FROM projects p WHERE p.status = 'on_hold' AND p.deleted_at IS NULL ${dateFilter} ${projectFilter}`,
      params,
    );

    const [avgTimeResult] = await pool.execute(
      `SELECT AVG(DATEDIFF(COALESCE(p.updated_at, p.created_at), p.created_at)) AS avg_days
       FROM projects p WHERE p.status = 'completed' AND p.deleted_at IS NULL ${dateFilter} ${projectFilter}`,
      params,
    );

    const [statusBreakdown] = await pool.execute(
      `SELECT p.status, COUNT(*) AS count
       FROM projects p WHERE 1=1 AND p.deleted_at IS NULL ${dateFilter} ${projectFilter}
       GROUP BY p.status`,
      params,
    );

    const [projectsList] = await pool.execute(
      `SELECT p.*,
              (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) AS team_size,
              CASE WHEN p.status = 'completed' THEN 100.0
              ELSE COALESCE(
                (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') * 100.0 /
                NULLIF((SELECT COUNT(*) FROM tasks WHERE project_id = p.id), 0), 0
              ) END AS progress_percentage
       FROM projects p
       WHERE 1=1 AND p.deleted_at IS NULL ${dateFilter} ${projectFilter}
       ORDER BY p.created_at DESC`,
      params,
    );

    return res.status(200).json({
      success: true,
      data: {
        total_projects: totalResult[0].count,
        completed_projects: completedResult[0].count,
        on_hold_projects: onHoldResult[0].count,
        avg_completion_days: Math.round((avgTimeResult[0].avg_days || 0) * 10) / 10,
        status_breakdown: statusBreakdown,
        projects: projectsList,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getTeamReport = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const dateFilterTask = from && to ? 'AND t.created_at BETWEEN ? AND ?' : '';
    const dateFilterDone = from && to ? 'AND t.completed_at BETWEEN ? AND ?' : '';
    const dateParams = from && to ? [from, `${to} 23:59:59`] : [];

    const reportParams = [...dateParams, ...dateParams, ...dateParams, ...dateParams];

    const projectJoin = 'JOIN projects p ON t.project_id = p.id AND p.deleted_at IS NULL';

    const [members] = await pool.execute(
      `SELECT u.id, u.name, u.role,
              (SELECT COUNT(*) FROM tasks t ${projectJoin} WHERE t.assigned_to = u.id ${dateFilterTask}) AS tasks_assigned,
              (SELECT COUNT(*) FROM tasks t ${projectJoin} WHERE t.assigned_to = u.id AND t.status = 'done' ${dateFilterDone}) AS tasks_completed,
              (SELECT COUNT(*) FROM tasks t ${projectJoin} WHERE t.assigned_to = u.id AND t.due_date < CURDATE() AND t.status != 'done') AS overdue_tasks,
              (SELECT COUNT(*) FROM tasks t ${projectJoin} WHERE t.assigned_to = u.id AND t.status = 'done' AND t.completed_at <= t.due_date ${dateFilterDone}) AS completed_on_time,
              (SELECT AVG(DATEDIFF(t.completed_at, t.created_at)) FROM tasks t ${projectJoin} WHERE t.assigned_to = u.id AND t.status = 'done' ${dateFilterDone}) AS avg_completion_days
       FROM users u
       WHERE u.status = 'active'
       ORDER BY u.name ASC`,
      reportParams,
    );

    const result = members.map((m) => ({
      ...m,
      on_time_rate: m.tasks_completed > 0 ? Math.round((m.completed_on_time / m.tasks_completed) * 100) : 0,
      avg_completion_days: m.avg_completion_days ? Math.round(m.avg_completion_days * 10) / 10 : null,
    }));

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const getTaskReport = async (req, res, next) => {
  try {
    const { from, to, project_id } = req.query;
    const dateFilter = from && to ? 'AND t.created_at BETWEEN ? AND ?' : '';
    const dateDoneFilter = from && to ? 'AND t.completed_at BETWEEN ? AND ?' : '';
    const dateParams = from && to ? [from, `${to} 23:59:59`] : [];
    const projectFilter = project_id ? 'AND t.project_id = ?' : '';
    const projectParams = project_id ? [project_id] : [];

    const base = [...dateParams, ...projectParams];
    const baseDone = [...dateParams, ...projectParams];

    const projectJoin = 'JOIN projects p ON t.project_id = p.id AND p.deleted_at IS NULL';

    const [totalResult] = await pool.execute(
      `SELECT COUNT(*) AS count FROM tasks t ${projectJoin} WHERE 1=1 ${dateFilter} ${projectFilter}`,
      base,
    );

    const [onTimeResult] = await pool.execute(
      `SELECT COUNT(*) AS count FROM tasks t ${projectJoin} WHERE t.status = 'done' AND t.completed_at <= t.due_date ${dateDoneFilter} ${projectFilter}`,
      baseDone,
    );

    const [lateResult] = await pool.execute(
      `SELECT COUNT(*) AS count FROM tasks t ${projectJoin} WHERE t.status = 'done' AND t.completed_at > t.due_date ${dateDoneFilter} ${projectFilter}`,
      baseDone,
    );

    const [overdueResult] = await pool.execute(
      `SELECT COUNT(*) AS count FROM tasks t ${projectJoin} WHERE t.due_date < CURDATE() AND t.status != 'done' ${dateFilter} ${projectFilter}`,
      base,
    );

    const [avgTimeResult] = await pool.execute(
      `SELECT AVG(DATEDIFF(t.completed_at, t.created_at)) AS avg_days
       FROM tasks t ${projectJoin} WHERE t.status = 'done' ${dateDoneFilter} ${projectFilter}`,
      baseDone,
    );

    const [priorityBreakdown] = await pool.execute(
      `SELECT t.priority, COUNT(*) AS count
       FROM tasks t ${projectJoin} WHERE 1=1 ${dateFilter} ${projectFilter}
       GROUP BY t.priority`,
      base,
    );

    const [statusBreakdown] = await pool.execute(
      `SELECT t.status, COUNT(*) AS count
       FROM tasks t ${projectJoin} WHERE 1=1 ${dateFilter} ${projectFilter}
       GROUP BY t.status`,
      base,
    );

    return res.status(200).json({
      success: true,
      data: {
        total_tasks: totalResult[0].count,
        completed_on_time: onTimeResult[0].count,
        completed_late: lateResult[0].count,
        still_overdue: overdueResult[0].count,
        avg_completion_days: avgTimeResult[0].avg_days ? Math.round(avgTimeResult[0].avg_days * 10) / 10 : null,
        priority_breakdown: priorityBreakdown,
        status_breakdown: statusBreakdown,
      },
    });
  } catch (err) {
    next(err);
  }
};
