import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendInvitationEmail = async (email: string, ideaTitle: string, senderName: string, inviteId: string) => {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set. Skipping email sending.');
    return { id: 'mocked-id' };
  }

  const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3002'}/#/invitations?id=${inviteId}`;

  try {
    const data = await resend.emails.send({
      from: 'Idea-CRM <onboarding@resend.dev>',
      to: [email],
      subject: `Collaboration Invitation: ${ideaTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
          </style>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);">
                  <!-- Header Gradient -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 40px; text-align: center;">
                      <div style="background-color: rgba(255, 255, 255, 0.2); padding: 12px; border-radius: 12px; display: inline-block; margin-bottom: 20px;">
                        <span style="color: white; font-weight: 700; font-size: 24px; letter-spacing: -0.025em;">Idea-CRM</span>
                      </div>
                      <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600; line-height: 1.4;">Collaboration Invitation</h1>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <p style="font-size: 16px; color: #475569; margin-bottom: 24px; line-height: 1.6;">
                        Hello,
                      </p>
                      <p style="font-size: 16px; color: #1e293b; margin-bottom: 32px; line-height: 1.6;">
                        <strong style="color: #4f46e5;">${senderName}</strong> has invited you to collaborate on their idea:
                      </p>
                      
                      <!-- Idea Card -->
                      <div style="background-color: #f1f5f9; border-left: 4px solid #4f46e5; padding: 24px; border-radius: 12px; margin-bottom: 32px;">
                        <h2 style="color: #0f172a; margin: 0 0 8px 0; font-size: 18px; font-weight: 700;">${ideaTitle}</h2>
                        <p style="color: #64748b; margin: 0; font-size: 14px;">Shared Idea Record</p>
                      </div>
                      
                      <!-- CTA Button -->
                      <div style="text-align: center; margin-bottom: 32px;">
                        <a href="${inviteLink}" style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2), 0 2px 4px -1px rgba(79, 70, 229, 0.1);">
                          View & Accept Invitation
                        </a>
                      </div>
                      
                      <p style="font-size: 14px; color: #94a3b8; margin: 0; line-height: 1.6; text-align: center;">
                        This invitation link will expire soon. Please accept it at your earliest convenience.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8fafc; padding: 32px; border-top: 1px solid #e2e8f0; text-align: center;">
                      <p style="font-size: 12px; color: #94a3b8; margin: 0;">
                        Idea-CRM Project Tracker &bull; Collaborative Innovation
                      </p>
                      <p style="font-size: 12px; color: #cbd5e1; margin: 12px 0 0 0;">
                        If you weren't expecting this invitation, you can safely ignore this email.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    console.log('Invitation email sent:', data);
    return data;
  } catch (error) {
    console.error('Error sending invitation email:', error);
    throw error;
  }
};

export const sendTaskAssignmentEmail = async (email: string, ideaTitle: string, taskText: string, senderName: string, ideaId: string) => {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set. Skipping email sending.');
    return { id: 'mocked-id' };
  }

  const ideaLink = `${process.env.FRONTEND_URL || 'http://localhost:3002'}/#/ideas/${ideaId}`;

  try {
    const data = await resend.emails.send({
      from: 'Idea-CRM <onboarding@resend.dev>',
      to: [email],
      subject: `New Task Assigned: ${ideaTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
          </style>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);">
                  <!-- Header Gradient -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px; text-align: center;">
                      <div style="background-color: rgba(255, 255, 255, 0.2); padding: 12px; border-radius: 12px; display: inline-block; margin-bottom: 20px;">
                        <span style="color: white; font-weight: 700; font-size: 24px; letter-spacing: -0.025em;">Idea-CRM</span>
                      </div>
                      <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600; line-height: 1.4;">Task Assigned</h1>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <p style="font-size: 16px; color: #475569; margin-bottom: 24px; line-height: 1.6;">
                        Hello,
                      </p>
                      <p style="font-size: 16px; color: #1e293b; margin-bottom: 32px; line-height: 1.6;">
                        <strong style="color: #10b981;">${senderName}</strong> has assigned a new task to you in the project <strong>${ideaTitle}</strong>:
                      </p>
                      
                      <!-- Task Card -->
                      <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 24px; border-radius: 12px; margin-bottom: 32px;">
                        <p style="color: #065f46; margin: 0; font-size: 16px; font-weight: 600; font-family: monospace;">${taskText}</p>
                      </div>
                      
                      <!-- CTA Button -->
                      <div style="text-align: center; margin-bottom: 32px;">
                        <a href="${ideaLink}" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2), 0 2px 4px -1px rgba(16, 185, 129, 0.1);">
                          Go to Checklist
                        </a>
                      </div>
                      
                      <p style="font-size: 14px; color: #94a3b8; margin: 0; line-height: 1.6; text-align: center;">
                        Stay productive and collaborate effectively.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8fafc; padding: 32px; border-top: 1px solid #e2e8f0; text-align: center;">
                      <p style="font-size: 12px; color: #94a3b8; margin: 0;">
                        Idea-CRM Project Tracker &bull; Better Management
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    console.log('Task assignment email sent:', data);
    return data;
  } catch (error) {
    console.error('Error sending task assignment email:', error);
    throw error;
  }
};

export const sendNoteMentionEmail = async (email: string, ideaTitle: string, noteExcerpt: string, senderName: string, ideaId: string) => {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set. Skipping email sending.');
    return { id: 'mocked-id' };
  }

  const ideaLink = `${process.env.FRONTEND_URL || 'http://localhost:3002'}/#/ideas/${ideaId}`;

  try {
    const data = await resend.emails.send({
      from: 'Idea-CRM <onboarding@resend.dev>',
      to: [email],
      subject: `Mentioned in ${ideaTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
          </style>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);">
                  <!-- Header Gradient -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); padding: 40px; text-align: center;">
                      <div style="background-color: rgba(255, 255, 255, 0.2); padding: 12px; border-radius: 12px; display: inline-block; margin-bottom: 20px;">
                        <span style="color: white; font-weight: 700; font-size: 24px; letter-spacing: -0.025em;">Idea-CRM</span>
                      </div>
                      <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600; line-height: 1.4;">New Mention</h1>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <p style="font-size: 16px; color: #475569; margin-bottom: 24px; line-height: 1.6;">
                        Hello,
                      </p>
                      <p style="font-size: 16px; color: #1e293b; margin-bottom: 32px; line-height: 1.6;">
                        <strong style="color: #7c3aed;">${senderName}</strong> mentioned you in a note for <strong>${ideaTitle}</strong>:
                      </p>
                      
                      <!-- Note Card -->
                      <div style="background-color: #f5f3ff; border-left: 4px solid #7c3aed; padding: 24px; border-radius: 12px; margin-bottom: 32px;">
                        <p style="color: #4c1d95; margin: 0; font-size: 15px; line-height: 1.6; font-style: italic;">"${noteExcerpt}"</p>
                      </div>
                      
                      <!-- CTA Button -->
                      <div style="text-align: center; margin-bottom: 32px;">
                        <a href="${ideaLink}" style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(124, 58, 237, 0.2), 0 2px 4px -1px rgba(124, 58, 237, 0.1);">
                          View Full Note
                        </a>
                      </div>
                      
                      <p style="font-size: 14px; color: #94a3b8; margin: 0; line-height: 1.6; text-align: center;">
                        You received this because you were tagged with @ in a project note.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8fafc; padding: 32px; border-top: 1px solid #e2e8f0; text-align: center;">
                      <p style="font-size: 12px; color: #94a3b8; margin: 0;">
                        Idea-CRM Project Tracker &bull; Team Collaboration
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    console.log('Note mention email sent:', data);
    return data;
  } catch (error) {
    console.error('Error sending note mention email:', error);
    throw error;
  }
};
