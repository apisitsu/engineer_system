// ================================================================= //
//                  VIEWER AUTHENTICATION SERVICE                   //
// ================================================================= //

/**
 * SETUP DATA SHEET SYSTEM - Viewer Authentication Module
 * Handles secondary authentication for Viewer role users
 * Allows multiple people to use same Google account with different permissions
 */

/**
 * Authenticate Viewer with username/password
 * @param {string} username - Viewer username
 * @param {string} password - Plain text password (will be hashed)
 * @returns {Object} Authentication result with session data
 */
function authenticateViewer(username, password) {
  try {
    const sheet = dataSs.getSheetByName('ViewerCredentials');
    if (!sheet) {
      return {
        success: false,
        error: 'ViewerCredentials sheet not found. Please contact administrator.'
      };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());

    // Find column indices
    const usernameIdx = headers.indexOf('username');
    const passwordHashIdx = headers.indexOf('password_hash');
    const allowedCodesIdx = headers.indexOf('allowed_process_codes');
    const isActiveIdx = headers.indexOf('is_active');
    const lastLoginIdx = headers.indexOf('last_login');
    const descriptionIdx = headers.indexOf('description');

    if (usernameIdx === -1 || passwordHashIdx === -1) {
      return {
        success: false,
        error: 'ViewerCredentials table structure is incorrect'
      };
    }

    // Find matching username
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      if (String(row[usernameIdx]).trim() === username.trim()) {
        // Check if account is active
        const isActive = isActiveIdx > -1 ? row[isActiveIdx] : true;
        if (!isActive) {
          Logger.log(`[Viewer Auth] Account disabled: ${username}`);
          return {
            success: false,
            error: 'This account has been disabled. Please contact administrator.'
          };
        }

        // Verify password
        const storedHash = String(row[passwordHashIdx]);
        const inputHash = hashPassword(password);

        if (storedHash !== inputHash) {
          Logger.log(`[Viewer Auth] Invalid password for: ${username}`);
          return {
            success: false,
            error: 'Invalid username or password'
          };
        }

        // Get allowed process codes
        const allowedCodes = allowedCodesIdx > -1 ? String(row[allowedCodesIdx]) : '*';
        const description = descriptionIdx > -1 ? String(row[descriptionIdx]) : username;

        // Update last login timestamp
        if (lastLoginIdx > -1) {
          sheet.getRange(i + 1, lastLoginIdx + 1).setValue(new Date());
        }

        Logger.log(`[Viewer Auth] Login successful: ${username}`);

        // Return session data
        return {
          success: true,
          session: {
            username: username,
            description: description,
            allowed_process_codes: allowedCodes,
            login_time: new Date().toISOString(),
            expires_at: new Date(Date.now() + 600000).toISOString() // 10 minutes
          }
        };
      }
    }

    Logger.log(`[Viewer Auth] Username not found: ${username}`);
    return {
      success: false,
      error: 'Invalid username or password'
    };

  } catch (e) {
    Logger.log(`authenticateViewer Error: ${e.message}`);
    Logger.log(e.stack);
    return {
      success: false,
      error: 'Authentication failed. Please try again.'
    };
  }
}

/**
 * Hash password using SHA-256
 * @param {string} password - Plain text password
 * @returns {string} Hashed password (hex format)
 */
function hashPassword(password) {
  try {
    const rawHash = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      password,
      Utilities.Charset.UTF_8
    );

    // Convert to hex string
    return rawHash.map(byte => {
      const hex = (byte & 0xFF).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');

  } catch (e) {
    Logger.log(`hashPassword Error: ${e.message}`);
    throw new Error('Password hashing failed');
  }
}

/**
 * Create new Viewer account (Admin function)
 * @param {string} username - Unique username
 * @param {string} password - Plain text password
 * @param {string} allowedProcessCodes - Comma-separated process codes (e.g., "1021,1022" or "*")
 * @param {string} description - Account description
 * @returns {Object} Success status
 */
function createViewerAccount(username, password, allowedProcessCodes, description = '') {
  try {
    const sheet = dataSs.getSheetByName('ViewerCredentials');
    if (!sheet) {
      throw new Error('ViewerCredentials sheet not found');
    }

    // Check if username already exists
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const usernameIdx = headers.indexOf('username');

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][usernameIdx]).trim() === username.trim()) {
        return {
          success: false,
          error: `Username '${username}' already exists`
        };
      }
    }

    // Hash password
    const passwordHash = hashPassword(password);

    // Prepare new row
    const newRow = [
      username.trim(),
      passwordHash,
      allowedProcessCodes || '*',
      description || username,
      true, // is_active
      new Date(), // created_date
      null // last_login (empty initially)
    ];

    // Append row
    sheet.appendRow(newRow);

    Logger.log(`[Viewer Admin] Created account: ${username}`);
    return {
      success: true,
      message: `Viewer account '${username}' created successfully`
    };

  } catch (e) {
    Logger.log(`createViewerAccount Error: ${e.message}`);
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * Update Viewer account password (Admin function)
 * @param {string} username - Viewer username
 * @param {string} newPassword - New plain text password
 * @returns {Object} Success status
 */
function updateViewerPassword(username, newPassword) {
  try {
    const sheet = dataSs.getSheetByName('ViewerCredentials');
    if (!sheet) {
      throw new Error('ViewerCredentials sheet not found');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const usernameIdx = headers.indexOf('username');
    const passwordHashIdx = headers.indexOf('password_hash');

    // Find account
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][usernameIdx]).trim() === username.trim()) {
        // Hash new password
        const newHash = hashPassword(newPassword);

        // Update password
        sheet.getRange(i + 1, passwordHashIdx + 1).setValue(newHash);

        Logger.log(`[Viewer Admin] Password updated for: ${username}`);
        return {
          success: true,
          message: `Password updated for '${username}'`
        };
      }
    }

    return {
      success: false,
      error: `Username '${username}' not found`
    };

  } catch (e) {
    Logger.log(`updateViewerPassword Error: ${e.message}`);
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * Enable/Disable Viewer account (Admin function)
 * @param {string} username - Viewer username
 * @param {boolean} isActive - True to enable, false to disable
 * @returns {Object} Success status
 */
function setViewerAccountStatus(username, isActive) {
  try {
    const sheet = dataSs.getSheetByName('ViewerCredentials');
    if (!sheet) {
      throw new Error('ViewerCredentials sheet not found');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const usernameIdx = headers.indexOf('username');
    const isActiveIdx = headers.indexOf('is_active');

    // Find account
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][usernameIdx]).trim() === username.trim()) {
        // Update status
        sheet.getRange(i + 1, isActiveIdx + 1).setValue(isActive);

        const status = isActive ? 'enabled' : 'disabled';
        Logger.log(`[Viewer Admin] Account ${status}: ${username}`);
        return {
          success: true,
          message: `Account '${username}' ${status}`
        };
      }
    }

    return {
      success: false,
      error: `Username '${username}' not found`
    };

  } catch (e) {
    Logger.log(`setViewerAccountStatus Error: ${e.message}`);
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * Update allowed Process Codes for Viewer account (Admin function)
 * @param {string} username - Viewer username
 * @param {string} allowedProcessCodes - New process codes (e.g., "1021,1022" or "*")
 * @returns {Object} Success status
 */
function updateViewerProcessCodes(username, allowedProcessCodes) {
  try {
    const sheet = dataSs.getSheetByName('ViewerCredentials');
    if (!sheet) {
      throw new Error('ViewerCredentials sheet not found');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const usernameIdx = headers.indexOf('username');
    const allowedCodesIdx = headers.indexOf('allowed_process_codes');

    // Find account
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][usernameIdx]).trim() === username.trim()) {
        // Update process codes
        sheet.getRange(i + 1, allowedCodesIdx + 1).setValue(allowedProcessCodes);

        Logger.log(`[Viewer Admin] Process codes updated for: ${username} → ${allowedProcessCodes}`);
        return {
          success: true,
          message: `Process codes updated for '${username}'`
        };
      }
    }

    return {
      success: false,
      error: `Username '${username}' not found`
    };

  } catch (e) {
    Logger.log(`updateViewerProcessCodes Error: ${e.message}`);
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * Get all Viewer accounts (Admin function)
 * @returns {Array} List of viewer accounts (passwords excluded)
 */
function getAllViewerAccounts() {
  try {
    const sheet = dataSs.getSheetByName('ViewerCredentials');
    if (!sheet) {
      return [];
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const accounts = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const account = {};

      headers.forEach((header, idx) => {
        // Exclude password_hash from response
        if (header !== 'password_hash') {
          account[header] = row[idx];
        }
      });

      accounts.push(account);
    }

    return accounts;

  } catch (e) {
    Logger.log(`getAllViewerAccounts Error: ${e.message}`);
    return [];
  }
}
