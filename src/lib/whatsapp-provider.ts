import { WhatsAppProviderConfig } from "./admin-types";

export interface WhatsAppMessagePayload {
  phone: string;
  message: string;
}

/**
 * Interface that all WhatsApp providers must implement.
 * This decoupled architecture allows swapping providers (Evolution API, Meta, Custom)
 * without rewriting the core business logic.
 */
export interface WhatsAppProvider {
  sendMessage(config: WhatsAppProviderConfig, payload: WhatsAppMessagePayload): Promise<boolean>;
  testConnection(config: WhatsAppProviderConfig): Promise<boolean>;
}

export const whatsappTemplates = {
  orderReceived: (orderNumber: number) =>
    `Recebemos seu pedido #${orderNumber}. Estamos analisando.`,

  orderConfirmed: (orderNumber: number) =>
    `Seu pedido #${orderNumber} foi confirmado e já está em preparo.`,

  orderReady: (orderNumber: number) =>
    `Seu pedido #${orderNumber} está pronto e será encaminhado para entrega.`,

  orderDispatched: (orderNumber: number) => `Seu pedido #${orderNumber} saiu para entrega.`,

  orderCompleted: (orderNumber: number) =>
    `Seu pedido #${orderNumber} foi marcado como concluído. Obrigado por comprar com a Skina do Frango & Assados!`,

  driverAssignment: (
    orderNumber: number,
    customerName: string,
    address: string,
    reference: string | null,
  ) =>
    `Olá! Você tem uma nova entrega da Skina do Frango & Assados.\n\nPedido: #${orderNumber}\nCliente: ${customerName}\nEndereço: ${address}${reference ? `\nReferência: ${reference}` : ""}\n\nConfira os detalhes no painel.`,
};

/**
 * Fallback link generator for manual WhatsApp communication via wa.me
 */
export function getWhatsAppDirectLink(phone: string, message?: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${text}`;
}

export class MetaOfficialProvider implements WhatsAppProvider {
  async sendMessage(
    config: WhatsAppProviderConfig,
    payload: WhatsAppMessagePayload,
  ): Promise<boolean> {
    if (!config.endpoint || !config.api_token) return false;
    // Implementation for Meta Official API
    // Example: fetch(config.endpoint, { headers: { Authorization: \`Bearer \${config.api_token}\` }, ... })
    console.log("Mock sending via Meta Official:", payload);
    return true; // Mocked for now
  }

  async testConnection(config: WhatsAppProviderConfig): Promise<boolean> {
    if (!config.endpoint || !config.api_token) return false;
    // Mock implementation
    return true;
  }
}

export class EvolutionApiProvider implements WhatsAppProvider {
  async sendMessage(
    config: WhatsAppProviderConfig,
    payload: WhatsAppMessagePayload,
  ): Promise<boolean> {
    if (!config.endpoint || !config.api_token) return false;
    console.log("Mock sending via Evolution API:", payload);
    return true; // Mocked for now
  }

  async testConnection(config: WhatsAppProviderConfig): Promise<boolean> {
    if (!config.endpoint || !config.api_token) return false;
    // Mock implementation
    return true;
  }
}

export function getProviderInstance(providerName: string): WhatsAppProvider | null {
  switch (providerName) {
    case "meta_official":
      return new MetaOfficialProvider();
    case "evolution_api":
      return new EvolutionApiProvider();
    default:
      return null;
  }
}

export async function sendWhatsAppMessage(
  config: WhatsAppProviderConfig | null,
  payload: WhatsAppMessagePayload,
): Promise<boolean> {
  if (!config || !config.is_connected) {
    console.warn("WhatsApp is not configured or not connected.");
    return false;
  }

  const provider = getProviderInstance(config.provider_name);
  if (!provider) {
    console.error(`Provider ${config.provider_name} not implemented.`);
    return false;
  }

  return provider.sendMessage(config, payload);
}
