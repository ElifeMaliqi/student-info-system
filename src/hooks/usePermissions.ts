import { useContext } from 'react';
import { UserContext } from '../context/UserContext';
import {
  hasPermission,
  hasModuleAccess,
  getAllowedActions,
  canCreate,
  canRead,
  canUpdate,
  canDelete,
  canDeactivate,
  PermissionContext,
} from '../utils/permissions';

/**
 * Hook to check user permissions in components
 */
export const usePermissions = () => {
  const { user } = useContext(UserContext);

  if (!user) {
    return {
      user: null,
      hasPermission: () => false,
      hasModuleAccess: () => false,
      getAllowedActions: () => [],
      canCreate: () => false,
      canRead: () => false,
      canUpdate: () => false,
      canDelete: () => false,
      canDeactivate: () => false,
    };
  }

  const context: PermissionContext = { user: user as any };

  return {
    user,
    hasPermission: (module: string, action: string) =>
      hasPermission(context, module, action),
    hasModuleAccess: (module: string) =>
      hasModuleAccess(context, module),
    getAllowedActions: (module: string) =>
      getAllowedActions(context, module),
    canCreate: (module: string) =>
      canCreate(context, module),
    canRead: (module: string) =>
      canRead(context, module),
    canUpdate: (module: string) =>
      canUpdate(context, module),
    canDelete: (module: string) =>
      canDelete(context, module),
    canDeactivate: (module: string) =>
      canDeactivate(context, module),
  };
};

/**
 * HOC to protect routes based on permissions
 */
export const withPermissionCheck = <P extends object>(
  Component: React.ComponentType<P>,
  requiredModule: string,
  requiredAction: string = 'read'
) => {
  return function ProtectedComponent(props: P) {
    const permissions = usePermissions();

    if (!permissions.user) {
      return <div className="p-6 text-center text-red-600">Authentication required</div>;
    }

    if (!permissions.hasPermission(requiredModule, requiredAction)) {
      return (
        <div className="p-6 text-center text-red-600">
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p>You do not have permission to access this resource.</p>
        </div>
      );
    }

    return <Component {...props} />;
  };
};
