"use server";

import { NotificationService } from "@/modules/notifications/notification.service";
import { requireTenantAccess, STAFF_ROLES } from "@/lib/session";

/**
   Obtiene las notificaciones in-app y el conteo no leído para un tenant.
 */
export async function getTenantNotificationsAction(_clientTenantId?: string) {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);

    const data = await NotificationService.getTenantNotifications(tenantId);
    return {
      success: true,
      notifications: data.notifications.map((n) => ({
        id: n.id,
        tenantId: n.tenantId,
        type: n.type,
        creditType: n.creditType,
        title: n.title,
        message: n.message,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount: data.unreadCount,
    };
  } catch (error: any) {
    return { success: false, error: error.message || "FAILED_TO_GET_NOTIFICATIONS" };
  }
}

/**
   Marca una notificación individual como leída.
 */
export async function markNotificationReadAction(_clientTenantId: string | undefined, notificationId: string) {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);
    if (!notificationId) {
      return { success: false, error: "MISSING_PARAMETERS" };
    }

    await NotificationService.markAsRead(tenantId, notificationId);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "FAILED_TO_MARK_READ" };
  }
}

/**
   Marca todas las notificaciones de un tenant como leídas.
 */
export async function markAllNotificationsReadAction(_clientTenantId?: string) {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);

    await NotificationService.markAllAsRead(tenantId);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "FAILED_TO_MARK_ALL_READ" };
  }
}
