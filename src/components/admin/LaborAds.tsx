import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  adsSnapshot,
  adsConnect,
  adsAccount,
  adsSync,
  adsSave,
  adsPublish,
  adsChange,
  adsPrepare,
  adsDispatch,
} from "@/lib/ads.functions";
import { evidenceRecommendations, objectives, summarize, type AdsDraft } from "@/lib/ads.types";
import { formatBRL } from "@/lib/menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LaborOperations } from "./LaborOperations";
import "@/styles/ads.css";
const tabs = [
  "Visão geral",
  "Minhas campanhas",
  "Criar campanha",
  "Públicos",
  "Conversões",
  "Otimização inteligente",
  "Relatórios",
  "Integrações e configurações",
  "Campanhas WhatsApp",
];
const isoDay = (n = 0) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const initial = () => ({
  name: "",
  productId: "",
  objective: objectives[0] as (typeof objectives)[number],
  budgetKind: "daily" as "daily" | "lifetime",
  budget: 20,
  start: `${isoDay(1)}T09:00`,
  end: `${isoDay(8)}T09:00`,
  country: "BR",
  cityId: "",
  ageMin: 18,
  ageMax: 65,
  audience: "",
  placements: ["facebook", "instagram"] as ("facebook" | "instagram")[],
});
export function LaborAds() {
  const [tab, setTab] = useState(tabs[0]),
    [since, setSince] = useState(isoDay(-7)),
    [until, setUntil] = useState(isoDay()),
    [busy, setBusy] = useState(false),
    [draft, setDraft] = useState(initial),
    [editId, setEditId] = useState<string>(),
    [selectedCampaign, setSelectedCampaign] = useState(""),
    [postId, setPostId] = useState("");
  const { data, error, refetch } = useQuery({
    queryKey: ["labor-ads"],
    queryFn: () => adsSnapshot(),
    retry: false,
  });
  const [pending, setPending] = useState<{ label: string; run: () => Promise<unknown> } | null>(
    null,
  );
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      await refetch();
      toast.success("Operação concluída.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Operação indisponível.");
    } finally {
      setBusy(false);
    }
  }
  const rows = (data?.insights || []).filter(
      (v) =>
        v.date >= since &&
        v.date <= until &&
        (!selectedCampaign || v.campaignId === selectedCampaign),
    ),
    total = summarize(rows);
  const days = [...new Set(rows.map((v) => v.date))]
    .sort()
    .map((date) => ({ date, ...summarize(rows.filter((v) => v.date === date)) }));
  function edit(d: AdsDraft) {
    setDraft({
      ...d,
      start: d.start.slice(0, 16),
      end: d.end.slice(0, 16),
      cityId: d.cityId || "",
    });
    setEditId(d.id);
    setTab("Criar campanha");
  }
  function csv() {
    const values = [
      [
        "Data",
        "Campanha",
        "Moeda",
        "Investimento",
        "Impressões",
        "Alcance diário",
        "Cliques",
        "Compras Meta",
        "Receita Meta",
      ],
      ...rows.map((v) => [
        v.date,
        v.name,
        v.currency,
        v.spend,
        v.impressions,
        v.reach,
        v.clicks,
        v.purchases,
        v.revenue,
      ]),
    ];
    const escape = (v: unknown) =>
      `"${String(v)
        .replace(/"/g, '""')
        .replace(/^[=+@-]/, "'$&")}"`;
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + values.map((r) => r.map(escape).join(";")).join("\r\n")], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `acai-labor-ads-${since}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="ads-center">
      <header>
        <div>
          <p>MARKETING · AÇAÍ LABOR</p>
          <h2>Central de tráfego pago</h2>
          <p>Planeje anúncios, acompanhe resultados e preserve controle do investimento.</p>
        </div>
        <span className="ads-pill">
          {data?.connected ? "Meta conectada" : "Meta não conectada"}
        </span>
      </header>
      <nav aria-label="Seções de tráfego pago">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            aria-current={tab === t ? "page" : undefined}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert">
          Não foi possível abrir campanhas. Faça login novamente e confira configuração do servidor.
        </p>
      )}
      {data && !data.remotePersistence && (
        <p className="ads-notice">
          Dados deste painel usam armazenamento local. Para publicar no Lovable, conclua conexão com
          banco persistente. A integração Meta exige aplicativo e permissões aprovados.
        </p>
      )}
      {tab !== "Campanhas WhatsApp" && (
        <div className="ads-filters">
          <label>
            De
            <Input type="date" value={since} onChange={(e) => setSince(e.target.value)} />
          </label>
          <label>
            Até
            <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
          </label>
          <label>
            Campanha
            <select
              aria-label="Filtrar campanha"
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
            >
              <option value="">Todas</option>
              {data?.campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </label>
          <Button
            disabled={busy || !data?.account}
            onClick={() => run(() => adsSync({ data: { since, until } }))}
          >
            Sincronizar Meta
          </Button>
          <small>
            {data?.synced
              ? `Última consulta: ${new Date(data.synced).toLocaleString("pt-BR")}`
              : "Nenhuma métrica importada"}
          </small>
        </div>
      )}
      {(tab === "Visão geral" || tab === "Relatórios") && (
        <>
          <div className="ads-metrics">
            {Object.entries({
              Investimento: formatBRL(total.spend),
              Impressões: total.impressions,
              Cliques: total.clicks,
              CTR: total.ctr === null ? "—" : `${total.ctr.toFixed(2)}%`,
              CPC: total.cpc === null ? "—" : formatBRL(total.cpc),
              CPM: total.cpm === null ? "—" : formatBRL(total.cpm),
              "Compras atribuídas pela Meta": total.purchases,
              "Custo por compra": total.cpa === null ? "—" : formatBRL(total.cpa),
              "Receita atribuída pela Meta": formatBRL(total.revenue),
              ROAS: total.roas === null ? "—" : `${total.roas.toFixed(2)}×`,
              "Campanhas ativas": data?.campaigns.filter((c) => c.status === "ACTIVE").length || 0,
              "Campanhas pausadas":
                data?.campaigns.filter((c) => c.status === "PAUSED").length || 0,
            }).map(([k, v]) => (
              <article key={k}>
                <small>{k}</small>
                <strong>{rows.length || k.startsWith("Campanhas") ? v : "—"}</strong>
              </article>
            ))}
          </div>
          <p>
            Compras e receita acima usam atribuição da Meta. Alcance fica por dia; não somamos
            pessoas repetidas. Sem dados importados, indicadores ficam indisponíveis.
          </p>
          {days.length > 0 ? (
            <div style={{ height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={days}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line dataKey="spend" name="Investimento R$" stroke="#71378f" />
                  <Line dataKey="revenue" name="Receita Meta R$" stroke="#568a32" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="ads-empty">
              Conecte conta e sincronize período para acompanhar resultados reais.
            </div>
          )}
          {tab === "Relatórios" && (
            <>
              <Button onClick={csv} disabled={!rows.length}>
                Exportar CSV
              </Button>{" "}
              <Button onClick={() => window.print()} disabled={!rows.length}>
                Salvar relatório em PDF
              </Button>
              <div className="ads-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Campanha</th>
                      <th>Investimento</th>
                      <th>Compras Meta</th>
                      <th>Receita Meta</th>
                      <th>ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...new Set(rows.map((r) => r.campaignId))].map((id) => {
                      const r = rows.filter((r) => r.campaignId === id),
                        t = summarize(r);
                      return (
                        <tr key={id}>
                          <td>{r[0]?.name}</td>
                          <td>{formatBRL(t.spend)}</td>
                          <td>{t.purchases}</td>
                          <td>{formatBRL(t.revenue)}</td>
                          <td>{t.roas?.toFixed(2) || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p>
                Produtos mais vendidos:{" "}
                {data?.commerce.bestSellers.map((p) => `${p.name}: ${p.units}`).join(" · ") ||
                  "Sem pedidos reais pagos."}{" "}
                Ticket médio:{" "}
                {data?.commerce.average ? formatBRL(data.commerce.average) : "indisponível"}.
              </p>
            </>
          )}
        </>
      )}
      {tab === "Minhas campanhas" && (
        <>
          <h3>Rascunhos da loja</h3>
          {!data?.drafts.length && <p>Nenhum rascunho salvo.</p>}
          {data?.drafts.map((d) => (
            <article className="ads-row" key={d.id}>
              <div>
                <h4>{d.name}</h4>
                <p>
                  {formatBRL(d.budget)} {d.budgetKind === "daily" ? "por dia" : "no período"} ·{" "}
                  {d.state} · {d.objective}
                </p>
                <small>
                  {d.metaId
                    ? `ID Meta: ${d.metaId}. Campanha criada pausada; conjunto e anúncio ainda precisam ser configurados.`
                    : ""}
                </small>
              </div>
              {d.state === "draft" && (
                <>
                  <Button onClick={() => edit(d)}>Editar</Button>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      setPending({
                        label: `Enviar “${d.name}” à Meta como campanha pausada? Isso ainda não cria anúncios.`,
                        run: () => adsPublish({ data: { id: d.id, confirm: true } }),
                      })
                    }
                  >
                    Enviar à Meta
                  </Button>
                </>
              )}
            </article>
          ))}
          <h3>Preparar conjunto e anúncio</h3>
          <label>
            Post existente da página (ID página_ID post)
            <Input
              value={postId}
              onChange={(e) => setPostId(e.target.value)}
              placeholder="123456_789012"
            />
          </label>
          {data?.drafts
            .filter((d) => d.metaId && !d.adId)
            .map((d) => (
              <article className="ads-row" key={d.id}>
                <p>
                  {d.name} · {formatBRL(d.budget)} · {d.budgetKind} ·{" "}
                  {d.cityId ? `Cidade Meta ${d.cityId}` : "Defina cidade antes do envio"}
                </p>
                <Button
                  disabled={busy || !postId}
                  onClick={() =>
                    setPending({
                      label: `Criar conjunto e anúncio PAUSADOS para “${d.name}”, orçamento ${formatBRL(d.budget)} (${d.budgetKind}), até ${new Date(d.end).toLocaleString("pt-BR")}? Post existente será usado como criativo.`,
                      run: () => adsPrepare({ data: { id: d.id, postId, confirm: true } }),
                    })
                  }
                >
                  Criar anúncio pausado
                </Button>
                <small>
                  IDs preservados: conjunto {d.adsetId || "—"}, criativo {d.creativeId || "—"}
                </small>
              </article>
            ))}
          <h3>Anúncios e análise Meta</h3>
          {data?.ads?.map((a) => (
            <article className="ads-row" key={a.id}>
              <div>
                <h4>{a.name}</h4>
                <p>
                  {a.effective_status} · {a.status}
                </p>
              </div>
              <Button
                disabled={busy}
                onClick={() =>
                  setPending({
                    label: `Alterar anúncio “${a.name}” para ${a.status === "ACTIVE" ? "PAUSED" : "ACTIVE"}? Ativação pode iniciar gastos se campanha e conjunto estiverem ativos.`,
                    run: () =>
                      adsChange({
                        data: {
                          id: a.id,
                          requestId: crypto.randomUUID(),
                          status: a.status === "ACTIVE" ? "PAUSED" : "ACTIVE",
                          confirm: true,
                        },
                      }),
                  })
                }
              >
                {a.status === "ACTIVE" ? "Pausar" : "Reativar"}
              </Button>
            </article>
          ))}
          <h3>Campanhas da conta Meta</h3>
          {data?.campaigns.map((c) => (
            <article className="ads-row" key={c.id}>
              <div>
                <h4>{c.name}</h4>
                <p>
                  {c.status} · {c.objective}
                </p>
              </div>
              <Button
                disabled={busy}
                onClick={() =>
                  setPending({
                    label: `${c.status === "ACTIVE" ? "Pausar" : "Ativar"} “${c.name}”? Ativar pode iniciar gastos nos anúncios elegíveis.`,
                    run: () =>
                      adsChange({
                        data: {
                          id: c.id,
                          requestId: crypto.randomUUID(),
                          status: c.status === "ACTIVE" ? "PAUSED" : "ACTIVE",
                          confirm: true,
                        },
                      }),
                  })
                }
              >
                {c.status === "ACTIVE" ? "Pausar" : "Reativar"}
              </Button>
            </article>
          ))}
        </>
      )}
      {(tab === "Criar campanha" || tab === "Públicos") && (
        <form
          className="ads-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() =>
              adsSave({
                data: {
                  ...draft,
                  id: editId,
                  cityId: draft.cityId || undefined,
                  start: new Date(draft.start).toISOString(),
                  end: new Date(draft.end).toISOString(),
                },
              }),
            );
          }}
        >
          <h3>{tab === "Públicos" ? "Público do planejamento" : "Planejamento da campanha"}</h3>
          <label>
            Nome
            <Input
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label>
            Produto
            <select
              required
              aria-label="Produto"
              value={draft.productId}
              onChange={(e) => setDraft({ ...draft, productId: e.target.value })}
            >
              <option value="">Selecione produto existente</option>
              {data?.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {formatBRL(p.price)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Objetivo
            <select
              value={draft.objective}
              onChange={(e) =>
                setDraft({ ...draft, objective: e.target.value as typeof draft.objective })
              }
            >
              {objectives.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Orçamento
            <select
              value={draft.budgetKind}
              onChange={(e) =>
                setDraft({ ...draft, budgetKind: e.target.value as "daily" | "lifetime" })
              }
            >
              <option value="daily">Diário</option>
              <option value="lifetime">Total do período</option>
            </select>
          </label>
          <label>
            Valor (R$)
            <Input
              type="number"
              min="1"
              max="10000"
              step="0.01"
              value={draft.budget}
              onChange={(e) => setDraft({ ...draft, budget: +e.target.value })}
            />
          </label>
          <label>
            Início
            <Input
              required
              type="datetime-local"
              value={draft.start}
              onChange={(e) => setDraft({ ...draft, start: e.target.value })}
            />
          </label>
          <label>
            Fim
            <Input
              required
              type="datetime-local"
              value={draft.end}
              onChange={(e) => setDraft({ ...draft, end: e.target.value })}
            />
          </label>
          <label>
            País (ISO)
            <Input
              maxLength={2}
              value={draft.country}
              onChange={(e) => setDraft({ ...draft, country: e.target.value.toUpperCase() })}
            />
          </label>
          <label>
            ID da cidade na Meta
            <Input
              value={draft.cityId}
              onChange={(e) => setDraft({ ...draft, cityId: e.target.value })}
            />
          </label>
          <label>
            Idade mínima
            <Input
              type="number"
              min={18}
              max={65}
              value={draft.ageMin}
              onChange={(e) => setDraft({ ...draft, ageMin: +e.target.value })}
            />
          </label>
          <label>
            Idade máxima
            <Input
              type="number"
              min={18}
              max={65}
              value={draft.ageMax}
              onChange={(e) => setDraft({ ...draft, ageMax: +e.target.value })}
            />
          </label>
          <label>
            Descrição do público
            <Input
              value={draft.audience}
              onChange={(e) => setDraft({ ...draft, audience: e.target.value })}
            />
          </label>
          <fieldset>
            <legend>Plataformas planejadas</legend>
            {(["facebook", "instagram"] as const).map((v) => (
              <label key={v}>
                <input
                  type="checkbox"
                  checked={draft.placements.includes(v)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      placements: e.target.checked
                        ? [...draft.placements, v]
                        : draft.placements.filter((p) => p !== v),
                    })
                  }
                />
                {v}
              </label>
            ))}
          </fieldset>
          <p>
            Orçamento, datas e segmentação ficam no rascunho até configuração do conjunto de
            anúncios. Envio atual cria somente campanha pausada.
          </p>
          <Button disabled={busy} type="submit">
            Salvar rascunho
          </Button>
        </form>
      )}
      {tab === "Conversões" && (
        <>
          <h3>Meta e atribuição direta</h3>
          <p>
            Eventos do site dependem de consentimento explícito. Pedidos de teste e cancelados não
            geram Purchase. Compra requer pagamento confirmado pelo servidor.
          </p>
          <p>
            {data?.events.length || 0} eventos consentidos registrados. Pixel:{" "}
            {data?.pixel || "não configurado"}.
          </p>
          <p>
            Pedidos reais pagos: {data?.commerce.paidOrders || 0}. Receita paga:{" "}
            {formatBRL(data?.commerce.revenue || 0)}. Associação UTM registra origem declarada, sem
            equivaler à atribuição da Meta.
          </p>
          <p>
            Purchase de produção aguarda fluxo real de pagamento e persistência remota. Eventos
            consentidos usam o mesmo event_id no Pixel e CAPI.
          </p>
          <Button disabled={busy} onClick={() => run(() => adsDispatch())}>
            Enviar eventos pendentes pela CAPI
          </Button>
        </>
      )}
      {tab === "Otimização inteligente" && (
        <>
          <h3>Análise do período importado</h3>
          <p>
            Metas de referência: ROAS 3×, CPA R$ 20 e CTR 1%. Recomendações usam apenas métricas
            sincronizadas e exigem revisão antes de alterar a Meta.
          </p>
          {evidenceRecommendations(rows).length ? (
            evidenceRecommendations(rows).map((r, i) => (
              <article className="ads-row" key={i}>
                <strong>{r.name}</strong>
                <p>{r.reason}</p>
                <p>Base: {r.evidence}</p>
                <p>
                  Confiança: {r.confidence}. Risco: {r.risk}
                </p>
                <span>Revisão administrativa necessária</span>
              </article>
            ))
          ) : (
            <p>Sem recomendações com dados disponíveis.</p>
          )}
          <p>
            Modo automático: desativado. Ativação depende de limites aprovados, execução periódica e
            integração remota.
          </p>
          <h3>Inteligência comercial</h3>
          <p>
            Somente pedidos reais pagos e não cancelados. Receita não é lucro; custo e margem de
            produto não estão cadastrados.
          </p>
          <p>
            {data?.commerce.paidOrders || 0} pedidos pagos ·{" "}
            {formatBRL(data?.commerce.revenue || 0)} de receita · ticket médio{" "}
            {data?.commerce.average == null ? "—" : formatBRL(data.commerce.average)}
          </p>
          <div className="ads-scroll">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Unidades</th>
                  <th>Receita</th>
                  <th>Ticket por pedido</th>
                </tr>
              </thead>
              <tbody>
                {data?.commerce.products.slice(0, 10).map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.units}</td>
                    <td>{formatBRL(p.revenue)}</td>
                    <td>{formatBRL(p.revenue / p.orders)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>Origem UTM declarada em pedidos pagos (não comprova que o anúncio causou a compra):</p>
          {data?.commerce.campaigns.length ? (
            data.commerce.campaigns.map((c) => (
              <p key={c.name}>
                {c.name}: {c.orders} pedido(s), {formatBRL(c.revenue)}
              </p>
            ))
          ) : (
            <p>Sem pedidos reais atribuídos internamente.</p>
          )}
        </>
      )}
      {tab === "Integrações e configurações" && (
        <>
          <h3>Meta Business</h3>
          <p>
            Conexão usa OAuth oficial. Confirme MFA em WhatsApp e Segurança antes de conectar ou
            alterar anúncios.
          </p>
          <Button
            disabled={busy}
            onClick={() =>
              run(async () => {
                const r = await adsConnect();
                window.location.assign(r.url);
              })
            }
          >
            Conectar Meta Business
          </Button>
          <label>
            Conta de anúncios (BRL)
            <select
              value={data?.account || ""}
              onChange={(e) => run(() => adsAccount({ data: e.target.value }))}
            >
              <option value="">Selecione conta</option>
              {data?.accounts?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.currency}
                </option>
              ))}
            </select>
          </label>
          <p>
            Configure no servidor: App ID, App Secret, versão da Marketing API e callback HTTPS
            /api/meta-ads/callback. O token fica no cofre.
          </p>
          <p>
            Aprovação Meta, contas autorizadas, Pixel e banco remoto precisam ser verificados antes
            de publicar.
          </p>
        </>
      )}
      {tab === "Campanhas WhatsApp" && <LaborOperations tab="campanhas" />}
      {pending && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar alteração Meta"
          className="ads-confirm"
        >
          <div>
            <h3>Confirmar operação</h3>
            <p>{pending.label}</p>
            <Button
              disabled={busy}
              onClick={() => {
                const action = pending.run;
                setPending(null);
                void run(action);
              }}
            >
              Confirmar explicitamente
            </Button>{" "}
            <Button onClick={() => setPending(null)}>Cancelar</Button>
          </div>
        </div>
      )}
    </section>
  );
}
