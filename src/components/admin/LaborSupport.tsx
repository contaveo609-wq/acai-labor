import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { toast } from "sonner";
import {
  supportInbox,
  supportControl,
  supportReply,
  supportConfig,
  supportSaveConfig,
  supportReplaceKey,
  supportModels,
  supportTest,
} from "@/lib/labor.functions";
import { DEFAULT_SUPPORT, type SupportConfig } from "@/lib/support.types";
import "@/styles/support.css";
import { WhatsAppComposer } from "./WhatsAppComposer";
import { waDownloadMedia } from "@/lib/whatsapp.functions";

const modes = {
  automatic: "Automático",
  waiting: "Aguardando atendente",
  human: "Atendimento humano",
  closed: "Encerrado",
};
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Não foi possível concluir. Tente novamente.";

export function LaborSupportInbox({ channel = "all" }: { channel?: "all" | "whatsapp" }) {
  const qc = useQueryClient();
  const {
    data: conversations = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["labor-support"],
    queryFn: () => supportInbox(),
    refetchInterval: 3000,
    retry: false,
  });
  const [selected, setSelected] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const pending = useRef<{ id: string; messageId: string; text: string } | null>(null);
  const channelConversations = conversations.filter((item) => channel === "all" || item.channel === "whatsapp");
  const c = channelConversations.find((item) => item.id === selected);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [c?.messages.length, c?.id]);
  async function control(action: "claim" | "resume" | "close") {
    if (!c) return;
    setBusy(true);
    try {
      await supportControl({ data: { id: c.id, action } });
      await qc.invalidateQueries({ queryKey: ["labor-support"] });
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        {channel === "whatsapp" ? "Conversas do WhatsApp" : "Site e WhatsApp"} · histórico por 30 dias · atualização automática.
      </p>
      {channel === "whatsapp" && <div className="operations-grid mb-4"><article><strong>{channelConversations.length}</strong><small>Conversas</small></article><article><strong>{channelConversations.filter((item) => item.mode === "waiting").length}</strong><small>Aguardando equipe</small></article><article><strong>{channelConversations.filter((item) => item.mode === "human").length}</strong><small>Atendimento humano</small></article><article><strong>{channelConversations.filter((item) => item.mode === "automatic").length}</strong><small>Automático</small></article></div>}
      {error && <p role="alert">{errorText(error)}</p>}
      <div className="support-inbox">
        <aside className="support-conversations">
          <input
            aria-label="Buscar conversa"
            placeholder="Buscar no histórico…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Filtrar atendimentos"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Todas as conversas</option>
            {Object.entries(modes).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {isLoading && <p>Carregando…</p>}
          {!channelConversations.length && !isLoading && (
            <p className="text-sm">{channel === "whatsapp" ? "Mensagens recebidas no WhatsApp aparecerão aqui após configurar o webhook." : "As conversas iniciadas no site aparecerão aqui."}</p>
          )}
          {channelConversations
            .filter(
              (c) =>
                (filter === "all" || c.mode === filter) &&
                c.messages.some((m) => m.text.toLowerCase().includes(search.toLowerCase())),
            )
            .map((item) => (
              <button
                className={selected === item.id ? "selected" : ""}
                key={item.id}
                onClick={() => {
                  setSelected(item.id);
                  setText("");
                  pending.current = null;
                }}
              >
                <strong>{item.contact?.name || `Visitante ${item.id.slice(0, 6)}`}</strong>
                <small>
                  {item.channel === "whatsapp" ? `WhatsApp · ${item.contact?.phone}` : "Site"}
                </small>
                <small>{modes[item.mode]}</small>
                <p>{item.messages.at(-1)?.text}</p>
                <small>{new Date(item.updatedAt).toLocaleString("pt-BR")}</small>
              </button>
            ))}
        </aside>
        <section className="support-admin-chat" aria-label="Conversa selecionada">
          {!c ? (
            <p className="p-6 text-sm">
              Selecione uma conversa para acompanhar ou assumir o atendimento.
            </p>
          ) : (
            <>
              <div className="support-admin-toolbar">
                {c.channel === "whatsapp" && (
                  <small>
                    {c.lastInboundAt && Date.parse(c.lastInboundAt) > Date.now() - 86400000
                      ? "WhatsApp · janela de atendimento aberta"
                      : "WhatsApp · template aprovado necessário"}
                  </small>
                )}
                <strong className="text-sm">{modes[c.mode]}</strong>
                {c.mode !== "closed" && (
                  <>
                    <button disabled={busy || c.mode === "human"} onClick={() => control("claim")}>
                      Assumir atendimento
                    </button>
                    <button
                      disabled={busy || c.mode === "automatic"}
                      onClick={() => control("resume")}
                    >
                      Reativar automático
                    </button>
                    <button disabled={busy} onClick={() => control("close")}>
                      Encerrar
                    </button>
                  </>
                )}
              </div>
              <div className="support-history" role="log" aria-label="Mensagens do atendimento">
                {c.messages.map((m) => (
                  <article key={m.id} className={`support-message ${m.role}`}>
                    <span className="support-author">
                      {m.role === "customer"
                        ? "Cliente"
                        : m.role === "human"
                          ? "Equipe Labor"
                          : m.role === "system"
                            ? "Sistema"
                            : "Assistente"}
                    </span>
                    <p>{m.text}</p>
                    {m.delivery && <small>Envio: {m.delivery}</small>}
                    {m.attachment?.available && (
                      <button
                        onClick={async () => {
                          try {
                            const file = await waDownloadMedia({
                              data: { id: c.id, messageId: m.id },
                            });
                            const bytes = Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0));
                            const url = URL.createObjectURL(new Blob([bytes], { type: file.mime }));
                            const link = document.createElement("a");
                            link.href = url;
                            link.download = `arquivo.${({ "image/jpeg": "jpg", "image/png": "png", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac", "application/pdf": "pdf" } as Record<string, string>)[file.mime] || "bin"}`;
                            link.click();
                            setTimeout(() => URL.revokeObjectURL(url), 10000);
                          } catch (e) {
                            toast.error(errorText(e));
                          }
                        }}
                      >
                        Baixar {m.attachment.type} recebida
                      </button>
                    )}
                    {m.cards?.map((p) => (
                      <p key={p.id}>
                        {p.name} · {p.quantity} ×{" "}
                        {p.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </p>
                    ))}
                    <time dateTime={m.at}>
                      {new Date(m.at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </article>
                ))}
                <div ref={end} />
              </div>
              <form
                className="support-compose"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (busy || !text.trim()) return;
                  setBusy(true);
                  const payload =
                    pending.current?.id === c.id && pending.current.text === text.trim()
                      ? pending.current
                      : { id: c.id, messageId: crypto.randomUUID(), text: text.trim() };
                  pending.current = payload;
                  try {
                    await supportReply({ data: payload });
                    setText("");
                    pending.current = null;
                    await qc.invalidateQueries({ queryKey: ["labor-support"] });
                  } catch (e) {
                    toast.error(errorText(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <input
                  aria-label="Resposta ao cliente"
                  disabled={busy || c.mode !== "human"}
                  maxLength={1000}
                  placeholder={
                    c.mode === "human"
                      ? "Escreva sua resposta…"
                      : "Assuma o atendimento para responder"
                  }
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <button
                  aria-label="Enviar resposta"
                  disabled={busy || c.mode !== "human" || !text.trim()}
                >
                  <Send size={18} />
                </button>
              </form>
              {c.channel === "whatsapp" && c.mode === "human" && c.contact && (
                <WhatsAppComposer
                  key={c.id}
                  id={c.id}
                  name={c.contact.name}
                  phone={c.contact.phone}
                  refresh={() => qc.invalidateQueries({ queryKey: ["labor-support"] })}
                />
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}

export function LaborSupportSettings() {
  const qc = useQueryClient();
  const { data, error, isLoading } = useQuery({
    queryKey: ["labor-support-config"],
    queryFn: () => supportConfig(),
    retry: false,
  });
  const [config, setConfig] = useState<SupportConfig>({ ...DEFAULT_SUPPORT });
  const [key, setKey] = useState("");
  const [models, setModels] = useState<Array<{ name: string; displayName: string }>>([]);
  const [busy, setBusy] = useState(false);
  const initialized = useRef(false);
  useEffect(() => {
    if (data && !initialized.current) {
      setConfig(data.config);
      initialized.current = true;
    }
  }, [data]);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["labor-support-config"] });
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const today = data?.usage.find((u) => u.day === new Date().toISOString().slice(0, 10));
  if (isLoading) return <p>Carregando preferências…</p>;
  if (error) return <p role="alert">{errorText(error)}</p>;
  return (
    <div className="support-settings">
      <section className="admin-box">
        <h3>Atendimento do site</h3>
        <p>
          Consulta de catálogo e atendimento humano funcionam localmente. Gemini interpreta
          mensagens quando configurado e ativado.
        </p>
        <label>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
          />
          Ativar atendimento do site
        </label>
        <label>
          Nome da assistente
          <input
            value={config.name}
            maxLength={60}
            onChange={(e) => setConfig({ ...config, name: e.target.value })}
          />
        </label>
        <label>
          Mensagem de boas-vindas
          <textarea
            value={config.greeting}
            maxLength={500}
            onChange={(e) => setConfig({ ...config, greeting: e.target.value })}
          />
        </label>
        <label>
          Teto diário de requisições ao Gemini (UTC)
          <input
            type="number"
            min={1}
            max={10000}
            value={config.dailyLimit}
            onChange={(e) => setConfig({ ...config, dailyLimit: Number(e.target.value) })}
          />
        </label>
        <small>1.500 é limite interno da loja. Cota real depende do modelo e da conta Google.</small>
        <label>
          Limite de respostas por conversa
          <input
            type="number"
            min={1}
            max={100}
            value={config.conversationLimit}
            onChange={(e) => setConfig({ ...config, conversationLimit: Number(e.target.value) })}
          />
        </label>
        <div className="support-settings-actions">
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                await supportSaveConfig({ data: config });
                toast.success("Preferências salvas.");
              })
            }
          >
            Salvar preferências
          </button>
        </div>
      </section>
      <section className="admin-box mt-5">
        <h3>Google Gemini</h3>
        <p>
          {data?.lastTest?.ok
            ? "Último teste concluído com sucesso."
            : "Integração pendente de validação."}{" "}
          {data?.lastTest && new Date(data.lastTest.at).toLocaleString("pt-BR")}
        </p>
        <p>
          {data?.hasKey
            ? "Chave configurada no servidor. O conteúdo nunca é recuperado pelo painel."
            : "Nenhuma chave configurada."}
        </p>
        <label>
          Substituir API key
          <input
            type="password"
            autoComplete="new-password"
            value={key}
            maxLength={250}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Cole uma nova chave para substituir"
          />
        </label>
        <div className="support-settings-actions">
          <button
            disabled={busy || key.trim().length < 20}
            onClick={() =>
              run(async () => {
                await supportReplaceKey({ data: { key: key.trim() } });
                setKey("");
                setConfig((c) => ({ ...c, geminiEnabled: false }));
                toast.success("Chave protegida no servidor. Teste antes de ativar.");
              })
            }
          >
            Guardar chave com proteção
          </button>
          <button
            disabled={busy || !data?.hasKey}
            onClick={() =>
              run(async () => {
                setModels(await supportModels());
                toast.success("Modelos disponíveis atualizados.");
              })
            }
          >
            Consultar modelos disponíveis
          </button>
        </div>
        <label>
          Modelo
          <select
            value={config.model}
            onChange={(e) => setConfig({ ...config, model: e.target.value, geminiEnabled: false })}
          >
            <option value="">Selecione após consultar modelos</option>
            {config.model && !models.some((m) => m.name === config.model) && (
              <option value={config.model}>{config.model}</option>
            )}
            {models.map((m) => (
              <option value={m.name} key={m.name}>
                {m.name === "models/gemini-3.5-flash-lite" ? "Leve · " : m.name === "models/gemini-3.8-flash" ? "Mais inteligente · " : ""}{m.displayName}
              </option>
            ))}
          </select>
        </label>
        <div className="support-settings-actions">
          <button
            disabled={busy || !data?.hasKey || !config.model}
            onClick={() =>
              run(async () => {
                const result = await supportTest({ data: { model: config.model } });
                if (result.ok) toast.success("Modelo respondeu ao teste.");
                else toast.error(result.error);
              })
            }
          >
            Testar modelo
          </button>
        </div>
        {data?.lastTest?.error && <p role="alert">{data.lastTest.error}</p>}
        <label>
          <input
            type="checkbox"
            checked={config.geminiEnabled}
            disabled={!data?.lastTest?.ok || data.lastTest.model !== config.model}
            onChange={(e) => setConfig({ ...config, geminiEnabled: e.target.checked })}
          />
          Ativar Gemini no site
        </label>
        <label>
          <input
            type="checkbox"
            checked={config.whatsappGeminiEnabled || false}
            disabled={!data?.lastTest?.ok || data.lastTest.model !== config.model}
            onChange={(e) => setConfig({ ...config, whatsappGeminiEnabled: e.target.checked })}
          />{" "}
          Ativar Gemini no WhatsApp
        </label>
        <p>
          Salve as preferências para aplicar a ativação. Chamadas podem consumir a cota da sua
          conta. Cota do provedor desconhecida; consulte o Google AI Studio. Custo não calculado.
        </p>
        <label>
          Tom de voz
          <select
            value={config.tone || "direto"}
            onChange={(e) =>
              setConfig({ ...config, tone: e.target.value as SupportConfig["tone"] })
            }
          >
            <option value="direto">Direto</option>
            <option value="acolhedor">Acolhedor</option>
            <option value="formal">Formal</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={config.emojis || false}
            onChange={(e) => setConfig({ ...config, emojis: e.target.checked })}
          />{" "}
          Usar emoji nas respostas
        </label>
        <label>
          <input
            type="checkbox"
            checked={config.businessHoursOnly || false}
            onChange={(e) => setConfig({ ...config, businessHoursOnly: e.target.checked })}
          />{" "}
          Responder automaticamente apenas no horário da loja
        </label>
        <label>
          <input
            type="checkbox"
            checked={config.handoffUnknown || false}
            onChange={(e) => setConfig({ ...config, handoffUnknown: e.target.checked })}
          />{" "}
          Encaminhar dúvidas não reconhecidas para atendente
        </label>
        <label>
          Orientações comerciais para identificar intenção
          <textarea
            value={config.businessInstructions || ""}
            maxLength={1500}
            onChange={(e) => setConfig({ ...config, businessInstructions: e.target.value })}
          />
        </label>
        <label>
          Expressões proibidas nas respostas (uma por linha)
          <textarea
            value={(config.prohibitedMessages || []).join("\n")}
            onChange={(e) =>
              setConfig({
                ...config,
                prohibitedMessages: e.target.value.split("\n").filter(Boolean),
              })
            }
          />
        </label>
        <div className="support-stats">
          <span>{today?.requests || 0} requisições hoje</span>
          <span>{today?.tokens || 0} tokens reportados</span>
          <span>{today?.errors || 0} falhas</span>
          <span>{today?.discarded || 0} respostas descartadas</span>
        </div>
        <p>
          Memória: últimas 5 mensagens e resumo de produtos/quantidade. Dados comerciais vêm do
          servidor. A IA não altera preços nem confirma pagamentos.
        </p>
      </section>
    </div>
  );
}
