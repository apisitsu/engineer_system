// ================================================================= //
//                      USER MANAGEMENT                              //
// ================================================================= //

/**
 * SETUP DATA SHEET SYSTEM - User Service Module
 * Handles user authentication, roles, and permissions
 */

/**
 * Get user info - ENHANCED VERSION with caching for better performance
 * This function iterates all rows to aggregate roles and permissions.
 * Uses CacheService to cache user data for 1 hour.
 * @param {string} userEmail (optional) - If not specified, gets the current user
 * @returns {Object} Complete user information
 */
function getUserInfo(userEmail = null) {
  try {
    const targetEmail = userEmail || Session.getActiveUser().getEmail();

    if (!targetEmail) {
      return createFallbackUserInfo(targetEmail);
    }

    // Try to get from cache first (Performance: 5-10ms)
    const cache = CacheService.getScriptCache();
    const cacheKey = `user_${targetEmail}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      try {
        const userData = JSON.parse(cached);
        Logger.log(`[CACHE HIT] User data loaded from cache for: ${targetEmail}`);
        return userData;
      } catch (e) {
        Logger.log(`[CACHE ERROR] Failed to parse cached data: ${e.message}`);
        // Continue to load from sheet
      }
    }

    Logger.log(`[CACHE MISS] Loading user data from sheet for: ${targetEmail}`);

    // Load from sheet (Performance: 600-1200ms)
    const userData = loadUserFromSheet(targetEmail);

    // Cache for 1 hour (3600 seconds)
    try {
      cache.put(cacheKey, JSON.stringify(userData), 3600);
      Logger.log(`[CACHE SAVED] User data cached for: ${targetEmail}`);
    } catch (e) {
      Logger.log(`[CACHE WARNING] Failed to cache user data: ${e.message}`);
      // Continue without caching
    }

    return userData;

  } catch (e) {
    Logger.log(`Error in getUserInfo: ${e.message}`);
    return createFallbackUserInfo(userEmail);
  }
}

/**
 * Load user data from AuthorizedUsers sheet
 * This is the actual data loading logic extracted from getUserInfo
 * @param {string} targetEmail - User email to load
 * @returns {Object} User information
 */
function loadUserFromSheet(targetEmail) {
  try {
    
    const sheet = dataSs.getSheetByName('AuthorizedUsers');
    if (!sheet) {
      Logger.log("Warning: 'AuthorizedUsers' sheet not found.");
      return createFallbackUserInfo(targetEmail);
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    
    // Find all column indices
    const indices = {
      email: headers.indexOf('Email'),
      role: headers.indexOf('Role'),
      dept: headers.indexOf('Department'),
      notify: headers.indexOf('Notify'),
      canApprove: headers.indexOf('CanApproveWithNotification'),
      canCheck: headers.indexOf('CanCheckWithNotification'),
      notifyAssign: headers.indexOf('Notify_On_Assign'),
      notifyComplete: headers.indexOf('Notify_On_Complete'),
      priority: headers.indexOf('Priority'),
      allowedProcessCodes: headers.indexOf('Allowed_Process_Codes')
    };
    
    // Initialize user data with "least privileged" defaults
    let userData = {
      email: targetEmail,
      displayName: targetEmail.split('@')[0],
      roles: [], // Start with an empty array
      departments: new Set(), // Use a Set to store unique departments
      canApproveWithNotification: false, // Default to false
      canCheckWithNotification: false, // Default to false
      priority: 'Secondary', // Default to Secondary
      notifyOnAssign: false, // Default to false
      notifyOnComplete: false,
      isActive: true, // Assume active if found
      allowedProcessCodes: null // Default: no Process Code restriction
    };
    
    let userFound = false;
    
    // Loop through ALL rows (do not break after first match)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      if (String(row[indices.email]) === targetEmail) {
        userFound = true; 
        
        // 1. Aggregate Roles
        if (indices.role !== -1 && row[indices.role]) {
          const rolesFromRow = String(row[indices.role]).split(',').map(r => r.trim());
          rolesFromRow.forEach(role => {
            if (role && !userData.roles.includes(role)) {
              userData.roles.push(role);
            }
          });
        }
        
        // 2. Aggregate Departments
        if (indices.dept !== -1 && row[indices.dept]) {
          const deptsFromRow = String(row[indices.dept]).split(',').map(d => d.trim());
          deptsFromRow.forEach(dept => {
            if (dept) {
              userData.departments.add(dept);
            }
          });
        }
        
        // 3. Aggregate "CanApprove" (if ANY row is true, set to true)
        if (indices.canApprove !== -1) {
          if (isTrueValue(row[indices.canApprove])) {
            userData.canApproveWithNotification = true;
          }
        }

        // 3.1 Aggregate "CanCheck" (if ANY row is true, set to true)
        if (indices.canCheck !== -1) {
          if (isTrueValue(row[indices.canCheck])) {
            userData.canCheckWithNotification = true;
          }
        }

        // 4. Aggregate "Priority" (if ANY row is Primary, set to Primary)
        if (indices.priority !== -1 && String(row[indices.priority]) === 'Primary') {
          userData.priority = 'Primary';
        }

        // 5. Aggregate "NotifyOnAssign" (if ANY row is true, set to true)
        if (indices.notifyAssign !== -1) {
          if (isTrueValue(row[indices.notifyAssign])) {
            userData.notifyOnAssign = true;
          }
        }
        
        // 6. Aggregate "NotifyOnComplete"
        if (indices.notifyComplete !== -1) {
          if (isTrueValue(row[indices.notifyComplete])) {
            userData.notifyOnComplete = true;
          }
        }

        // 7. Read "Allowed_Process_Codes" (use first non-empty value found)
        if (indices.allowedProcessCodes !== -1 && !userData.allowedProcessCodes) {
          const processCodesValue = row[indices.allowedProcessCodes];
          if (processCodesValue && String(processCodesValue).trim() !== '') {
            userData.allowedProcessCodes = String(processCodesValue).trim();
          }
        }

        // We do NOT 'break;' here. We continue looping for other roles.
      }
    }
    
    // If user is not found in the system
    if (!userFound) {
      userData.isActive = false;
      userData.roles = []; // No roles
    }

    // Convert Set to comma-separated string for backward compatibility
    userData.department = Array.from(userData.departments).join(', ');
    delete userData.departments; // Clean up

    return userData;

  } catch (e) {
    Logger.log(`Error in loadUserFromSheet: ${e.message}`);
    return createFallbackUserInfo(targetEmail);
  }
}

/**
 * Enhanced user retrieval with priority and notification settings
 * @param {string} role - Role (Prepared, Checked, Approved)
 * @param {string} department - Department
 * @param {boolean} showSecondary - Whether to show Secondary users or not
 * @return {Array} List of sorted and filtered users
 */
function getUsersByRoleWithPriority(role, department, showSecondary = true) {
  try {
    const sheet = dataSs.getSheetByName('AuthorizedUsers');
    if (!sheet) {
      throw new Error('AuthorizedUsers sheet not found');
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const emailIndex = headers.indexOf('Email');
    const roleIndex = headers.indexOf('Role');
    const deptIndex = headers.indexOf('Department');
    const priorityIndex = headers.indexOf('Priority');

    if (emailIndex === -1 || roleIndex === -1 || deptIndex === -1) {
      throw new Error('AuthorizedUsers table structure is incorrect');
    }
    
    const users = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Check for empty values
      if (!row[emailIndex] || !row[roleIndex] || !row[deptIndex]) {
        continue;
      }
      
      // Check role and department (supports multiple roles)
      const userRoles = String(row[roleIndex]).split(',').map(r => r.trim());
      const userDepartments = String(row[deptIndex]).split(',').map(d => d.trim());
      
      const hasRole = userRoles.includes(role);
      const hasDepartment = userDepartments.includes(department);
      
      if (hasRole && hasDepartment) {
        const userEmail = String(row[emailIndex]);
        const userInfo = getUserInfo(userEmail);
        
        // Filter out Secondary users if not required
        if (!showSecondary && userInfo.priority === 'Secondary') {
          continue;
        }
        
        const user = {
          email: userEmail,
          role: role,
          department: department,
          displayName: userInfo.displayName,
          priority: userInfo.priority,
          notifyOnAssign: userInfo.notifyOnAssign,
          notifyOnComplete: userInfo.notifyOnComplete,
          isActive: userInfo.isActive
        };
        
        users.push(user);
      }
    }
    
    // Sort: Primary first, then by name
    users.sort((a, b) => {
      // Primary comes before Secondary
      if (a.priority === 'Primary' && b.priority === 'Secondary') return -1;
      if (a.priority === 'Secondary' && b.priority === 'Primary') return 1;
      
      // If priority is the same, sort by name
      return a.displayName.localeCompare(b.displayName);
    });

    Logger.log(`Found ${users.length} active users for role: ${role}, department: ${department}`);
    return users;

  } catch (error) {
    Logger.log(`Error in getUsersByRoleWithPriority: ${error.message}`);
    return [];
  }
}

/**
 * Get users by role (without department filter)
 * Helper function for backward compatibility
 * @param {string} role - Role (Prepared, Checked, Approved)
 * @return {Array} List of users with that role
 */
function getUsersByRole(role) {
  try {
    const sheet = dataSs.getSheetByName('AuthorizedUsers');
    if (!sheet) {
      throw new Error('AuthorizedUsers sheet not found');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const emailIndex = headers.indexOf('Email');
    const roleIndex = headers.indexOf('Role');
    const priorityIndex = headers.indexOf('Priority');

    if (emailIndex === -1 || roleIndex === -1) {
      throw new Error('AuthorizedUsers table structure is incorrect');
    }

    const users = [];
    const uniqueEmails = new Set();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Check for empty values
      if (!row[emailIndex] || !row[roleIndex]) {
        continue;
      }

      // Check role (supports multiple roles)
      const userRoles = String(row[roleIndex]).split(',').map(r => r.trim());
      const hasRole = userRoles.includes(role);

      if (hasRole && !uniqueEmails.has(row[emailIndex])) {
        const userEmail = String(row[emailIndex]);
        const userInfo = getUserInfo(userEmail);

        const user = {
          email: userEmail,
          role: role,
          displayName: userInfo.displayName,
          priority: userInfo.priority,
          notifyOnAssign: userInfo.notifyOnAssign,
          notifyOnComplete: userInfo.notifyOnComplete,
          isActive: userInfo.isActive
        };

        users.push(user);
        uniqueEmails.add(userEmail);
      }
    }

    // Sort: Primary first, then by name
    users.sort((a, b) => {
      // Primary comes before Secondary
      if (a.priority === 'Primary' && b.priority === 'Secondary') return -1;
      if (a.priority === 'Secondary' && b.priority === 'Primary') return 1;

      // If priority is the same, sort by name
      return a.displayName.localeCompare(b.displayName);
    });

    Logger.log(`Found ${users.length} users for role: ${role}`);
    return users;

  } catch (error) {
    Logger.log(`Error in getUsersByRole: ${error.message}`);
    return [];
  }
}

/**
 * Get users for dropdown with formatted display text
 */
function getUsersForDropdown(role, department) {
  const users = getUsersByRoleWithPriority(role, department, true);
  return users.map(user => {
    const prioritySymbol = user.priority === 'Primary' ? ' ★' : ' 🔄';
    const notifyStatus = user.notifyOnAssign ? '' : ' 🔕';
    const status = user.isActive ? '' : ' ⚠️';

    return {
      value: user.email,
      displayText: `${user.displayName} (${user.department})${prioritySymbol}${notifyStatus}${status}`,
      priority: user.priority,
      notifyOnAssign: user.notifyOnAssign,
      isActive: user.isActive
    };
  });
}

/**
 * Check if user has specific role
 * @param {Object} user - User object
 * @param {string} role - Role to check
 * @returns {boolean} True if user has the role
 */
function userHasRole(user, role) {
  return user.roles && user.roles.includes(role);
}

/**
 * Check if user can approve with notification
 * @param {Object} user - User object
 * @returns {boolean} True if user can approve with notification
 */
function canApproveWithNotification(user) {
  return user.canApproveWithNotification || false;
}

/**
 * Check if user can check with notification
 * @param {Object} user - User object
 * @returns {boolean} True if user can check with notification
 */
function canCheckWithNotification(user) {
  return user.canCheckWithNotification || false;
}

/**
 * [NEW] Check if user is Viewer (read-only access)
 * @param {Object} user - User object
 * @returns {boolean} True if user is a Viewer
 */
function isViewer(user) {
  return userHasRole(user, ROLES.VIEWER);
}

/**
 * [NEW] Check if user is Guest (read-only access to all approved)
 * @param {Object} user - User object
 * @returns {boolean} True if user is a Guest
 */
function isGuest(user) {
  return userHasRole(user, ROLES.GUEST);
}

/**
 * [NEW] Check if user can edit data
 * Viewers and Guests cannot edit, only workflow users can
 * @param {Object} user - User object
 * @returns {boolean} True if user can edit
 */
function canEdit(user) {
  // Viewers and Guests cannot edit
  if (isViewer(user) || isGuest(user)) return false;

  // Users with workflow roles can edit
  return userHasRole(user, ROLES.PREPARED) ||
         userHasRole(user, ROLES.CHECKED) ||
         userHasRole(user, ROLES.APPROVED);
}

/**
 * [NEW] Check if user can view all approved documents (all Process Codes)
 * Guests can see all approved docs regardless of Process_Code
 * Viewers are restricted by Allowed_Process_Codes
 * @param {Object} user - User object
 * @returns {boolean} True if user can view all approved
 */
function canViewAllApproved(user) {
  return isGuest(user);
}

/**
 * Helper function: Create fallback user info
 */
function createFallbackUserInfo(email) {
  const fallbackEmail = email || 'unknown@example.com';
  return {
    email: fallbackEmail,
    displayName: fallbackEmail.split('@')[0],
    roles: [],
    department: null,
    canApproveWithNotification: false,
    canCheckWithNotification: false,
    priority: 'Primary',
    notifyOnAssign: true,
    notifyOnComplete: false,
    isActive: false,
    allowedProcessCodes: null
  };
}

/**
 * Helper function: Check for true value
 */
function isTrueValue(value) {
  if (value === null || value === undefined) return false;
  return value === true || value === 'Yes' || value === 'TRUE' || value === '1' || value === 'ใช่';
}

// ================================================================= //
//          PROCESS CODE ACCESS CONTROL FUNCTIONS                  //
// ================================================================= //

/**
 * Check if user has access to a specific Process Code
 * @param {Object} user - User object from getUserInfo()
 * @param {string} processCode - Process Code to check
 * @returns {boolean} True if user has access
 */
function hasProcessCodeAccess(user, processCode) {
  // If user has no roles, deny access
  if (!user.roles || user.roles.length === 0) {
    return false;
  }

  // If allowedProcessCodes is not set or is '*', grant full access
  if (!user.allowedProcessCodes || user.allowedProcessCodes === '*') {
    return true;
  }

  // Check if Process Code is in the allowed list
  const allowedCodes = String(user.allowedProcessCodes)
    .split(',')
    .map(c => c.trim());

  return allowedCodes.includes(String(processCode).trim());
}

/**
 * Get list of allowed Process Codes for a user
 * @param {Object} user - User object from getUserInfo()
 * @returns {Array|null} Array of allowed Process Codes, or null for full access
 */
function getAllowedProcessCodes(user) {
  // If user has no roles, return empty array
  if (!user.roles || user.roles.length === 0) {
    return [];
  }

  // If allowedProcessCodes is not set or is '*', return null (full access)
  if (!user.allowedProcessCodes || user.allowedProcessCodes === '*') {
    return null; // null means "all access"
  }

  // Return array of allowed Process Codes
  return String(user.allowedProcessCodes)
    .split(',')
    .map(c => c.trim())
    .filter(c => c !== '');
}

/**
 * Check if user is a limited user (has Process Code restrictions)
 * @param {Object} user - User object from getUserInfo()
 * @returns {boolean} True if user has Process Code restrictions
 */
function isLimitedUser(user) {
  // If user has no roles, they're blocked (not limited)
  if (!user.roles || user.roles.length === 0) {
    return false;
  }

  // If allowedProcessCodes is not set or is '*', user is not limited
  if (!user.allowedProcessCodes || user.allowedProcessCodes === '*') {
    return false;
  }

  // User has specific Process Code restrictions
  return true;
}

/**
 * Update user's allowed Process Codes and invalidate cache
 * @param {string} email - User email
 * @param {string} newProcessCodes - New Process Codes (e.g., "1021,1022" or "*")
 * @returns {Object} Success status
 */
function updateUserProcessCodeAccess(email, newProcessCodes) {
  try {
    const sheet = dataSs.getSheetByName('AuthorizedUsers');
    if (!sheet) {
      throw new Error('AuthorizedUsers sheet not found');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const emailIndex = headers.indexOf('Email');
    const processCodeIndex = headers.indexOf('Allowed_Process_Codes');

    if (emailIndex === -1 || processCodeIndex === -1) {
      throw new Error('Required columns not found in AuthorizedUsers sheet');
    }

    let updated = false;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][emailIndex]) === email) {
        sheet.getRange(i + 1, processCodeIndex + 1).setValue(newProcessCodes);
        updated = true;
        break;
      }
    }

    if (!updated) {
      throw new Error(`User ${email} not found in AuthorizedUsers sheet`);
    }

    // Invalidate user cache to force reload
    invalidateUserCache(email);

    Logger.log(`Updated Process Code access for ${email}: ${newProcessCodes}`);
    return {
      success: true,
      message: `Access updated successfully for ${email}`
    };

  } catch (e) {
    Logger.log(`updateUserProcessCodeAccess Error: ${e.message}`);
    return { success: false, error: e.message };
  }
}

// ================================================================= //
//                    CACHE MANAGEMENT FUNCTIONS                    //
// ================================================================= //

/**
 * Invalidate cache for a specific user
 * Call this when user permissions are modified
 * @param {string} userEmail - Email of user whose cache should be cleared
 */
function invalidateUserCache(userEmail) {
  try {
    const cache = CacheService.getScriptCache();
    const cacheKey = `user_${userEmail}`;
    cache.remove(cacheKey);
    Logger.log(`[CACHE INVALIDATED] Cache cleared for user: ${userEmail}`);
    return true;
  } catch (e) {
    Logger.log(`[CACHE ERROR] Failed to invalidate cache for ${userEmail}: ${e.message}`);
    return false;
  }
}

/**
 * Invalidate all user caches
 * Call this when AuthorizedUsers sheet is modified significantly
 * Note: CacheService doesn't support wildcard removal, so we track users
 */
function invalidateAllUserCache() {
  try {
    const cache = CacheService.getScriptCache();

    // Get all users from AuthorizedUsers sheet
    const sheet = dataSs.getSheetByName('AuthorizedUsers');
    if (!sheet) {
      Logger.log('[CACHE WARNING] AuthorizedUsers sheet not found');
      return false;
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const emailIndex = headers.indexOf('Email');

    if (emailIndex === -1) {
      Logger.log('[CACHE WARNING] Email column not found');
      return false;
    }

    const uniqueEmails = new Set();
    for (let i = 1; i < data.length; i++) {
      const email = data[i][emailIndex];
      if (email) {
        uniqueEmails.add(String(email));
      }
    }

    // Remove cache for each user
    let count = 0;
    uniqueEmails.forEach(email => {
      const cacheKey = `user_${email}`;
      cache.remove(cacheKey);
      count++;
    });

    Logger.log(`[CACHE INVALIDATED] Cleared cache for ${count} users`);
    return true;

  } catch (e) {
    Logger.log(`[CACHE ERROR] Failed to invalidate all caches: ${e.message}`);
    return false;
  }
}

/**
 * Refresh cache for a specific user
 * Loads fresh data from sheet and updates cache
 * @param {string} userEmail - Email of user whose cache should be refreshed
 * @returns {Object} Updated user data
 */
function refreshUserCache(userEmail) {
  try {
    // Invalidate old cache
    invalidateUserCache(userEmail);

    // Load fresh data (will automatically cache)
    const userData = getUserInfo(userEmail);

    Logger.log(`[CACHE REFRESHED] Cache refreshed for user: ${userEmail}`);
    return userData;

  } catch (e) {
    Logger.log(`[CACHE ERROR] Failed to refresh cache for ${userEmail}: ${e.message}`);
    return createFallbackUserInfo(userEmail);
  }
}

/**
 * Get cache statistics for debugging
 * @returns {Object} Cache statistics
 */
function getCacheStats() {
  try {
    const sheet = dataSs.getSheetByName('AuthorizedUsers');
    if (!sheet) {
      return { error: 'AuthorizedUsers sheet not found' };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const emailIndex = headers.indexOf('Email');

    const uniqueEmails = new Set();
    for (let i = 1; i < data.length; i++) {
      const email = data[i][emailIndex];
      if (email) uniqueEmails.add(String(email));
    }

    const cache = CacheService.getScriptCache();
    let cachedCount = 0;

    uniqueEmails.forEach(email => {
      const cacheKey = `user_${email}`;
      if (cache.get(cacheKey)) {
        cachedCount++;
      }
    });

    return {
      totalUsers: uniqueEmails.size,
      cachedUsers: cachedCount,
      cacheHitRate: `${((cachedCount / uniqueEmails.size) * 100).toFixed(2)}%`,
      cacheTTL: '3600 seconds (1 hour)'
    };

  } catch (e) {
    return { error: e.message };
  }
}

/**
 * ฟังก์ชันชั่วคราวสำหรับล้าง Cache ของฉันโดยเฉพาะ
 */
function myTemp_ClearMyCache() {
  // ❗❗ ---> กรุณาแก้ไขอีเมลใน "" ให้เป็นอีเมลของคุณ
  const myEmail = "apisit.su@minebea.co.th"; 

  // --- (โลจิกด้านล่างนี้คัดลอกมาจาก invalidateUserCache) ---
  try {
    const cache = CacheService.getScriptCache(); // [cite: 286]
    const cacheKey = `user_${myEmail}`; // [cite: 287]
    cache.remove(cacheKey); // [cite: 287]

    // ให้ไปดูผลลัพธ์ใน Log
    Logger.log(`[CACHE INVALIDATED] บังคับล้าง Cache สำเร็จสำหรับ: ${myEmail}`); // [cite: 287]

  } catch (e) {
    Logger.log(`[CACHE ERROR] ล้มเหลวในการล้าง Cache ของ: ${myEmail}: ${e.message}`); // [cite: 288]
  }
}