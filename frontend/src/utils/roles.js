export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  DEPARTMENT_ADMIN: "DEPARTMENT_ADMIN",
  INSTRUCTOR: "INSTRUCTOR",
  SUBSCRIBER: "SUBSCRIBER",
};

export const ROLE_HOME_ROUTES = {
  [ROLES.SUPER_ADMIN]: "/super-admin",
  [ROLES.DEPARTMENT_ADMIN]: "/department-admin",
  [ROLES.INSTRUCTOR]: "/instructor",
  [ROLES.SUBSCRIBER]: "/subscriber",
};

export function getHomeRouteForRole(role) {
  return ROLE_HOME_ROUTES[role] || "/unauthorized";
}

export function getRoleLabel(role) {
  const labels = {
    [ROLES.SUPER_ADMIN]: "Super Admin",
    [ROLES.DEPARTMENT_ADMIN]: "Department Admin",
    [ROLES.INSTRUCTOR]: "Instructor",
    [ROLES.SUBSCRIBER]: "Subscriber",
  };
  return labels[role] || role;
}