import pool from '../config/db.js';

export const getAdminDashboard = async (req, res, next) => {
  try {
    const [
      totalProjects,
      activeProjects,
      completedProjects,
      onHoldProjects,
      overdueProjects,
      totalUsers,
      totalTasks,
      overdueTasks,
      projectsByStatus,
      projectsByPriority,
      upcomingDeadlines,
      teamWorkload,
      recentActivity,
    ] = await Promise.all([
      pool.execute('SELECT COUNT(*) AS count FROM projects'),
      pool.execute("SELECT COUNT(*) AS count FROM projects WHERE status = 'in_progress'"),
      pool.execute("SELECT COUNT(*) AS count FROM projects WHERE status = 'completed'"),
      pool.execute("SELECT COUNT(*) AS count FROM projects WHERE status = 'on_hold'"),
      pool.execute("SELECT COUNT(*) AS count FROM projects WHERE deadline < CURDATE() AND status != 'completed'"),
      pool.execute("SELECT COUNT(*) AS count FROM users WHERE status = 'active'"),
      pool.execute('SELECT COUNT(*) AS count FROM tasks'),
      pool.execute("SELECT COUNT(*) AS count FROM tasks WHERE due_date < CURDATE() AND status != 'done'"),
      pool.execute(`
        SELECT status, COUNT(*) AS count
        FROM projects
        GROUP BY status
        UNION SELECT 'planning', 0
        UNION SELECT 'in_progress', 0
        UNION SELECT 'review', 0
        UNION SELECT 'completed', 0
        UNION SELECT 'on_hold', 0
      `),
      pool.execute(`
        SELECT priority, COUNT(*) AS count
        FROM projects
        GROUP BY priority
        UNION SELECT 'low', 0
        UNION SELECT 'medium', 0
        UNION SELECT 'high', 0
        UNION SELECT 'critical', 0
      `),
      pool.execute(`
        SELECT p.id, p.name, p.deadline,
               DATEDIFF(p.deadline, CURDATE()) AS days_remaining,
               (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) AS member_count
        FROM projects p
        WHERE p.deadline BETWEEN CURDATE() AND CURDATE() + INTERVAL 7 DAY
          AND p.status != 'completed'
        ORDER BY p.deadline ASC
        LIMIT 5
      `),
      pool.execute(`
        SELECT u.id, u.name, u.role,
               (SELECT COUNT(*) FROM tasks WHERE assigned_to = u.id AND status != 'done') AS active_tasks_count,
               (SELECT COUNT(*) FROM tasks WHERE assigned_to = u.id AND status = 'done') AS completed_tasks_count,
               (SELECT COUNT(*) FROM tasks WHERE assigned_to = u.id AND due_date < CURDATE() AND status != 'done') AS overdue_tasks_count
        FROM users u
        WHERE u.status = 'active'
        ORDER BY active_tasks_count DESC
      `),
      pool.execute(`
        SELECT al.action, al.entity_type, al.created_at, u.name AS user_name
        FROM activity_logs al
        LEFT JOIN users u ON u.id = al.user_id
        ORDER BY al.created_at DESC
        LIMIT 10
      `),
    ]);

    const statusAgg = {};
    for (const row of projectsByStatus[0]) {
      statusAgg[row.status] = (statusAgg[row.status] || 0) + row.count;
    }
    const allStatuses = ['planning', 'in_progress', 'review', 'completed', 'on_hold'];
    const projectsByStatusResult = allStatuses.map(status => ({ status, count: statusAgg[status] || 0 }));

    const priorityAgg = {};
    for (const row of projectsByPriority[0]) {
      priorityAgg[row.priority] = (priorityAgg[row.priority] || 0) + row.count;
    }
    const allPriorities = ['low', 'medium', 'high', 'critical'];
    const projectsByPriorityResult = allPriorities.map(priority => ({ priority, count: priorityAgg[priority] || 0 }));

    return res.status(200).json({
      success: true,
      data: {
        overview: {
          total_projects: totalProjects[0][0].count,
          active_projects: activeProjects[0][0].count,
          completed_projects: completedProjects[0][0].count,
          on_hold_projects: onHoldProjects[0][0].count,
          overdue_projects: overdueProjects[0][0].count,
          total_users: totalUsers[0][0].count,
          total_tasks: totalTasks[0][0].count,
          overdue_tasks: overdueTasks[0][0].count,
        },
        projects_by_status: projectsByStatusResult,
        projects_by_priority: projectsByPriorityResult,
        upcoming_deadlines: upcomingDeadlines[0],
        team_workload: teamWorkload[0],
        recent_activity: recentActivity[0],
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getMemberDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [
      myActiveTasks,
      myOverdueTasks,
      myCompletedTasks,
      myProjectsCount,
      tasksDueToday,
      upcomingTasks,
      myProjects,
      myRecentActivity,
    ] = await Promise.all([
      pool.execute("SELECT COUNT(*) AS count FROM tasks WHERE assigned_to = ? AND status != 'done'", [userId]),
      pool.execute("SELECT COUNT(*) AS count FROM tasks WHERE assigned_to = ? AND due_date < CURDATE() AND status != 'done'", [userId]),
      pool.execute("SELECT COUNT(*) AS count FROM tasks WHERE assigned_to = ? AND status = 'done' AND MONTH(completed_at) = MONTH(CURDATE()) AND YEAR(completed_at) = YEAR(CURDATE())", [userId]),
      pool.execute('SELECT COUNT(*) AS count FROM project_members WHERE user_id = ?', [userId]),
      pool.execute(`
        SELECT t.id, t.title, t.due_date, t.status, t.priority, p.name AS project_name
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE t.assigned_to = ? AND t.due_date = CURDATE() AND t.status != 'done'
        ORDER BY t.priority ASC
      `, [userId]),
      pool.execute(`
        SELECT t.id, t.title, t.due_date, t.status, t.priority, p.name AS project_name,
               DATEDIFF(t.due_date, CURDATE()) AS days_remaining
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE t.assigned_to = ? AND t.due_date BETWEEN CURDATE() + INTERVAL 1 DAY AND CURDATE() + INTERVAL 7 DAY
          AND t.status != 'done'
        ORDER BY t.due_date ASC
        LIMIT 10
      `, [userId]),
      pool.execute(`
        SELECT p.id, p.name, p.status, p.deadline, p.priority,
               DATEDIFF(p.deadline, CURDATE()) AS days_remaining,
               (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND assigned_to = ?) AS my_task_count,
               (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') * 100.0 /
               NULLIF((SELECT COUNT(*) FROM tasks WHERE project_id = p.id), 0) AS progress_percentage
        FROM projects p
        JOIN project_members pm ON pm.project_id = p.id
        WHERE pm.user_id = ?
        ORDER BY p.deadline ASC
      `, [userId, userId]),
      pool.execute(`
        SELECT al.action, al.entity_type, al.entity_id, al.created_at
        FROM activity_logs al
        WHERE al.user_id = ?
        ORDER BY al.created_at DESC
        LIMIT 5
      `, [userId]),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        my_stats: {
          my_active_tasks: myActiveTasks[0][0].count,
          my_overdue_tasks: myOverdueTasks[0][0].count,
          my_completed_tasks: myCompletedTasks[0][0].count,
          my_projects_count: myProjectsCount[0][0].count,
        },
        tasks_due_today: tasksDueToday[0],
        upcoming_tasks: upcomingTasks[0],
        my_projects: myProjects[0],
        my_recent_activity: myRecentActivity[0],
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getProjectDashboard = async (req, res, next) => {
  try {
    const projectId = req.params.id;

    const [projectRows] = await pool.execute('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (projectRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const isAdmin = req.user.role === 'super_admin' || req.user.role === 'manager';
    if (!isAdmin) {
      const [memberCheck] = await pool.execute(
        'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
        [projectId, req.user.id],
      );
      if (memberCheck.length === 0) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    const [
      taskStatusCounts,
      teamMembers,
      upcomingMilestones,
      recentActivity,
    ] = await Promise.all([
      pool.execute(`
        SELECT status, COUNT(*) AS count
        FROM tasks
        WHERE project_id = ?
        GROUP BY status
      `, [projectId]),
      pool.execute(`
        SELECT u.id, u.name, u.role,
               (SELECT COUNT(*) FROM tasks WHERE project_id = ? AND assigned_to = u.id) AS total_tasks,
               (SELECT COUNT(*) FROM tasks WHERE project_id = ? AND assigned_to = u.id AND status = 'done') AS completed_tasks,
               (SELECT COUNT(*) FROM tasks WHERE project_id = ? AND assigned_to = u.id AND status != 'done') AS active_tasks
        FROM project_members pm
        JOIN users u ON u.id = pm.user_id
        WHERE pm.project_id = ?
        ORDER BY active_tasks DESC
      `, [projectId, projectId, projectId, projectId]),
      pool.execute(`
        SELECT *
        FROM milestones
        WHERE project_id = ? AND status = 'pending'
        ORDER BY due_date ASC
        LIMIT 3
      `, [projectId]),
      pool.execute(`
        SELECT al.action, al.entity_type, al.entity_id, al.created_at, u.name AS user_name
        FROM activity_logs al
        LEFT JOIN users u ON u.id = al.user_id
        WHERE al.entity_type = 'project' AND al.entity_id = ?
        ORDER BY al.created_at DESC
        LIMIT 10
      `, [projectId]),
    ]);

    const project = projectRows[0];
    const [taskCounts] = await Promise.all([
      pool.execute("SELECT COUNT(*) AS count FROM tasks WHERE project_id = ? AND status = 'done'", [projectId]),
      pool.execute('SELECT COUNT(*) AS count FROM tasks WHERE project_id = ?', [projectId]),
    ]);

    const completedTaskCount = taskCounts[0][0].count;
    const totalTaskCount = taskCounts[1][0].count;

    const statusMap = { todo: 0, in_progress: 0, blocked: 0, done: 0 };
    for (const row of taskStatusCounts[0]) {
      statusMap[row.status] = row.count;
    }

    const daysElapsed = project.start_date
      ? Math.max(0, Math.floor((new Date() - new Date(project.start_date)) / (1000 * 60 * 60 * 24)))
      : 0;

    const totalDuration = project.start_date && project.deadline
      ? Math.max(1, Math.floor((new Date(project.deadline) - new Date(project.start_date)) / (1000 * 60 * 60 * 24)))
      : 1;

    const daysRemaining = project.deadline
      ? Math.max(0, Math.floor((new Date(project.deadline) - new Date()) / (1000 * 60 * 60 * 24)))
      : null;

    const expectedProgress = Math.min(100, (daysElapsed / totalDuration) * 100);
    const actualProgress = totalTaskCount > 0 ? (completedTaskCount / totalTaskCount) * 100 : 0;

    const enrichedMembers = teamMembers[0].map(m => ({
      ...m,
      completion_rate: m.total_tasks > 0 ? Math.round((m.completed_tasks / m.total_tasks) * 100) : 0,
    }));

    return res.status(200).json({
      success: true,
      data: {
        overview: {
          ...project,
          progress_percentage: Math.round(actualProgress),
          days_remaining: daysRemaining,
          total_tasks: totalTaskCount,
          completed_tasks: completedTaskCount,
          blocked_tasks: statusMap.blocked,
          overdue_tasks: statusMap.todo + statusMap.in_progress,
        },
        tasks_by_status: statusMap,
        timeline_health: {
          is_on_track: actualProgress >= expectedProgress,
          expected_progress: Math.round(expectedProgress),
          actual_progress: Math.round(actualProgress),
          days_elapsed: daysElapsed,
          total_duration_days: totalDuration,
          days_remaining: daysRemaining,
        },
        team: enrichedMembers,
        upcoming_milestones: upcomingMilestones[0],
        recent_activity: recentActivity[0],
      },
    });
  } catch (err) {
    next(err);
  }
};
