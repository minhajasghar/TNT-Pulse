import nodemailer from 'nodemailer';

const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

export const sendEmail = async ({ to, subject, html }) => {
  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'TNT Innovations <noreply@tntinnovations.com>',
      to,
      subject,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`Email send failed: ${err.message}`);
    return { success: false, error: err.message };
  }
};

export const sendDeadlineWarningEmail = async ({ to, name, projectName, deadline, daysRemaining, isAdminAlert, memberNames }) => {
  const formattedDate = new Date(deadline).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const isUrgent = daysRemaining <= 2;
  const urgencyLabel = isUrgent ? 'URGENT' : 'Reminder';
  const badgeColor = isUrgent ? '#ef4444' : '#f59e0b';
  const badgeBg = isUrgent ? '#fef2f2' : '#fffbeb';

  let extraContent = '';
  let subject = '';

  if (isAdminAlert) {
    subject = `\uD83D\uDD14 ADMIN ALERT: ${projectName} deadline in ${daysRemaining} days`;
    extraContent = `
      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h3 style="font-size: 15px; font-weight: 700; color: #dc2626; margin: 0 0 12px 0;">Team Members on this project:</h3>
        <p style="font-size: 14px; color: #1e293b; line-height: 1.6; margin: 0;">${memberNames || 'No members assigned'}</p>
      </div>
      <div style="background-color: #fef2f2; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="font-size: 13px; color: #dc2626; margin: 0; line-height: 1.5; font-weight: 600;">
          Please follow up with your team to ensure this project stays on track.
        </p>
      </div>
    `;
  } else {
    subject = `\u26A0\uFE0F [${urgencyLabel}] Project ${projectName} deadline in ${daysRemaining} days`;
    extraContent = `
      <div style="background-color: #eef2ff; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="font-size: 13px; color: #4338ca; margin: 0; line-height: 1.5;">
          ${isUrgent ? 'This deadline has passed or is imminent. Immediate action is required to avoid project delays.' : 'Please ensure the project is on track to meet the deadline. Review your task list and escalate any blockers.'}
        </p>
      </div>
    `;
  }

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 24px; background-color: #f8fafc;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="font-size: 28px; font-weight: 800; color: #6366f1; letter-spacing: -0.5px;">TNT <span style="color: #1e293b;">Innovations</span></div>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
        <div style="display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; background-color: ${badgeBg}; color: ${badgeColor}; margin-bottom: 20px;">${urgencyLabel}</div>
        <h1 style="font-size: 20px; font-weight: 700; color: #1e293b; margin: 0 0 8px 0;">Hello ${name},</h1>
        <p style="font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">
          ${isAdminAlert ? 'As an administrator, you are being notified that the following project deadline is approaching.' : `This is a deadline warning for project <strong style="color: #1e293b;">${projectName}</strong>.`}
        </p>
        <div style="background-color: #f1f5f9; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <div style="font-size: 48px; font-weight: 800; color: ${badgeColor}; line-height: 1; margin-bottom: 4px;">${daysRemaining}</div>
          <div style="font-size: 14px; color: #64748b; font-weight: 500;">days remaining</div>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="padding: 8px 0; font-size: 14px; color: #64748b;">Project</td>
            <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #1e293b; text-align: right;">${projectName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-size: 14px; color: #64748b;">Deadline</td>
            <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #1e293b; text-align: right;">${formattedDate}</td>
          </tr>
        </table>
        ${extraContent}
      </div>
      <div style="text-align: center; margin-top: 24px; font-size: 12px; color: #94a3b8;">
        <p style="margin: 0 0 4px 0;">TNT Innovations</p>
        <p style="margin: 0;">TNT Innovations</p>
      </div>
    </div>
  `;

  return sendEmail({ to, subject, html });
};

export const sendTaskAssignedEmail = async ({ to, name, taskTitle, projectName, dueDate, assignedBy }) => {
  const formattedDate = dueDate
    ? new Date(dueDate).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'No deadline set';

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 24px; background-color: #f8fafc;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="font-size: 28px; font-weight: 800; color: #6366f1; letter-spacing: -0.5px;">TNT <span style="color: #1e293b;">Innovations</span></div>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
        <div style="font-size: 36px; margin-bottom: 12px; text-align: center;">📋</div>
        <h1 style="font-size: 20px; font-weight: 700; color: #1e293b; margin: 0 0 8px 0; text-align: center;">New Task Assigned</h1>
        <p style="font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">Hi ${name}, you have been assigned a new task.</p>
        <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; font-size: 14px; color: #64748b;">Task</td>
              <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #1e293b; text-align: right;">${taskTitle}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 14px; color: #64748b;">Project</td>
              <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #6366f1; text-align: right;">${projectName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 14px; color: #64748b;">Due Date</td>
              <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #1e293b; text-align: right;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 14px; color: #64748b;">Assigned by</td>
              <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #1e293b; text-align: right;">${assignedBy}</td>
            </tr>
          </table>
        </div>
        <div style="text-align: center;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/tasks" style="display: inline-block; background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;">View Task</a>
        </div>
      </div>
      <div style="text-align: center; margin-top: 24px; font-size: 12px; color: #94a3b8;">
        <p style="margin: 0 0 4px 0;">TNT Innovations</p>
        <p style="margin: 0;">TNT Innovations</p>
      </div>
    </div>
  `;

  const subject = `\uD83D\uDCCB New Task Assigned: ${taskTitle}`;

  return sendEmail({ to, subject, html });
};

export const sendTaskOverdueEmail = async ({ to, name, taskTitle, projectName, dueDate }) => {
  const formattedDate = new Date(dueDate).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 24px; background-color: #f8fafc;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="font-size: 28px; font-weight: 800; color: #6366f1; letter-spacing: -0.5px;">TNT <span style="color: #1e293b;">Innovations</span></div>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border-top: 4px solid #ef4444;">
        <div style="font-size: 36px; margin-bottom: 12px; text-align: center;">🚨</div>
        <h1 style="font-size: 20px; font-weight: 700; color: #dc2626; margin: 0 0 8px 0; text-align: center;">Task Overdue</h1>
        <p style="font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">Hi ${name}, the following task is now past its due date.</p>
        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; font-size: 14px; color: #64748b;">Task</td>
              <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #dc2626; text-align: right;">${taskTitle}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 14px; color: #64748b;">Project</td>
              <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #6366f1; text-align: right;">${projectName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 14px; color: #64748b;">Due Date</td>
              <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #dc2626; text-align: right;">${formattedDate}</td>
            </tr>
          </table>
        </div>
        <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">Please update the task status or escalate with a blocked reason so management can assist.</p>
        <div style="text-align: center;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/tasks" style="display: inline-block; background-color: #ef4444; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;">View Overdue Task</a>
        </div>
      </div>
      <div style="text-align: center; margin-top: 24px; font-size: 12px; color: #94a3b8;">
        <p style="margin: 0 0 4px 0;">TNT Innovations</p>
        <p style="margin: 0;">TNT Innovations</p>
      </div>
    </div>
  `;

  const subject = `\uD83D\uDEA8 Overdue Task: ${taskTitle}`;

  return sendEmail({ to, subject, html });
};

export const sendAnnouncementEmail = async ({ to, name, announcementTitle, announcementContent, priority, postedBy }) => {
  const priorityBadges = {
    normal: { label: 'Normal', color: '#6b7280', bg: '#f3f4f6' },
    important: { label: 'Important', color: '#3b82f6', bg: '#eff6ff' },
    urgent: { label: 'Urgent', color: '#ef4444', bg: '#fef2f2' },
  };
  const badge = priorityBadges[priority] || priorityBadges.normal;

  const prefixMap = {
    normal: '\uD83D\uDCCB',
    important: '\uD83D\uDCE2 Important:',
    urgent: '\uD83D\uDEA8 URGENT:',
  };
  const subjectPrefix = prefixMap[priority] || prefixMap.normal;

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 24px; background-color: #f8fafc;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="font-size: 28px; font-weight: 800; color: #6366f1; letter-spacing: -0.5px;">TNT <span style="color: #1e293b;">Innovations</span></div>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
        <div style="display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; background-color: ${badge.bg}; color: ${badge.color}; margin-bottom: 20px;">${badge.label}</div>
        <h1 style="font-size: 20px; font-weight: 700; color: #1e293b; margin: 0 0 8px 0;">Hello ${name},</h1>
        <h2 style="font-size: 22px; font-weight: 800; color: #1e293b; margin: 16px 0 12px 0; line-height: 1.3;">${announcementTitle}</h2>
        <p style="font-size: 15px; color: #475569; line-height: 1.7; margin: 0 0 24px 0; white-space: pre-wrap;">${announcementContent}</p>
        <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 16px;">
          <p style="font-size: 13px; color: #94a3b8; margin: 0;">Posted by: <strong style="color: #64748b;">${postedBy}</strong></p>
        </div>
      </div>
      <div style="text-align: center; margin-top: 24px; font-size: 12px; color: #94a3b8;">
        <p style="margin: 0 0 4px 0;">TNT Innovations</p>
        <p style="margin: 0;">TNT Innovations</p>
      </div>
    </div>
  `;

  const subject = `${subjectPrefix} ${announcementTitle} — TNT Innovations`;

  return sendEmail({ to, subject, html });
};

export const sendWelcomeEmail = async ({ to, name, role, temporaryPassword }) => {
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 24px; background-color: #f8fafc;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="font-size: 28px; font-weight: 800; color: #6366f1; letter-spacing: -0.5px;">TNT <span style="color: #1e293b;">Innovations</span></div>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
        <h1 style="font-size: 22px; font-weight: 700; color: #1e293b; margin: 0 0 12px 0; text-align: center;">Welcome to TNT Innovations!</h1>
        <p style="font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">Hi ${name}, your account has been created. Here are your login details.</p>
        <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-size: 13px; color: #64748b; width: 40%;">Role</td>
              <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #6366f1; text-align: right;">${role.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-size: 13px; color: #64748b;">Email</td>
              <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #1e293b; text-align: right;">${to}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-size: 13px; color: #64748b;">Temporary Password</td>
              <td style="padding: 8px 0; font-size: 14px; font-weight: 700; color: #1e293b; text-align: right; font-family: 'Courier New', monospace; letter-spacing: 1px; background-color: #e2e8f0; border-radius: 4px; padding: 4px 8px;">${temporaryPassword}</td>
            </tr>
          </table>
        </div>
        <div style="background-color: #eef2ff; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <p style="font-size: 13px; color: #4338ca; margin: 0; line-height: 1.5;">
            <strong>Important:</strong> For security reasons, please change your password after your first login. You can do this from the Settings page.
          </p>
        </div>
        <div style="text-align: center;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/login" style="display: inline-block; background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;">Login to TNT Innovations</a>
        </div>
      </div>
      <div style="text-align: center; margin-top: 24px; font-size: 12px; color: #94a3b8;">
        <p style="margin: 0 0 4px 0;">TNT Innovations</p>
        <p style="margin: 0;">TNT Innovations</p>
      </div>
    </div>
  `;

  const subject = 'Welcome to TNT Innovations \u2014 Your Account Details';

  return sendEmail({ to, subject, html });
};

export const sendEscalationEmail = async ({ to, name, entityName, entityType, ruleName, daysRemaining, isUrgent, isAdminAlert, memberNames }) => {
  const badgeColor = isUrgent ? '#ef4444' : '#6366f1';
  const badgeBg = isUrgent ? '#fef2f2' : '#eef2ff';
  const badgeLabel = isUrgent ? '🚨 URGENT' : '📋 Notice';

  const daysText = daysRemaining < 0
    ? `<span style="color: #ef4444; font-weight: 700;">${Math.abs(daysRemaining)} day(s) overdue</span>`
    : daysRemaining === 0
    ? `<span style="color: #ef4444; font-weight: 700;">Due today</span>`
    : `<span style="font-weight: 700;">${daysRemaining} day(s) remaining</span>`;

  const subject = isUrgent
    ? `🚨 ${entityType}: ${entityName} needs attention`
    : `📋 ${entityType}: ${entityName} — ${ruleName}`;

  let adminSection = '';
  if (isAdminAlert && memberNames) {
    adminSection = `
      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h3 style="font-size: 15px; font-weight: 700; color: #dc2626; margin: 0 0 12px 0;">Team Members:</h3>
        <p style="font-size: 14px; color: #1e293b; line-height: 1.6; margin: 0;">${memberNames || 'No members assigned'}</p>
      </div>
    `;
  }

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 24px; background-color: #f8fafc;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="font-size: 28px; font-weight: 800; color: #6366f1; letter-spacing: -0.5px;">TNT <span style="color: #1e293b;">Innovations</span></div>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); ${isUrgent ? 'border-top: 4px solid #ef4444;' : ''}">
        <div style="display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; background-color: ${badgeBg}; color: ${badgeColor}; margin-bottom: 20px;">${badgeLabel}</div>
        <h1 style="font-size: 20px; font-weight: 700; color: #1e293b; margin: 0 0 8px 0;">Hello ${name},</h1>
        <p style="font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">
          ${isAdminAlert ? 'As an administrator, you are being notified of the following:' : 'This is an automated escalation alert.'}
        </p>
        <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: #64748b;">${entityType}</td>
              <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #1e293b; text-align: right;">${entityName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: #64748b;">Triggered by</td>
              <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #6366f1; text-align: right;">${ruleName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: #64748b;">Status</td>
              <td style="padding: 8px 0; font-size: 14px; text-align: right;">${daysText}</td>
            </tr>
          </table>
        </div>
        ${adminSection}
      </div>
      <div style="text-align: center; margin-top: 24px; font-size: 12px; color: #94a3b8;">
        <p style="margin: 0 0 4px 0;">TNT Innovations</p>
        <p style="margin: 0;">TNT Innovations</p>
      </div>
    </div>
  `;

  return sendEmail({ to, subject, html });
};

export const sendSubscriptionAlertEmail = async ({ to, name, subscriptionName, category, provider, expiryDate, daysRemaining, cost, billingCycle }) => {
  const formattedDate = new Date(expiryDate).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const isExpired = daysRemaining < 0;
  const isUrgent = daysRemaining >= 0 && daysRemaining <= 3;
  
  let urgencyLabel = 'Reminder';
  let badgeColor = '#f59e0b';
  let badgeBg = '#fffbeb';
  let subjectPrefix = '⏰ Reminder:';
  let subjectDaysText = `expires in ${daysRemaining} days`;

  if (isExpired) {
    urgencyLabel = 'EXPIRED';
    badgeColor = '#ef4444';
    badgeBg = '#fef2f2';
    subjectPrefix = '⚠️ EXPIRED:';
    subjectDaysText = `expired ${Math.abs(daysRemaining)} days ago`;
  } else if (isUrgent) {
    urgencyLabel = 'URGENT';
    badgeColor = '#ef4444';
    badgeBg = '#fef2f2';
    subjectPrefix = '🚨 URGENT:';
    subjectDaysText = `expires soon (${daysRemaining} days)`;
  }

  const subject = `${subjectPrefix} ${subscriptionName} ${subjectDaysText}`;

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 24px; background-color: #f8fafc;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="font-size: 28px; font-weight: 800; color: #6366f1; letter-spacing: -0.5px;">TNT <span style="color: #1e293b;">Innovations</span></div>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); \${isExpired || isUrgent ? 'border-top: 4px solid #ef4444;' : ''}">
        <div style="display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; background-color: \${badgeBg}; color: \${badgeColor}; margin-bottom: 20px;">\${urgencyLabel}</div>
        <h1 style="font-size: 20px; font-weight: 700; color: #1e293b; margin: 0 0 8px 0;">Hello \${name},</h1>
        <p style="font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">
          This is an alert regarding your subscription for <strong style="color: #1e293b;">\${subscriptionName}</strong>.
        </p>
        <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: #64748b;">Subscription</td>
              <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #1e293b; text-align: right;">\${subscriptionName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: #64748b;">Category</td>
              <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #1e293b; text-align: right;">\${category}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: #64748b;">Provider</td>
              <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #1e293b; text-align: right;">\${provider || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: #64748b;">Cost</td>
              <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #1e293b; text-align: right;">\${cost} (\${billingCycle})</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: #64748b;">Expiry Date</td>
              <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: \${badgeColor}; text-align: right;">\${formattedDate}</td>
            </tr>
          </table>
        </div>
        <div style="text-align: center;">
          <a href="\${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscriptions" style="display: inline-block; background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;">Please renew or update this subscription in TNT Pulse</a>
        </div>
      </div>
      <div style="text-align: center; margin-top: 24px; font-size: 12px; color: #94a3b8;">
        <p style="margin: 0 0 4px 0;">TNT Innovations</p>
        <p style="margin: 0;">TNT Innovations</p>
      </div>
    </div>
  `;

  return sendEmail({ to, subject, html });
};
