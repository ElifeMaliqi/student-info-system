import { User, SystemRole, RolePermission } from '../types';

export interface PermissionContext {
  user: User & { systemRole?: SystemRole };
  roles?: SystemRole[];
}

/**
 * Check if a user has permission to perform an action on a module
 */
export const hasPermission = (
  context: PermissionContext,
  module: string,
  action: string
): boolean => {
  // Superadmin always has access
  if (context.user?.role === 'superadmin') {
    return true;
  }

  // Check if user's role has the permission
  if (context.user?.systemRole?.permissions) {
    const modulePerms = context.user.systemRole.permissions.find(
      (p: any) => p.module === module
    );
    if (modulePerms?.actions?.includes(action)) {
      return true;
    }
  }

  return false;
};

/**
 * Check if a user has access to a module
 */
export const hasModuleAccess = (
  context: PermissionContext,
  module: string
): boolean => {
  // Superadmin always has access
  if (context.user?.role === 'superadmin') {
    return true;
  }

  // Check if user's role has any permission for this module
  if (context.user?.systemRole?.permissions) {
    return context.user.systemRole.permissions.some(
      (p: any) => p.module === module && p.actions && p.actions.length > 0
    );
  }

  return false;
};

/**
 * Get all allowed actions for a user on a module
 */
export const getAllowedActions = (
  context: PermissionContext,
  module: string
): string[] => {
  // Superadmin has all actions
  if (context.user?.role === 'superadmin') {
    return ['create', 'read', 'update', 'delete', 'deactivate'];
  }

  // Get actions from user's role
  if (context.user?.systemRole?.permissions) {
    const modulePerms = context.user.systemRole.permissions.find(
      (p: any) => p.module === module
    );
    return modulePerms?.actions || [];
  }

  return [];
};

/**
 * Check if user can perform specific operations
 */
export const canCreate = (context: PermissionContext, module: string): boolean =>
  hasPermission(context, module, 'create');

export const canRead = (context: PermissionContext, module: string): boolean =>
  hasPermission(context, module, 'read');

export const canUpdate = (context: PermissionContext, module: string): boolean =>
  hasPermission(context, module, 'update');

export const canDelete = (context: PermissionContext, module: string): boolean =>
  hasPermission(context, module, 'delete');

export const canDeactivate = (context: PermissionContext, module: string): boolean =>
  hasPermission(context, module, 'deactivate');
