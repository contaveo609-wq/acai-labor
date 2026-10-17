import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  operationsSnapshot,
  operationsSave,
  contactSave,
  campaignSave,
  campaignAction,
  loyaltyRedeem,
  notificationRead,
  recoverySave,
} from "@/lib/operations.functions";
import { waConfig } from "@/lib/whatsapp.functions";
import { DEFAULT_OPERATIONS } from "@/lib/operations.types";
import { formatBRL } from "@/lib/menu";
import "@/styles/operations.css";
const segments: Record<string, string> = {
  all: "Todos",
  new: "Novos",
  active: "Ativos",
  recurring: "Recorrentes",
  vip: "VIP",
  inactive: "Inativos",
  promotion: "Compraram com promoção",
  abandoned: "Carrinho abandonado verificado",
  proposal: "Receberam proposta",
};
type Snapshot = Awaited<ReturnType<typeof operationsSnapshot>>;
type Customer = Snapshot["customers"][number];
export function LaborOperations({
  tab,
}: {
  tab:
    | "clientes"
    | "campanhas"
    | "fidelidade"
    | "automacoes"
    | "relatorios"
    | "notificacoes"
    | "integracoes";
}) {
  const { data, error, refetch } = useQuery({
    queryKey: ["labor-operations"],
    queryFn: () => operationsSnapshot(),
    refetchInterval: 10000,
    retry: false,
  });
  const { data: wa } = useQuery({
    queryKey: ["labor-whatsapp"],
    queryFn: () => waConfig(),
    enabled: tab === "campanhas" || tab === "integracoes",
  });
  const [selected, setSelected] = useState(""),
    [search, setSearch] = useState(""),
    [segment, setSegment] = useState("all"),
    [busy, setBusy] = useState(false);
  const [config, setConfig] = useState(DEFAULT_OPERATIONS),
    [loaded, setLoaded] = useState(false);
  const [name, setName] = useState(""),
    [template, setTemplate] = useState(""),
    [parameters, setParameters] = useState<string[]>([]),
    [schedule, setSchedule] = useState("");
  const [minOrders, setMinOrders] = useState(0),
    [minPaidTotal, setMinPaidTotal] = useState(0),
    [includeTags, setIncludeTags] = useState(""),
    [excludeTags, setExcludeTags] = useState(""),
    [favoriteProduct, setFavoriteProduct] = useState("");
  useEffect(() => {
    if (data && !loaded) {
      setConfig(data.config);
      setLoaded(true);
    }
  }, [data, loaded]);
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na operação.");
    } finally {
      setBusy(false);
    }
  }
  if (error)
    return <p role="alert">{error instanceof Error ? error.message : "Falha ao carregar"}</p>;
  if (!data) return <p>Carregando operação…</p>;
  const customer = data.customers.find((c) => c.phone === selected),
    chosen = wa?.templates.find((t) => t.id === template);
  const tags = (value: string) => value.split(",").map((part) => part.trim()).filter(Boolean);
  const include = tags(includeTags), exclude = tags(excludeTags);
  const audience = data.customers.filter((c) =>
    (segment === "all" || c.segments.includes(segment)) &&
    c.paidOrders >= minOrders && c.total >= minPaidTotal &&
    (!include.length || include.some((tag) => c.tags.includes(tag))) &&
    !exclude.some((tag) => c.tags.includes(tag)) &&
    (!favoriteProduct || c.favorites.includes(favoriteProduct)) &&
    c.conversations.length > 0,
  );
  const eligibleAudience = audience.filter((c) => c.consent.at(-1)?.granted === true);
  const sample = eligibleAudience[0];
  return (
    <section className="labor-operations">
      {tab === "automacoes" && <RecoverySettings current={data.recovery} busy={busy} run={run} />}
      {(tab === "clientes" || tab === "fidelidade") && (
        <>
          <p>
            Histórico da loja. Pedidos de demonstração aparecem separados; não geram receita nem
            recompensas.
          </p>
          <div className="operations-filters">
            <input
              aria-label="Buscar cliente"
              placeholder="Nome, telefone ou etiqueta"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label="Segmento"
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
            >
              {Object.entries(segments).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="operations-columns">
            <div>
              {!data.customers.length && (
                <p>Clientes aparecerão após pedidos ou contatos no WhatsApp.</p>
              )}
              {data.customers
                .filter(
                  (c) =>
                    (segment === "all" || c.segments.includes(segment)) &&
                    `${c.name} ${c.phone} ${c.tags.join(" ")}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                )
                .map((c) => (
                  <button
                    className={`customer-row ${selected === c.phone ? "selected" : ""}`}
                    key={c.id}
                    onClick={() => setSelected(c.phone)}
                  >
                    <strong>{c.name}</strong>
                    <span>
                      {c.phone} · {c.segments.map((s) => segments[s]).join(", ")}
                    </span>
                    <small>
                      {c.orderCount} pedidos · {formatBRL(c.total)} pagos · {c.testOrders} testes
                    </small>
                    {tab === "fidelidade" && (
                      <small>
                        {c.points} pontos · {formatBRL(c.cashback)} cashback
                      </small>
                    )}
                  </button>
                ))}
            </div>
            {customer ? (
              <CustomerEditor
                key={customer.id}
                customer={customer}
                loyalty={tab === "fidelidade"}
                busy={busy}
                run={run}
              />
            ) : (
              <p>Selecione um cliente.</p>
            )}
          </div>
        </>
      )}
      {tab === "campanhas" && (
        <>
          <p>
            Somente contatos com autorização registrada. Templates aprovados, limite de frequência e
            saída por “SAIR”. Custos não informados pela API.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!chosen) return;
              void run(async () => {
                await campaignSave({
                  data: {
                    id: crypto.randomUUID(),
                    name,
                    segment: segment as "all",
                    template: chosen.name,
                    language: chosen.language,
                    parameters,
                    filters: { minOrders, minPaidTotal, includeTags: include, excludeTags: exclude, favoriteProduct },
                    scheduledAt: schedule
                      ? new Date(schedule).toISOString()
                      : new Date().toISOString(),
                  },
                });
                setName("");
                toast.success("Rascunho salvo. Revise o público antes de confirmar.");
              });
            }}
          >
            <label>
              Nome da campanha
              <input required value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <fieldset>
              <legend>Filtros avançados do público</legend>
              <div className="operations-grid">
                <label>Compras pagas mínimas<input type="number" min="0" value={minOrders} onChange={(e) => setMinOrders(Number(e.target.value))} /></label>
                <label>Total pago mínimo (R$)<input type="number" min="0" step="0.01" value={minPaidTotal} onChange={(e) => setMinPaidTotal(Number(e.target.value))} /></label>
                <label>Etiqueta incluída (separe por vírgula)<input value={includeTags} onChange={(e) => setIncludeTags(e.target.value)} /></label>
                <label>Etiqueta excluída (separe por vírgula)<input value={excludeTags} onChange={(e) => setExcludeTags(e.target.value)} /></label>
                <label>Produto favorito<select value={favoriteProduct} onChange={(e) => setFavoriteProduct(e.target.value)}><option value="">Qualquer produto</option>{[...new Set(data.customers.flatMap((c) => c.favorites))].sort().map((product) => <option key={product} value={product}>{product}</option>)}</select></label>
              </div>
              <p>{audience.length} contatos no filtro; {eligibleAudience.length} com autorização promocional. Confirmação recalcula público e respeita saída e frequência.</p>
            </fieldset>
            <label>
              Público
              <select value={segment} onChange={(e) => setSegment(e.target.value)}>
                {Object.entries(segments).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Template aprovado
              <select
                required
                value={template}
                onChange={(e) => {
                  setTemplate(e.target.value);
                  setParameters(
                    Array(wa?.templates.find((t) => t.id === e.target.value)?.variables || 0).fill(
                      "",
                    ),
                  );
                }}
              >
                <option value="">Selecione um template sincronizado</option>
                {wa?.templates
                  .filter((t) => t.status === "APPROVED" && t.usable)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {t.language}
                    </option>
                  ))}
              </select>
            </label>
            {parameters.map((p, i) => (
              <label key={i}>
                Parâmetro {i + 1}
                <input
                  required
                  value={p}
                  onChange={(e) =>
                    setParameters(parameters.map((old, k) => (k === i ? e.target.value : old)))
                  }
                />
              </label>
            ))}
            <small>
              Variáveis: {"{nome}"}, {"{favorito}"}, {"{ultima_compra}"}.
            </small>
            {chosen && (
              <blockquote>
                {chosen.body.replace(
                  /\{\{(\d+)\}\}/g,
                  (_, n) => (parameters[Number(n) - 1] || `[parâmetro ${n}]`)
                    .replaceAll("{nome}", sample?.name || "Cliente")
                    .replaceAll("{favorito}", sample?.favorites[0] || "cardápio")
                    .replaceAll("{ultima_compra}", sample?.lastPurchase ? new Date(sample.lastPurchase).toLocaleDateString("pt-BR") : "sem compra registrada"),
                )}
              </blockquote>
            )}
            {sample && <small>Prévia personalizada para {sample.name}. O envio usa dados de cada cliente.</small>}
            <label>
              Agendar (vazio: após confirmação)
              <input
                type="datetime-local"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
              />
            </label>
            <button disabled={busy || !chosen}>Criar rascunho</button>
          </form>
          <div className="operations-grid">
            {data.campaigns.map((c) => (
              <article key={c.id}>
                <h3>{c.name}</h3>
                <p>
                  {c.state} · {c.recipients.length} destinatários ·{" "}
                  {new Date(c.scheduledAt).toLocaleString("pt-BR")}
                </p>
                <p>
                  {c.requested} solicitadas · {c.accepted} aceitas · {c.delivered} entregues ·{" "}
                  {c.read} lidas · {c.failed} falhas/incertas
                </p>
                <details>
                  <summary>Revisar público e mensagem</summary>
                  <p>{c.recipients.join(", ") || "Nenhum contato autorizado"}</p>
                  <p>
                    {c.template} · {c.language}
                  </p>
                  <p>{c.parameters.join(" · ")}</p>
                </details>
                {c.state === "draft" && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(() => campaignAction({ data: { id: c.id, action: "confirm" } }))
                    }
                  >
                    Confirmar envio para {c.recipients.length} contatos
                  </button>
                )}
                {c.state === "scheduled" && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(() => campaignAction({ data: { id: c.id, action: "pause" } }))
                    }
                  >
                    Pausar campanha
                  </button>
                )}
              </article>
            ))}
          </div>
        </>
      )}
      {(tab === "automacoes" || tab === "fidelidade") && (
        <details open={tab === "automacoes"}>
          <summary>Regras de automação e fidelidade</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await operationsSave({ data: config });
                toast.success("Regras salvas.");
              });
            }}
          >
            {(
              [
                ["activeDays", "Dias para considerar cliente inativo"],
                ["vipTotal", "Total pago para VIP (R$)"],
                ["frequencyDays", "Intervalo mínimo entre campanhas (dias)"],
                ["pointsPerReal", "Pontos por real pago"],
                ["cashbackPercent", "Cashback (%)"],
                ["cashbackCap", "Cashback máximo por compra (R$)"],
                ["expiryDays", "Validade das recompensas (dias)"],
                [
                  "closeInactiveHours",
                  "Encerrar conversa automática inativa após horas (0 desativa)",
                ],
                [
                  "pendingPaymentMinutes",
                  "Lembrete interno de pagamento após minutos (0 desativa)",
                ],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="number"
                  min="0"
                  step={key === "cashbackPercent" || key === "pointsPerReal" ? "0.01" : "1"}
                  value={config[key]}
                  onChange={(e) => setConfig({ ...config, [key]: Number(e.target.value) })}
                />
              </label>
            ))}
            <label>
              <input
                type="checkbox"
                checked={config.orderNotifications || false}
                onChange={(e) => setConfig({ ...config, orderNotifications: e.target.checked })}
              />{" "}
              Avisar status dos pedidos do WhatsApp, durante a janela de atendimento
            </label>
            <button disabled={busy}>Salvar regras com MFA</button>
          </form>
          <h3>Execuções</h3>
          {!data.executions.length && <p>Nenhuma automação executada.</p>}
          {data.executions
            .slice()
            .reverse()
            .map((e) => (
              <p key={e.key}>
                {new Date(e.at).toLocaleString("pt-BR")} · {e.action}
              </p>
            ))}
        </details>
      )}
      {tab === "notificacoes" && (
        <>
          <p>Eventos persistidos da loja, com confirmação de leitura.</p>
          {data.notifications
            .slice()
            .reverse()
            .map((n) => (
              <article key={n.id}>
                <strong>{n.action}</strong>
                <p>{n.detail}</p>
                <small>{new Date(n.at).toLocaleString("pt-BR")}</small>
                {!n.read && (
                  <button
                    disabled={busy}
                    onClick={() => run(() => notificationRead({ data: { id: n.id } }))}
                  >
                    Marcar como lida
                  </button>
                )}
              </article>
            ))}
          {!data.notifications.length && <p>Nenhum evento registrado.</p>}
        </>
      )}
      {tab === "relatorios" && (
        <>
          <div className="operations-grid">
            {Object.entries({
              Atendimentos: data.reports.conversations,
              Automáticos: data.reports.automatic,
              Humanos: data.reports.human,
              Aguardando: data.reports.waiting,
              Finalizados: data.reports.closed,
              "Primeira resposta média (s)":
                data.reports.firstResponseSeconds?.toFixed(1) ?? "sem dados",
              "Pedidos WhatsApp": data.reports.whatsappOrders,
              "Pedidos site": data.reports.siteOrders,
              "Pedidos de teste": data.reports.testOrders,
              "Receita real paga": formatBRL(data.reports.paidRevenue),
              "Clientes recorrentes": data.reports.recurring,
              "Tokens reportados": data.reports.tokens,
              "Falhas IA": data.reports.errors,
              "Falhas/incertezas WhatsApp": data.reports.integrationErrors,
            }).map(([label, value]) => (
              <article key={label}>
                <small>{label}</small>
                <h3>{value}</h3>
              </article>
            ))}
          </div>
          <p>
            Custo da IA, custo de campanhas e atribuição de vendas: não disponíveis sem registros do
            provedor. Compras de teste excluídas da receita.
          </p>
          <p>
            Estabelecimento: {data.storeId}. Catálogo, credenciais e sessões isolados por pasta de
            dados e identificador.
          </p>
        </>
      )}
      {tab === "integracoes" && (
        <div className="operations-grid">
          {[
            {
              name: "WhatsApp Business Platform",
              status: wa?.lastTest?.ok
                ? "Conta validada; confira webhook"
                : "Pendente de validação",
              url: "/admin/whatsapp",
            },
            {
              name: "Google Gemini",
              status: "Modelos e último teste na configuração de IA",
              url: "/admin/chatbot",
            },
            {
              name: "Pagamentos",
              status: "Checkout de demonstração. Cobrança online não configurada",
              url: "/admin/configuracoes",
            },
            {
              name: "Armazenamento da loja",
              status: "Dados locais cifrados no servidor; publicação exige armazenamento persistente",
              url: "/admin/configuracoes",
            },
            {
              name: "Meta Pixel / Conversions API",
              status: "Não configurado; nenhuma conversão enviada",
              url: "/admin/configuracoes",
            },
            {
              name: "Analytics / Tag Manager",
              status: "Não configurado",
              url: "/admin/configuracoes",
            },
            {
              name: "Push PWA",
              status: "PWA instalável; ative avisos neste aparelho pelo topo do painel",
              url: "/admin/notificacoes",
            },
          ].map((i) => (
            <article key={i.name}>
              <h3>{i.name}</h3>
              <p>{i.status}</p>
              <a href={i.url}>Abrir configuração</a>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
function RecoverySettings({
  current,
  busy,
  run,
}: {
  current: Snapshot["recovery"];
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [value, setValue] = useState(current);
  const { data: wa } = useQuery({ queryKey: ["labor-whatsapp"], queryFn: () => waConfig() });
  return (
    <details>
      <summary>Recuperação de carrinhos</summary>
      <p>
        Um lembrete por carrinho, somente após confirmação do número pelo WhatsApp e consentimento.
        Compra concluída cancela o envio pendente.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => recoverySave({ data: value }));
        }}
      >
        <label>
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(e) => setValue({ ...value, enabled: e.target.checked })}
          />{" "}
          Ativar recuperação
        </label>
        <label>
          Horas após salvar carrinho
          <input
            type="number"
            min="1"
            max="168"
            value={value.hours}
            onChange={(e) => setValue({ ...value, hours: Number(e.target.value) })}
          />
        </label>
        <label>
          Template aprovado, sem parâmetros
          <select
            value={`${value.template}|${value.language}`}
            onChange={(e) => {
              const [template, language] = e.target.value.split("|");
              setValue({ ...value, template: template || "", language: language || "pt_BR" });
            }}
          >
            <option value="">Selecione</option>
            {wa?.templates
              .filter((t) => t.status === "APPROVED" && t.usable && t.variables === 0)
              .map((t) => (
                <option key={t.id} value={`${t.name}|${t.language}`}>
                  {t.name} · {t.language}
                </option>
              ))}
          </select>
        </label>
        <button disabled={busy}>Salvar recuperação com MFA</button>
      </form>
    </details>
  );
}
function CustomerEditor({
  customer: c,
  loyalty,
  busy,
  run,
}: {
  customer: Customer;
  loyalty: boolean;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [tags, setTags] = useState(c.tags.join(", ")),
    [notes, setNotes] = useState(c.notes),
    [consent, setConsent] = useState(c.consent.at(-1)?.granted || false),
    [evidence, setEvidence] = useState(""),
    [points, setPoints] = useState(0),
    [cashback, setCashback] = useState(0),
    [reference, setReference] = useState(() => crypto.randomUUID());
  return (
    <article>
      <h3>{c.name}</h3>
      <p>
        {c.phone} · origem: {c.origin}
      </p>
      <p>
        Primeiro contato: {c.firstContact ? new Date(c.firstContact).toLocaleString("pt-BR") : "—"}
      </p>
      <p>
        {c.paidOrders} compras pagas · total {formatBRL(c.total)} · ticket {formatBRL(c.average)}
      </p>
      <p>Favoritos: {c.favorites.join(", ") || "Sem compras elegíveis"}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(() =>
            contactSave({
              data: {
                phone: c.phone,
                tags: tags
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
                notes,
                consent,
                evidence,
              },
            }),
          );
        }}
      >
        <label>
          Etiquetas, separadas por vírgula
          <input value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>
        <label>
          Notas internas
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <label>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />{" "}
          Consentimento promocional documentado
        </label>
        <label>
          Origem e evidência da autorização
          <input value={evidence} onChange={(e) => setEvidence(e.target.value)} />
        </label>
        <button disabled={busy}>Salvar cliente</button>
      </form>
      <details>
        <summary>Histórico de consentimento</summary>
        {c.consent.map((e, i) => (
          <p key={i}>
            {e.granted ? "Autorizado" : "Retirado"} · {new Date(e.at).toLocaleString("pt-BR")} ·{" "}
            {e.source} · {e.evidence}
          </p>
        ))}
      </details>
      <h4>Pedidos</h4>
      {c.orders.map((o) => (
        <p key={o.id}>
          #{o.number} · {o.status} · {formatBRL(o.total)} {o.test && "· teste"}
        </p>
      ))}
      <h4>Atendimentos</h4>
      {c.conversations.map((a) => (
        <p key={a.id}>
          {a.mode} · {new Date(a.at).toLocaleString("pt-BR")}
        </p>
      ))}
      {loyalty && (
        <>
          <h4>
            {c.points} pontos · {formatBRL(c.cashback)} cashback
          </h4>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await loyaltyRedeem({ data: { phone: c.phone, points, cashback, reference } });
                setReference(crypto.randomUUID());
                setPoints(0);
                setCashback(0);
                toast.success("Resgate registrado.");
              });
            }}
          >
            <label>
              Pontos para resgate no balcão
              <input
                type="number"
                min="0"
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
              />
            </label>
            <label>
              Cashback para resgate no balcão (R$)
              <input
                type="number"
                step="0.01"
                min="0"
                value={cashback}
                onChange={(e) => setCashback(Number(e.target.value))}
              />
            </label>
            <button disabled={busy}>Registrar resgate com MFA</button>
          </form>
          {c.ledger.map((l) => (
            <p key={l.id}>
              {l.kind} · {l.points} pontos · {formatBRL(l.cashback / 100)} ·{" "}
              {new Date(l.at).toLocaleString("pt-BR")}
            </p>
          ))}
        </>
      )}
    </article>
  );
}
