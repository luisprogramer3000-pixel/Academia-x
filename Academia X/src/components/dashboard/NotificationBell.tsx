"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, CheckCheck, Sparkles, AlertTriangle, AlertCircle, RefreshCw, XCircle, UserPlus } from "lucide-react";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/app/actions/notification.actions";

interface NotificationItem {
  id: string;
  tenantId: string;
  type: string;
  creditType: string | null;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface NotificationBellProps {
  tenantId?: string;
}

export function NotificationBell({ tenantId }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const inFlight = useRef(false);

  // GET normal (no acción del servidor): las acciones de una página van en cola,
  // y esta consulta periódica retrasaba los botones de guardar del panel.
  const fetchNotifications = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const res = (await response.json()) as { success: boolean; notifications?: NotificationItem[]; unreadCount?: number };
      if (res.success && res.notifications) {
        setNotifications(res.notifications);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch {
      // Fallo de red o servidor reiniciándose (recompilación, nueva versión publicada):
      // se reintenta en la siguiente consulta sin ensuciar la consola.
    } finally {
      inFlight.current = false;
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Solo consulta con la pestaña visible; al volver a ella, actualiza enseguida
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchNotifications();
    }, 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchNotifications();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    await markNotificationReadAction(tenantId, id);
  };

  const handleMarkAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    await markAllNotificationsReadAction(tenantId);
  };

  const getAlertStyle = (type: string) => {
    switch (type) {
      case "CREDIT_REFUNDED":
        return {
          icon: <RefreshCw className="w-4 h-4 text-emerald-400" />,
          badgeBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        };
      case "CREDIT_EXHAUSTED":
        return {
          icon: <XCircle className="w-4 h-4 text-rose-400" />,
          badgeBg: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        };
      case "CREDIT_CRITICAL":
        return {
          icon: <AlertCircle className="w-4 h-4 text-orange-400" />,
          badgeBg: "bg-orange-500/10 text-orange-400 border-orange-500/20",
        };
      case "SUBSCRIPTION_RENEWED":
        return {
          icon: <CheckCheck className="w-4 h-4 text-emerald-400" />,
          badgeBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        };
      case "SUBSCRIPTION_PAYMENT_FAILED":
        return {
          icon: <XCircle className="w-4 h-4 text-rose-400" />,
          badgeBg: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        };
      case "SUBSCRIPTION_RENEWAL_REMINDER":
        return {
          icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
          badgeBg: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        };
      case "ENROLLMENT_REQUEST":
        return {
          icon: <UserPlus className="w-4 h-4 text-emerald-400" />,
          badgeBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        };
      case "CREDIT_LOW":
      case "CREDIT_WARNING":
        return {
          icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
          badgeBg: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        };
      default:
        return {
          icon: <Sparkles className="w-4 h-4 text-blue-400" />,
          badgeBg: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        };
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón de Campana con Badge Reductivo */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all border border-transparent hover:border-slate-700/50"
        title="Notificaciones"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-lg animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel Desplegable de Notificaciones */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl z-50 overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          {/* Encabezado */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white text-sm">Notificaciones</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {unreadCount} nuevas
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-slate-400 hover:text-blue-400 flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Marcar leídas
              </button>
            )}
          </div>

          {/* Lista de Notificaciones */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/50 custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs font-medium">No tienes notificaciones recientes</p>
              </div>
            ) : (
              notifications.map((item) => {
                const style = getAlertStyle(item.type);
                return (
                  <div
                    key={item.id}
                    onClick={() => !item.read && handleMarkAsRead(item.id)}
                    className={`p-4 transition-colors cursor-pointer flex gap-3 items-start ${
                      item.read ? "bg-slate-900/40 opacity-75 hover:bg-slate-800/40" : "bg-slate-800/30 hover:bg-slate-800/60"
                    }`}
                  >
                    <div className={`p-2 rounded-xl border ${style.badgeBg} shrink-0 mt-0.5`}>
                      {style.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className={`text-xs font-bold truncate ${item.read ? "text-slate-300" : "text-white"}`}>
                          {item.title}
                        </h4>
                        {!item.read && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed mb-1.5">
                        {item.message}
                      </p>
                      <span className="text-[10px] text-slate-500 block font-mono">
                        {new Date(item.createdAt).toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
