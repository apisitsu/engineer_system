/**
 * =================================================================
 * CONFIG SHEET UTILITY FUNCTIONS
 * =================================================================
 * เพิ่ม functions เหล่านี้ใน Code.gs หรือ AdditionalFunctions.gs
 * =================================================================
 */

/**
 * Open Config Sheet
 */
function openConfigSheet() {
  const ss = getSpreadsheet();
  const configSheet = ss.getSheetByName('Config');
  
  if (configSheet) {
    ss.setActiveSheet(configSheet);
    SpreadsheetApp.getUi().alert(
      '⚙️ Config Sheet',
      'Config Sheet opened!\n\n' +
      'You can edit email addresses and due days here.\n' +
      'Changes take effect immediately.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } else {
    SpreadsheetApp.getUi().alert(
      '❌ Error',
      'Config Sheet not found!\n\n' +
      'Please run "Initialize Sheets" first.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

/**
 * Validate Email Configuration
 */
function validateEmailConfig() {
  const ui = SpreadsheetApp.getUi();
  
  try {
    const emailConfig = getEmailConfig();
    const dueDays = getDueDaysConfig();
    
    let message = '✅ Email Configuration Validation\n\n';
    message += '═════════════════════════════════\n';
    message += '📧 EMAIL ADDRESSES\n';
    message += '═════════════════════════════════\n\n';
    
    // Validate each config key
    const configKeys = [
      'ENG_CHECK',
      'CC_ENG_CHECK',
      'DRAFTMAN',
      'CC_DRAFTMAN',
      'DWG_CHECK',
      'CC_DWG_CHECK',
      'ENG_REVIEW',
      'CC_ENG_REVIEW',
      'ENG_APPROVE',
      'CC_ENG_APPROVE'
    ];
    
    let hasError = false;
    let errorCount = 0;
    let successCount = 0;
    
    configKeys.forEach(key => {
      const emails = emailConfig[key];
      if (emails && emails.length > 0) {
        // Check if all emails are valid
        const allValid = emails.every(email => isValidEmail(email));
        if (allValid) {
          message += `✅ ${key}:\n`;
          message += `   ${emails.join(', ')}\n\n`;
          successCount++;
        } else {
          message += `❌ ${key}:\n`;
          message += `   ${emails.join(', ')}\n`;
          message += `   ERROR: Invalid email format!\n\n`;
          hasError = true;
          errorCount++;
        }
      } else {
        message += `⚠️ ${key}:\n`;
        message += `   No emails configured\n\n`;
      }
    });
    
    message += '═════════════════════════════════\n';
    message += '⏰ DUE DAYS CONFIGURATION\n';
    message += '═════════════════════════════════\n\n';
    
    Object.keys(dueDays).forEach(requestType => {
      const days = dueDays[requestType];
      if (days && days > 0) {
        message += `✅ ${requestType}: ${days} days\n`;
      } else {
        message += `❌ ${requestType}: Invalid value (${days})\n`;
        hasError = true;
        errorCount++;
      }
    });
    
    message += '\n═════════════════════════════════\n';
    message += 'SUMMARY\n';
    message += '═════════════════════════════════\n';
    message += `✅ Valid: ${successCount}\n`;
    message += `❌ Errors: ${errorCount}\n`;
    
    if (hasError) {
      message += '\n⚠️ Please fix the errors in Config Sheet';
      ui.alert('⚠️ Configuration Errors', message, ui.ButtonSet.OK);
    } else {
      message += '\n✅ All configurations are valid!';
      ui.alert('✅ Configuration Valid', message, ui.ButtonSet.OK);
    }
    
  } catch (error) {
    ui.alert(
      '❌ Error',
      'Error validating configuration:\n\n' + error.toString(),
      ui.ButtonSet.OK
    );
  }
}

/**
 * Show Current Configuration
 */
function showCurrentConfig() {
  const ui = SpreadsheetApp.getUi();
  
  try {
    const emailConfig = getEmailConfig();
    const dueDays = getDueDaysConfig();
    
    let message = '📋 Current Configuration\n\n';
    message += '═════════════════════════════════\n';
    message += '📧 EMAIL CONFIGURATION\n';
    message += '═════════════════════════════════\n\n';
    
    Object.keys(emailConfig).forEach(key => {
      const emails = emailConfig[key];
      message += `${key}:\n`;
      if (emails && emails.length > 0) {
        emails.forEach(email => {
          message += `  • ${email}\n`;
        });
      } else {
        message += `  (No emails)\n`;
      }
      message += '\n';
    });
    
    message += '═════════════════════════════════\n';
    message += '⏰ DUE DAYS CONFIGURATION\n';
    message += '═════════════════════════════════\n\n';
    
    Object.keys(dueDays).forEach(requestType => {
      message += `${requestType}: ${dueDays[requestType]} working days\n`;
    });
    
    message += '\n═════════════════════════════════\n';
    message += '\nTo edit: Request System > Open Config Sheet';
    
    ui.alert('📋 Current Configuration', message, ui.ButtonSet.OK);
    
  } catch (error) {
    ui.alert(
      '❌ Error',
      'Error reading configuration:\n\n' + error.toString(),
      ui.ButtonSet.OK
    );
  }
}

/**
 * Check if email is valid
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Send test email to verify configuration
 */
function sendTestEmail() {
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.prompt(
    'Send Test Email',
    'Enter your email address to receive a test email:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() !== ui.Button.OK) {
    return;
  }
  
  const email = response.getResponseText().trim();
  
  if (!isValidEmail(email)) {
    ui.alert('❌ Invalid email format!');
    return;
  }
  
  try {
    const emailConfig = getEmailConfig();
    const dueDays = getDueDaysConfig();
    
    let body = '<h2>🧪 Test Email - ROD END Request System</h2>';
    body += '<p>This is a test email to verify your email configuration.</p>';
    body += '<hr>';
    body += '<h3>📧 Email Configuration</h3>';
    body += '<ul>';
    
    Object.keys(emailConfig).forEach(key => {
      const emails = emailConfig[key];
      body += `<li><strong>${key}:</strong> ${emails.join(', ')}</li>`;
    });
    
    body += '</ul>';
    body += '<h3>⏰ Due Days Configuration</h3>';
    body += '<ul>';
    
    Object.keys(dueDays).forEach(requestType => {
      body += `<li><strong>${requestType}:</strong> ${dueDays[requestType]} days</li>`;
    });
    
    body += '</ul>';
    body += '<hr>';
    body += '<p style="color: #4CAF50; font-weight: bold;">✅ Email system is working correctly!</p>';
    
    MailApp.sendEmail({
      to: email,
      subject: '🧪 Test Email - ROD END Request System',
      htmlBody: body
    });
    
    ui.alert(
      '✅ Success',
      'Test email sent successfully to:\n' + email + '\n\nPlease check your inbox.',
      ui.ButtonSet.OK
    );
    
  } catch (error) {
    ui.alert(
      '❌ Error',
      'Error sending test email:\n\n' + error.toString(),
      ui.ButtonSet.OK
    );
  }
}

/**
 * Reset Config to Default Values
 */
function resetConfigToDefault() {
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.alert(
    '⚠️ Reset Configuration',
    'This will reset all email and due days configuration to default values.\n\n' +
    'Your current configuration will be lost!\n\n' +
    'Are you sure?',
    ui.ButtonSet.YES_NO
  );
  
  if (response !== ui.Button.YES) {
    return;
  }
  
  try {
    const ss = getSpreadsheet();
    const configSheet = ss.getSheetByName('Config');
    
    if (!configSheet) {
      ui.alert('❌ Config Sheet not found!');
      return;
    }
    
    // Get default configs
    const defaultEmails = getDefaultEmailConfig();
    const defaultDueDays = getDefaultDueDays();
    
    // Clear current data (rows 4-8 for emails, rows 11-13 for due days)
    configSheet.getRange('B4:B8').clearContent();
    configSheet.getRange('B11:B13').clearContent();
    
    // Write default email config
    let row = 4;
    const emailKeys = ['ENG_CHECK', 'CC_ENG_CHECK', 'DRAFTMAN', 'CC_DRAFTMAN', 'ENG_REVIEW'];
    emailKeys.forEach(key => {
      if (defaultEmails[key]) {
        configSheet.getRange(row, 2).setValue(defaultEmails[key].join(', '));
      }
      row++;
    });
    
    // Write default due days config
    row = 11;
    const requestTypes = ['Regist Drawing', 'Draft Drawing', '3D Print'];
    requestTypes.forEach(type => {
      if (defaultDueDays[type]) {
        configSheet.getRange(row, 2).setValue(defaultDueDays[type]);
      }
      row++;
    });
    
    ui.alert(
      '✅ Success',
      'Configuration has been reset to default values!',
      ui.ButtonSet.OK
    );
    
  } catch (error) {
    ui.alert(
      '❌ Error',
      'Error resetting configuration:\n\n' + error.toString(),
      ui.ButtonSet.OK
    );
  }
}

/**
 * Export Config to Text File
 */
function exportConfigToText() {
  try {
    const emailConfig = getEmailConfig();
    const dueDays = getDueDaysConfig();
    
    let text = '══════════════════════════════════════════\n';
    text += 'ROD END REQUEST SYSTEM - CONFIGURATION\n';
    text += '══════════════════════════════════════════\n\n';
    text += 'Export Date: ' + new Date().toLocaleString() + '\n\n';
    
    text += '📧 EMAIL CONFIGURATION\n';
    text += '─────────────────────────────────────────\n\n';
    
    Object.keys(emailConfig).forEach(key => {
      text += `${key}:\n`;
      const emails = emailConfig[key];
      if (emails && emails.length > 0) {
        emails.forEach(email => {
          text += `  • ${email}\n`;
        });
      } else {
        text += '  (No emails)\n';
      }
      text += '\n';
    });
    
    text += '⏰ DUE DAYS CONFIGURATION\n';
    text += '─────────────────────────────────────────\n\n';
    
    Object.keys(dueDays).forEach(requestType => {
      text += `${requestType}: ${dueDays[requestType]} working days\n`;
    });
    
    text += '\n══════════════════════════════════════════\n';
    
    Logger.log(text);
    
    SpreadsheetApp.getUi().alert(
      '✅ Config Exported',
      'Configuration has been exported to Apps Script Logs.\n\n' +
      'View it at: View > Logs',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
  } catch (error) {
    SpreadsheetApp.getUi().alert(
      '❌ Error',
      'Error exporting configuration:\n\n' + error.toString(),
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

/**
 * Create backup of Config Sheet
 */
function backupConfigSheet() {
  try {
    const ss = getSpreadsheet();
    const configSheet = ss.getSheetByName('Config');
    
    if (!configSheet) {
      SpreadsheetApp.getUi().alert('❌ Config Sheet not found!');
      return;
    }
    
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    const backupName = `Config_Backup_${timestamp}`;
    
    // Duplicate the sheet
    const backup = configSheet.copyTo(ss);
    backup.setName(backupName);
    
    // Move to end
    ss.moveActiveSheet(ss.getNumSheets());
    
    SpreadsheetApp.getUi().alert(
      '✅ Backup Created',
      `Config Sheet has been backed up!\n\nBackup name: ${backupName}\n\n` +
      'You can find it at the end of your sheets.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
  } catch (error) {
    SpreadsheetApp.getUi().alert(
      '❌ Error',
      'Error creating backup:\n\n' + error.toString(),
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}