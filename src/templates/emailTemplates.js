
/**
 * HTML Email Templates for the Clearance System
 * These templates provide a beautiful, responsive email design that matches the frontend
 */

const baseStyle = `
  body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background-color: #f5f5f5;
  }
  .email-container {
    max-width: 600px;
    margin: 0 auto;
    background-color: #ffffff;
  }
  .header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 40px 20px;
    text-align: center;
  }
  .header h1 {
    color: #ffffff;
    margin: 0; 
    font-size: 28px;
    font-weight: 600;
  }
  .header p {
    color: #e0e7ff;
    margin: 8px 0 0 0;
    font-size: 14px;
  }
  .content {
    padding: 40px 30px;
    color: #333333;
    line-height: 1.6;
  }
  .content h2 {
    color: #667eea;
    margin: 0 0 20px 0;
    font-size: 22px;
    font-weight: 600;
  }
  .content p {
    margin: 0 0 16px 0;
    font-size: 15px;
  }
  .badge {
    display: inline-block;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
    margin: 10px 0;
  }
  .badge-success {
    background-color: #d1fae5;
    color: #065f46;
  }
  .badge-warning {
    background-color: #fed7aa;
    color: #92400e;
  }
  .badge-danger {
    background-color: #fee2e2;
    color: #991b1b;
  }
  .badge-info {
    background-color: #dbeafe;
    color: #1e40af;
  }
  .details-box {
    background-color: #f9fafb;
    border-left: 4px solid #667eea;
    padding: 20px;
    margin: 20px 0;
    border-radius: 4px;
  }
  .details-box p {
    margin: 8px 0;
    font-size: 14px;
  }
  .details-box strong {
    color: #667eea;
    font-weight: 600;
  }
  .button {
    display: inline-block;
    padding: 14px 32px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #ffffff !important;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    margin: 20px 0;
    text-align: center;
    font-size: 15px;
  }
  .button:hover {
    opacity: 0.9;
  }
  .footer {
    background-color: #f9fafb;
    padding: 30px;
    text-align: center;
    color: #6b7280;
    font-size: 13px;
    border-top: 1px solid #e5e7eb;
  }
  .footer p {
    margin: 5px 0;
  }
  .divider {
    height: 1px;
    background-color: #e5e7eb;
    margin: 30px 0;
  }
`;

function getBaseTemplate(content) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>${baseStyle}</style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <h1>📋 AI Clearance System</h1>
          <p>Department of Software Engineering</p>
        </div>
        ${content}
        <div class="footer">
          <p><strong>AI-Assisted Clearance System</strong></p>
          <p>This is an automated notification. Please do not reply to this email.</p>
          <p>For support, contact your department administrator.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Template: Clearance item pending (for personnel)
 */
function clearancePendingTemplate({ studentName, officeName, itemDetails }) {
  const content = `
    <div class="content">
      <h2>🎓 New Clearance Item Awaiting Review</h2>
      <p>Hello,</p>
      <p>A clearance item from <strong>${studentName}</strong> requires your attention.</p>

      <div class="details-box">
        <p><strong>Office:</strong> ${officeName}</p>
        <p><strong>Student:</strong> ${studentName}</p>
        <p><strong>Status:</strong> <span class="badge badge-warning">Pending Review</span></p>
      </div>

      <p>Please log in to the clearance system to review and process this request.</p>

      <a href="${process.env.FRONTEND_URL || 'http://localhost:5000'}/index.html" class="button">
        Review Clearance Request
      </a>

      <div class="divider"></div>
      <p style="font-size: 13px; color: #6b7280;">
        Timely responses help students complete their clearance process efficiently.
      </p>
    </div>
  `;
  return getBaseTemplate(content);
}

/**
 * Template: Clearance item approved (for student)
 */
function clearanceApprovedTemplate({ officeName, studentName, remainingOffices }) {
  const content = `
    <div class="content">
      <h2>✅ Clearance Item Approved</h2>
      <p>Hello <strong>${studentName}</strong>,</p>
      <p>Great news! Your clearance request has been approved.</p>

      <div class="details-box">
        <p><strong>Office:</strong> ${officeName}</p>
        <p><strong>Status:</strong> <span class="badge badge-success">Approved</span></p>
        ${remainingOffices > 0 ? `<p><strong>Remaining:</strong> ${remainingOffices} office${remainingOffices > 1 ? 's' : ''} pending</p>` : ''}
      </div>

      ${remainingOffices > 0
        ? '<p>You are one step closer to completing your clearance. Keep tracking your progress!</p>'
        : '<p>🎉 Congratulations! All clearance items have been approved. Your clearance is complete!</p>'}

      <a href="${process.env.FRONTEND_URL || 'http://localhost:5000'}/index.html" class="button">
        View Your index.html
      </a>
    </div>
  `;
  return getBaseTemplate(content);
}

/**
 * Template: Clearance item rejected (for student)
 */
function clearanceRejectedTemplate({ officeName, studentName, reason, category }) {
  const content = `
    <div class="content">
      <h2>❌ Clearance Item Requires Attention</h2>
      <p>Hello <strong>${studentName}</strong>,</p>
      <p>Your clearance request requires additional action before it can be approved.</p>

      <div class="details-box">
        <p><strong>Office:</strong> ${officeName}</p>
        <p><strong>Status:</strong> <span class="badge badge-danger">Rejected</span></p>
        ${category ? `<p><strong>Category:</strong> ${category}</p>` : ''}
        <p><strong>Reason:</strong> ${reason || 'No specific reason provided'}</p>
      </div>

      <p>Please address the issue mentioned above and resubmit your clearance request if necessary.</p>

      <a href="${process.env.FRONTEND_URL || 'http://localhost:5000'}/index.html" class="button">
        View Details
      </a>

      <div class="divider"></div>
      <p style="font-size: 13px; color: #6b7280;">
        If you have questions about this rejection, please contact the ${officeName} directly.
      </p>
    </div>
  `;
  return getBaseTemplate(content);
}

/**
 * Template: Clearance completed (for student)
 */
function clearanceCompletedTemplate({ studentName, completedDate }) {
  const content = `
    <div class="content">
      <h2>🎉 Clearance Process Complete!</h2>
      <p>Hello <strong>${studentName}</strong>,</p>
      <p>Congratulations! You have successfully completed all clearance requirements.</p>

      <div class="details-box">
        <p><strong>Status:</strong> <span class="badge badge-success">Completed</span></p>
        <p><strong>Completed On:</strong> ${completedDate}</p>
      </div>

      <p>All offices have approved your clearance. You can now download your clearance certificate from the index.html.</p>

      <a href="${process.env.FRONTEND_URL || 'http://localhost:5000'}/index.html" class="button">
        Download Certificate
      </a>

      <div class="divider"></div>
      <p style="font-size: 13px; color: #6b7280;">
        🎓 Best wishes for your future endeavors!
      </p>
    </div>
  `;
  return getBaseTemplate(content);
}

/**
 * Template: Delay reminder (for personnel)
 */
function delayReminderTemplate({ personnelName, studentName, officeName, daysPending, slaTarget }) {
  const content = `
    <div class="content">
      <h2>⏰ Clearance Delay Reminder</h2>
      <p>Hello <strong>${personnelName}</strong>,</p>
      <p>This is a friendly reminder that a clearance item has been pending for an extended period.</p>

      <div class="details-box">
        <p><strong>Student:</strong> ${studentName}</p>
        <p><strong>Office:</strong> ${officeName}</p>
        <p><strong>Days Pending:</strong> ${daysPending} days</p>
        <p><strong>Target SLA:</strong> ${slaTarget} days</p>
        <p><strong>Status:</strong> <span class="badge badge-warning">Overdue</span></p>
      </div>

      <p>The student is waiting for your response. Please review this clearance item at your earliest convenience.</p>

      <a href="${process.env.FRONTEND_URL || 'http://localhost:5000'}/index.html" class="button">
        Review Now
      </a>

      <div class="divider"></div>
      <p style="font-size: 13px; color: #6b7280;">
        Prompt responses help maintain an efficient clearance process for all students.
      </p>
    </div>
  `;
  return getBaseTemplate(content);
}

/**
 * Generate HTML email based on notification type
 */
function generateEmailHTML(type, data) {
  switch (type) {
    case 'clearance_pending':
      return clearancePendingTemplate(data);
    case 'clearance_approved':
      return clearanceApprovedTemplate(data);
    case 'clearance_rejected':
      return clearanceRejectedTemplate(data);
    case 'clearance_completed':
      return clearanceCompletedTemplate(data);
    case 'delay_reminder':
      return delayReminderTemplate(data);
    default:
      // Fallback to simple template
      return getBaseTemplate(`
        <div class="content">
          <h2>Notification</h2>
          <p>${data.message || 'You have a new notification from the clearance system.'}</p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5000'}/index.html" class="button">
            View index.html
          </a>
        </div>
      `);
  }
}

module.exports = {
  generateEmailHTML,
  clearancePendingTemplate,
  clearanceApprovedTemplate,
  clearanceRejectedTemplate,
  clearanceCompletedTemplate,
  delayReminderTemplate,
};
