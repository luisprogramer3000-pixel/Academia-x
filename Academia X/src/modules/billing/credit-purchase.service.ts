import { prisma } from "@/lib/db";
import { getTopUpPackage } from "@/modules/ai/ai.topup-catalog";
import { AICreditEngine, AICreditError } from "@/modules/ai/ai.credit-engine";
import { NotificationService } from "@/modules/notifications/notification.service";
import { MockPaymentProvider } from "./mock-payment-provider";
import { StripePaymentProvider } from "./stripe-payment-provider";
import { isMockPaymentsMode } from "@/lib/stripe";

export class CreditPurchaseService {
  /**
   * Stripe en producción; proveedor simulado solo en desarrollo sin STRIPE_SECRET_KEY.
   */
  private static getPaymentProvider() {
    return isMockPaymentsMode()
      ? { name: "mock", provider: new MockPaymentProvider() }
      : { name: "stripe", provider: new StripePaymentProvider() };
  }

  /**
   * Crea una intención de compra atómica para un paquete Top-Up.
   * Resuelve los datos del paquete autoritativamente en el servidor.
   */
  static async createPurchaseIntent(input: {
    tenantId: string;
    userId?: string;
    packageId: string;
    customerEmail?: string;
  }) {
    if (!input.tenantId) {
      throw new Error("TENANT_REQUIRED");
    }

    const pkg = getTopUpPackage(input.packageId);
    if (!pkg) {
      throw new Error("INVALID_TOPUP_PACKAGE");
    }

    // Validar existencia del Tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: input.tenantId },
    });
    if (!tenant) {
      throw new Error(AICreditError.TENANT_NOT_FOUND);
    }

    // Validar pertenencia del usuario si se especifica
    if (input.userId) {
      const membership = await prisma.membership.findUnique({
        where: {
          userId_tenantId: {
            userId: input.userId,
            tenantId: input.tenantId,
          },
        },
      });
      if (!membership) {
        throw new Error(AICreditError.USER_NOT_IN_TENANT);
      }
    }

    const idempotencyKey = `topup_intent:${input.tenantId}:${pkg.id}:${Date.now()}:${Math.random().toString(36).substring(2, 7)}`;

    // Crear registro de compra en estado PENDING
    const purchase = await prisma.aICreditPurchase.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId || null,
        packageId: pkg.id,
        creditType: pkg.creditType,
        creditsGranted: pkg.credits,
        priceAmount: pkg.price,
        currency: pkg.currency,
        status: "PENDING",
        provider: this.getPaymentProvider().name,
        idempotencyKey,
        metadata: {
          packageName: pkg.name,
          packageDescription: pkg.description,
        },
      },
    });

    // Iniciar Checkout Session en el proveedor de pagos
    const checkoutResult = await this.getPaymentProvider().provider.createCheckoutSession({
      tenantId: input.tenantId,
      userId: input.userId,
      packageId: pkg.id,
      packageName: pkg.name,
      customerEmail: input.customerEmail,
      amount: pkg.price,
      currency: pkg.currency,
      idempotencyKey: purchase.id,
    });

    // Actualizar providerPaymentId en la compra
    await prisma.aICreditPurchase.update({
      where: { id: purchase.id },
      data: {
        providerPaymentId: checkoutResult.providerPaymentId,
      },
    });

    return {
      purchaseId: purchase.id,
      providerPaymentId: checkoutResult.providerPaymentId,
      checkoutUrl: checkoutResult.checkoutUrl,
      status: "PENDING",
      pkg,
    };
  }

  /**
   * Cumple una compra de forma idempotente tras confirmarse el pago.
   * Concede los créditos en la billetera y notifica al usuario.
   */
  static async fulfillPurchase(input: {
    providerPaymentId?: string;
    purchaseId?: string;
    idempotencyKey?: string;
  }) {
    let purchase = null;

    if (input.providerPaymentId) {
      purchase = await prisma.aICreditPurchase.findUnique({
        where: { providerPaymentId: input.providerPaymentId },
      });
    } else if (input.purchaseId) {
      purchase = await prisma.aICreditPurchase.findUnique({
        where: { id: input.purchaseId },
      });
    } else if (input.idempotencyKey) {
      purchase = await prisma.aICreditPurchase.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
    }

    if (!purchase) {
      throw new Error("PURCHASE_NOT_FOUND");
    }

    // 1. Verificación de idempotencia: Si la compra ya se completó previamente
    if (purchase.status === "COMPLETED") {
      return {
        success: true,
        alreadyProcessed: true,
        purchaseId: purchase.id,
        creditsGranted: purchase.creditsGranted,
        creditType: purchase.creditType,
      };
    }

    // 2. Transacción Atómica: Cambiar estado a COMPLETED y otorgar créditos en AICreditEngine
    try {
      await prisma.aICreditPurchase.update({
        where: { id: purchase.id },
        data: {
          status: "COMPLETED",
        },
      });

      // Otorgar créditos en AICreditWallet y registrar en el ledger
      const grantResult = await AICreditEngine.grantPurchasedCredits({
        tenantId: purchase.tenantId,
        userId: purchase.userId || undefined,
        creditType: purchase.creditType,
        amount: purchase.creditsGranted,
        referenceId: purchase.id,
        idempotencyKey: `grant_purchase:${purchase.id}`,
        metadata: {
          packageId: purchase.packageId,
          priceAmount: Number(purchase.priceAmount),
          providerPaymentId: purchase.providerPaymentId,
        },
      });

      // Notificar al usuario/tenant
      await NotificationService.notifyTopUpPurchased(
        purchase.tenantId,
        purchase.userId || undefined,
        purchase.creditType,
        purchase.creditsGranted,
        purchase.id
      ).catch((err) => {
        console.warn("Could not send topup purchase notification:", err);
      });

      return {
        success: true,
        alreadyProcessed: false,
        purchaseId: purchase.id,
        creditsGranted: purchase.creditsGranted,
        creditType: purchase.creditType,
        grantResult,
      };
    } catch (err: any) {
      // Manejo de errores concurrentes
      if (err.code === "P2002") {
        const recheck = await prisma.aICreditPurchase.findUnique({
          where: { id: purchase.id },
        });
        return {
          success: true,
          alreadyProcessed: true,
          purchaseId: purchase.id,
          creditsGranted: recheck?.creditsGranted || purchase.creditsGranted,
          creditType: purchase.creditType,
        };
      }
      throw err;
    }
  }

  /**
   * Marca una compra como fallida.
   */
  static async failPurchase(purchaseId: string, reason?: string) {
    return prisma.aICreditPurchase.update({
      where: { id: purchaseId },
      data: {
        status: "FAILED",
        metadata: {
          failReason: reason || "Payment failed",
        },
      },
    });
  }

  /**
   * Obtiene el historial de compras de paquetes Top-Up para un tenant.
   */
  static async getTenantPurchaseHistory(tenantId: string, limit = 20) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new Error(AICreditError.TENANT_NOT_FOUND);
    }

    return prisma.aICreditPurchase.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
    });
  }
}
