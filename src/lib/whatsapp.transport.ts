import type {
  WhatsAppConfig,
  WhatsAppSecrets,
  WhatsAppTemplate,
  WhatsAppOutbound,
} from "./whatsapp.types";
export class WhatsAppError extends Error {
  constructor(
    message: string,
    public retryable = false,
    public uncertain = false,
  ) {
    super(message);
  }
}
export function createWhatsAppTransport(request: typeof fetch = fetch) {
  async function call(
    config: WhatsAppConfig,
    secrets: WhatsAppSecrets,
    path: string,
    body?: object | FormData,
  ) {
    if (!/^v\d{2}\.0$/.test(config.apiVersion))
      throw new WhatsAppError("Informe uma versão vigente da Graph API.");
    if (!secrets.token) throw new WhatsAppError("Token oficial não configurado.");
    let response: Response;
    try {
      response = await request(`https://graph.facebook.com/${config.apiVersion}/${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${secrets.token}`,
          ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        },
        ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(20000),
        redirect: "error",
      });
    } catch {
      throw new WhatsAppError(
        "Sem confirmação da Meta. Envio precisa de conferência antes de nova tentativa.",
        false,
        !!body,
      );
    }
    if (!response.ok)
      throw new WhatsAppError(
        `Meta recusou a solicitação (HTTP ${response.status}).`,
        response.status === 429,
        !!body && response.status >= 500,
      );
    try {
      return await response.json();
    } catch {
      throw new WhatsAppError("Resposta da Meta inválida.", false, !!body);
    }
  }
  return {
    async test(config: WhatsAppConfig, secrets: WhatsAppSecrets) {
      const phones = await call(
        config,
        secrets,
        `${config.wabaId}/phone_numbers?fields=id,display_phone_number`,
      );
      const phone = Array.isArray(phones.data)
        ? phones.data.find((p: { id?: string }) => p.id === config.phoneId)
        : null;
      if (!phone)
        throw new WhatsAppError("Phone Number ID não pertence à conta WhatsApp informada.");
      return { displayPhone: String(phone.display_phone_number || "").slice(0, 50) };
    },
    async templates(config: WhatsAppConfig, secrets: WhatsAppSecrets): Promise<WhatsAppTemplate[]> {
      const all: WhatsAppTemplate[] = [];
      let after = "";
      for (let page = 0; page < 20; page++) {
        const data = await call(
          config,
          secrets,
          `${config.wabaId}/message_templates?fields=id,name,language,status,category,components&limit=100${after ? `&after=${encodeURIComponent(after)}` : ""}`,
        );
        for (const template of Array.isArray(data.data) ? data.data : []) {
          if (!/^[a-z0-9_]{1,512}$/.test(template.name || "")) continue;
          const components = Array.isArray(template.components) ? template.components : [];
          const body = components.find((c: { type?: string }) => c.type === "BODY")?.text || "";
          const variables = [...String(body).matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
          const usable = components.every(
            (c: { type?: string; format?: string; text?: string }) =>
              c.type === "BODY" ||
              c.type === "FOOTER" ||
              (c.type === "HEADER" && c.format === "TEXT" && !c.text?.includes("{{")),
          );
          all.push({
            id: String(template.id).slice(0, 100),
            name: template.name,
            language: String(template.language || "").slice(0, 30),
            status: String(template.status || "UNKNOWN"),
            category: String(template.category || ""),
            body: String(body).slice(0, 4096),
            variables: Math.max(0, ...variables),
            usable:
              usable &&
              variables.length <= 8 &&
              Math.max(0, ...variables) <= 8 &&
              !/\{\{[^0-9]/.test(body),
          });
        }
        after =
          data.paging?.next && typeof data.paging?.cursors?.after === "string"
            ? data.paging.cursors.after
            : "";
        if (!after) return all;
      }
      throw new WhatsAppError("Mais de 2.000 templates. Refine a conta antes de sincronizar.");
    },
    async send(config: WhatsAppConfig, secrets: WhatsAppSecrets, job: WhatsAppOutbound) {
      const payload = job.template
        ? {
            type: "template",
            template: {
              name: job.template.name,
              language: { code: job.template.language },
              ...(job.template.parameters.length
                ? {
                    components: [
                      {
                        type: "body",
                        parameters: job.template.parameters.map((text) => ({ type: "text", text })),
                      },
                    ],
                  }
                : {}),
            },
          }
        : job.media
          ? {
              type: job.media.type,
              [job.media.type]: {
                id: job.media.id,
                ...(job.media.type === "document" ? { filename: job.media.filename } : {}),
              },
            }
          : { type: "text", text: { body: job.text, preview_url: false } };
      const result = await call(config, secrets, `${config.phoneId}/messages`, {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: job.phone,
        biz_opaque_callback_data: job.id,
        ...payload,
      });
      const id = result.messages?.[0]?.id;
      if (typeof id !== "string" || !id.startsWith("wamid."))
        throw new WhatsAppError("Meta não confirmou identificador da mensagem.", false, true);
      return { id };
    },
    async media(config: WhatsAppConfig, secrets: WhatsAppSecrets, id: string) {
      if (!/^\d{5,40}$/.test(id)) throw new WhatsAppError("Identificador de mídia inválido.");
      const meta = await call(config, secrets, `${id}?phone_number_id=${config.phoneId}`);
      const mime = String(meta.mime_type || "");
      if (
        ![
          "image/jpeg",
          "image/png",
          "audio/ogg",
          "audio/mpeg",
          "audio/mp4",
          "audio/aac",
          "application/pdf",
        ].includes(mime) ||
        Number(meta.file_size) > 8 * 1024 * 1024
      )
        throw new WhatsAppError("Formato ou tamanho de mídia não suportado (limite: 8 MB).");
      const url = new URL(String(meta.url || ""));
      if (
        url.protocol !== "https:" ||
        !["lookaside.fbsbx.com", "lookaside.facebook.com"].includes(url.hostname)
      )
        throw new WhatsAppError("Origem de mídia não autorizada.");
      const response = await request(url, {
        headers: { Authorization: `Bearer ${secrets.token}` },
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok || !response.body) throw new WhatsAppError("Mídia indisponível.");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.length;
          if (size > 8 * 1024 * 1024) throw new WhatsAppError("Mídia excedeu 8 MB.");
          chunks.push(part.value);
        }
      } finally {
        await reader.cancel();
      }
      return { mime, bytes: Buffer.concat(chunks) };
    },
    async upload(config: WhatsAppConfig, secrets: WhatsAppSecrets, file: Blob, name: string) {
      if (
        file.size > 8 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "audio/ogg", "audio/mpeg", "application/pdf"].includes(
          file.type,
        )
      )
        throw new WhatsAppError("Envie JPG, PNG, OGG, MP3 ou PDF com até 8 MB.");
      const form = new FormData();
      form.set("messaging_product", "whatsapp");
      form.set("type", file.type);
      form.set("file", file, name);
      const result = await call(config, secrets, `${config.phoneId}/media`, form);
      if (typeof result.id !== "string" || !/^\d+$/.test(result.id))
        throw new WhatsAppError("Upload não confirmado.");
      return { id: result.id };
    },
  };
}
