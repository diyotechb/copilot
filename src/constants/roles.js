/**
 * Centralized user roles for consistent access control.
 */
export const ROLES = {
    ADMIN: 'ADMIN',
    SUPER_ADMIN: 'SUPER_ADMIN',
    DIYO_EMP: 'DIYO_EMP',
    COPILOT_USER: 'COPILOT_USER',
    DIYO_EXTERNAL: 'DIYO_EXTERNAL'
};

/**
 * Common role groupings
 */
export const ROLE_GROUPS = {
    // Internal staff roles with higher privileges
    STAFF: [ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.DIYO_EMP],

    // All users who are allowed to use the core application features
    ALL_AUTHORIZED: [
        ROLES.ADMIN,
        ROLES.SUPER_ADMIN,
        ROLES.DIYO_EMP,
        ROLES.COPILOT_USER,
        ROLES.DIYO_EXTERNAL
    ]
};

/**
 * Robustly check if a user has at least one of the required roles.
 * Normalizes both user roles and required roles to uppercase and trims whitespace.
 * 
 * @param {Array|String} userRoles - The roles assigned to the user
 * @param {Array} requiredRoles - The roles required to access a resource
 * @returns {Boolean}
 */
export const hasAnyRole = (userRoles, requiredRoles) => {
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const normalizedUserRoles = (Array.isArray(userRoles) ? userRoles : [userRoles])
        .filter(r => !!r)
        .map(r => String(r).trim().toUpperCase());

    const normalizedRequiredRoles = requiredRoles.map(r => String(r).trim().toUpperCase());

    return normalizedUserRoles.some(role => normalizedRequiredRoles.includes(role));
};
