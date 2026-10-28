import { useState, type FormEvent } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  List,
  Tag,
  Settings,
  LogOut,
  Plus,
  ArrowLeft,
  ShieldCheck,
  MessageCircle,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  formatBRL,
  primaryImage,
  effectivePrice,
  ORDER_STATUS_LABEL,
  PAYMENT_LABEL,
  type Product,
  type Category,
  type StoreSettings,
} from "@/lib/menu";
import {
  laborSession,
  laborLogin,
  laborLogout,
  laborSnapshot,
  laborSaveProduct,
  laborSaveCategory,
  laborSaveStore,
  laborStatus,
} from "@/lib/labor.functions";
import type { AdminSnapshot, LaborOrder } from "@/lib/labor.types";
import { STATUSES, productSchema, storeSchema } from "@/lib/labor.schema";
import { dashboardTotals } from "@/lib/vendrex.rules";
import { SaleFields, StoreRulesFields } from "./VendrexFields";
import { VendrexOrders } from "./VendrexOrders";
import { LaborSupportInbox, LaborSupportSettings } from "./LaborSupport";
import { LaborWhatsApp } from "./LaborWhatsApp";
import { LaborOperations } from "./LaborOperations";
import { LaborAds } from "./LaborAds";
import { LaborCoupons } from "./LaborCoupons";
import { NotificationSignal } from "./NotificationSignal";
import { LaborStock } from "./LaborStock";
import { LaborDrivers } from "./LaborDrivers";

const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "Não foi possível salvar. Tente novamente.";
const paths = {
  dashboard: "/admin",
  pedidos: "/admin/pedidos",
  produtos: "/admin/produtos",
  estoque: "/admin/estoque",
  entregadores: "/admin/entregadores",
  categorias: "/admin/categorias",
  promocoes: "/admin/promocoes",
  configuracoes: "/admin/configuracoes",
  auditoria: "/admin/auditoria",
  atendimento: "/admin/atendimento",
  conversas_whatsapp: "/admin/conversas-whatsapp",
  chatbot: "/admin/chatbot",
  whatsapp: "/admin/whatsapp",
  clientes: "/admin/clientes",
  campanhas: "/admin/campanhas",
  fidelidade: "/admin/fidelidade",
  automacoes: "/admin/automacoes",
  relatorios: "/admin/relatorios",
  notificacoes: "/admin/notificacoes",
  integracoes: "/admin/integracoes",
} as const;
type Tab = keyof typeof paths;
const navItems: Array<[Tab, string, typeof Package]> = [
  ["dashboard", "Visão geral", LayoutDashboard],
  ["pedidos", "Pedidos", ShoppingBag],
  ["atendimento", "Central de Atendimento", MessageCircle],
  ["conversas_whatsapp", "Conversas WhatsApp", MessageCircle],
  ["chatbot", "Inteligência Artificial", Bot],
  ["whatsapp", "WhatsApp e Segurança", MessageCircle],
  ["clientes", "Clientes e relacionamento", List],
  ["campanhas", "Campanhas", MessageCircle],
  ["fidelidade", "Fidelidade", Tag],
  ["automacoes", "Automações", Settings],
  ["relatorios", "Relatórios", LayoutDashboard],
  ["notificacoes", "Notificações", MessageCircle],
  ["integracoes", "Integrações", Settings],
  ["produtos", "Produtos", Package],
  ["estoque", "Estoque", Package],
  ["entregadores", "Entregadores", ShoppingBag],
  ["categorias", "Categorias", List],
  ["promocoes", "Promoções", Tag],
  ["configuracoes", "Página & identidade", Settings],
  ["auditoria", "Auditoria", ShieldCheck],
];

export function LaborAdmin() {
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const {
    data: session,
    isLoading,
    isError,
  } = useQuery({ queryKey: ["labor-session"], queryFn: () => laborSession(), retry: false });
  const { data: db, error } = useQuery({
    queryKey: ["labor-admin"],
    queryFn: () => laborSnapshot(),
    enabled: session?.authenticated === true,
    refetchInterval: 8000,
    retry: false,
  });
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const tab = (Object.keys(paths) as Tab[]).find((k) => paths[k] === pathname) || "dashboard";
  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["labor-admin"] }),
      qc.invalidateQueries({ queryKey: ["products"] }),
      qc.invalidateQueries({ queryKey: ["categories"] }),
      qc.invalidateQueries({ queryKey: ["store"] }),
    ]);
  }
  async function saveProduct(p: Product) {
    setBusy(true);
    try {
      await laborSaveProduct({ data: productSchema.parse(p) });
      await refresh();
      setEditing(null);
      toast.success("Produto salvo.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function saveCategory(c: Category) {
    try {
      await laborSaveCategory({ data: c });
      await refresh();
      toast.success("Categoria salva.");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  if (isLoading) return <div className="admin-login-wrap">Verificando acesso…</div>;
  if (isError)
    return (
      <div className="admin-login-wrap">
        <p>Não foi possível conectar ao servidor. Atualize a página.</p>
      </div>
    );
  if (!session?.authenticated)
    return (
      <AdminLogin
        needsSetup={session?.needsSetup || false}
        remote={session?.storage === "supabase"}
        mfaRequired={session?.mfaRequired || false}
        onSuccess={async () => {
          await qc.invalidateQueries({ queryKey: ["labor-session"] });
          navigate({ to: "/admin" });
        }}
      />
    );
  return (
    <div className="labor-admin">
      <aside className="labor-admin-sidebar">
        <h1>
          {db?.store.store_name || "Açaí Labor"}
          <span style={{ color: "var(--gold)" }}> ✦</span>
        </h1>
        <small>ESPAÇO DA LOJA</small>
        <nav aria-label="Administração">
          {navItems.map(([key, label, Icon]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => navigate({ to: paths[key] })}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
        <Link to="/">
          <ArrowLeft size={12} className="inline mr-1" /> Voltar à loja
        </Link>
        <button
          onClick={async () => {
            await laborLogout();
            qc.removeQueries({ queryKey: ["labor-admin"] });
            await qc.invalidateQueries({ queryKey: ["labor-session"] });
          }}
        >
          <LogOut size={12} className="inline mr-1" /> Sair com segurança
        </button>
      </aside>
      <main className="labor-admin-main">
        <div className="admin-topline">
          <div>
            <h2>{navItems.find((n) => n[0] === tab)?.[1]}</h2>
            <p>Seu negócio, cuidado em cada detalhe.</p>
          </div>
          <span className="admin-pill">
            {session.storage === "supabase" ? "Dados salvos no Supabase" : "Demonstração · dados locais"}
          </span>
          {db && <NotificationSignal events={db.audit || []} />}
        </div>
        {error && (
          <p role="alert">
            Sessão expirada ou servidor indisponível.{" "}
            <button
              className="underline"
              onClick={() => qc.invalidateQueries({ queryKey: ["labor-session"] })}
            >
              Verificar acesso
            </button>
          </p>
        )}
        {!db ? (
          <p>Carregando os dados da loja…</p>
        ) : (
          <>
            {tab === "dashboard" && <Dashboard db={db} />}
            {tab === "atendimento" && <LaborSupportInbox />}
            {tab === "estoque" && <LaborStock db={db} refresh={refresh} />}
            {tab === "entregadores" && <LaborDrivers db={db} refresh={refresh} />}
            {tab === "conversas_whatsapp" && <LaborSupportInbox channel="whatsapp" />}
            {tab === "chatbot" && <LaborSupportSettings />}
            {tab === "whatsapp" && <LaborWhatsApp />}
            {(tab === "clientes" ||
              tab === "fidelidade" ||
              tab === "automacoes" ||
              tab === "relatorios" ||
              tab === "notificacoes" ||
              tab === "integracoes") && <LaborOperations key={tab} tab={tab} />}
            {tab === "campanhas" && <LaborAds />}
            {tab === "auditoria" && (
              <section className="admin-box">
                <h3>Registro de alterações</h3>
                <p className="text-xs text-muted-foreground mb-5">
                  Registros criados no servidor, sem opção de alteração pela interface.
                </p>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Autor</th>
                        <th>Ação</th>
                        <th>Detalhes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...(db.audit || [])].reverse().map((a) => (
                        <tr key={a.id}>
                          <td>{new Date(a.at).toLocaleString("pt-BR")}</td>
                          <td>{a.actor}</td>
                          <td>{a.action}</td>
                          <td>{a.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!db.audit?.length && (
                    <p className="admin-empty">As próximas alterações aparecerão aqui.</p>
                  )}
                </div>
              </section>
            )}
            {tab === "pedidos" && <VendrexOrders db={db} refresh={refresh} />}
            {(tab === "produtos" || tab === "promocoes") && (
              <>
                <div className="admin-actions">
                  <Input
                    placeholder="Buscar produto…"
                    aria-label="Buscar produto no painel"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <Button onClick={() => setEditing(newProduct(db.categories[0]?.id || null))}>
                    <Plus size={15} /> Novo produto
                  </Button>
                </div>
                {tab === "promocoes" && <LaborCoupons db={db} refresh={refresh} />}
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Produto</th>
                        <th>Preço atual</th>
                        <th>Disponibilidade</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {db.products
                        .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
                        .filter((p) => tab !== "promocoes" || p.promotions.length > 0)
                        .map((p) => (
                          <tr key={p.id}>
                            <td>
                              {primaryImage(p) && <img src={primaryImage(p)!} alt="" />}
                              <span>
                                {p.name}
                                {p.is_featured && (
                                  <small className="block text-muted-foreground">✦ Destaque</small>
                                )}
                              </span>
                            </td>
                            <td>{formatBRL(effectivePrice(p))}</td>
                            <td>
                              {!p.is_active
                                ? "Arquivado"
                                : p.is_sold_out
                                  ? "Esgotado"
                                  : "Disponível"}
                            </td>
                            <td>
                              <button onClick={() => setEditing(structuredClone(p))}>Editar</button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {tab === "categorias" && (
              <Categories categories={db.categories} onSave={saveCategory} />
            )}
            {tab === "configuracoes" && (
              <StoreEditor
                store={db.store}
                onSave={async (store) => {
                  await laborSaveStore({ data: storeSchema.parse(store) });
                  await refresh();
                  toast.success("Configurações atualizadas.");
                }}
              />
            )}
          </>
        )}
      </main>
      <Dialog
        open={!!editing}
        onOpenChange={(v) => {
          if (!v) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogTitle>Editar produto</DialogTitle>
          <DialogDescription>
            Alterações ficam salvas no servidor desta demonstração.
          </DialogDescription>
          {editing && (
            <ProductEditor
              key={editing.id}
              product={editing}
              categories={db?.categories || []}
              onSave={saveProduct}
              busy={busy}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminLogin({
  needsSetup,
  remote,
  mfaRequired,
  onSuccess,
}: {
  needsSetup: boolean;
  remote: boolean;
  mfaRequired: boolean;
  onSuccess: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="admin-login-wrap">
      <form
        className="admin-login-card"
        onSubmit={async (e) => {
          e.preventDefault();
          if (needsSetup && password !== confirm) {
            toast.error("As senhas precisam ser iguais.");
            return;
          }
          setBusy(true);
          try {
            await laborLogin({
              data: {
                password,
                setup: needsSetup,
                code: mfaRequired ? code.trim() : undefined,
                setupToken: needsSetup && remote ? setupToken.trim() : undefined,
              },
            });
            onSuccess();
          } catch (error) {
            toast.error(errorMessage(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        <ShieldCheck color="#80539a" size={30} />
        <h1>{needsSetup ? "Sua loja começa aqui." : "Que bom ter você aqui."}</h1>
        <p>
          {needsSetup
            ? remote
              ? "Defina a senha do administrador e informe o token privado configurado no servidor."
              : "Defina a senha do administrador no primeiro acesso."
            : "Entre para cuidar dos pedidos e do cardápio da Açaí Labor."}
        </p>
        <label htmlFor="admin-password">
          {needsSetup ? "Crie uma senha (mínimo 12 caracteres)" : "Senha do administrador"}
        </label>
        <Input
          id="admin-password"
          type="password"
          minLength={12}
          maxLength={128}
          required
          autoComplete={needsSetup ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {needsSetup && (
          <>
            <label htmlFor="admin-confirm">Confirme a senha</label>
            <Input
              id="admin-confirm"
              type="password"
              minLength={12}
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {remote && (
              <>
                <label htmlFor="admin-setup-token">Token de configuração</label>
                <Input
                  id="admin-setup-token"
                  type="password"
                  maxLength={128}
                  required
                  autoComplete="off"
                  value={setupToken}
                  onChange={(e) => setSetupToken(e.target.value)}
                />
              </>
            )}
          </>
        )}
        {mfaRequired && !needsSetup && (
          <>
            <label htmlFor="admin-mfa">Código de verificação em duas etapas</label>
            <Input
              id="admin-mfa"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Autenticador ou código de recuperação"
            />
          </>
        )}
        <Button className="w-full mt-6" disabled={busy}>
          {busy ? "Validando…" : needsSetup ? "Configurar e entrar" : "Entrar no painel"}
        </Button>
        <Link to="/">← Voltar para o cardápio</Link>
      </form>
    </div>
  );
}

function Dashboard({ db }: { db: AdminSnapshot }) {
  const valid = db.orders.filter((o) => o.status !== "cancelado");
  const completed = valid.filter((o) => o.payment_status === "pago");
  const totals = dashboardTotals(db.orders);
  const revenue = completed.reduce((s, o) => s + o.total, 0);
  const rank = new Map<string, number>();
  valid.forEach((o) =>
    o.order_items.forEach((i) =>
      rank.set(i.product_name, (rank.get(i.product_name) || 0) + i.quantity),
    ),
  );
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = new Date();
    day.setDate(day.getDate() - 6 + i);
    const d = day.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    return {
      label: d.slice(0, 5),
      total: completed
        .filter(
          (o) =>
            new Date(o.created_at).toLocaleDateString("pt-BR", {
              timeZone: "America/Sao_Paulo",
            }) === d,
        )
        .reduce((s, o) => s + o.total, 0),
    };
  });
  return (
    <>
      <div className="admin-stats">
        {[
          [
            "Valor dos pedidos",
            formatBRL(totals.ordered),
            "Exclui cancelados; não equivale a receita",
          ],
          [
            "Recebimentos confirmados",
            formatBRL(totals.paid),
            "Nenhum pagamento é processado nesta fase",
          ],
          ["A receber", formatBRL(totals.pending), "Pedidos com pagamento pendente"],
          ["Ticket médio", formatBRL(totals.average), "Pedidos não cancelados"],
        ].map(([label, value, note]) => (
          <div key={String(label)} className="admin-stat">
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="admin-box">
          <h3>Recebimentos nos últimos 7 dias</h3>
          {completed.length ? (
            <div className="admin-chart">
              {week.map((d) => (
                <div key={d.label} title={formatBRL(d.total)}>
                  <i
                    style={{
                      height: `${Math.max(2, (d.total / Math.max(1, ...week.map((w) => w.total))) * 100)}px`,
                    }}
                  />
                  <span>{d.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="admin-empty">
              Sem recebimentos confirmados. Concluir uma entrega não confirma o pagamento.
            </p>
          )}
        </section>
        <section className="admin-box">
          <h3>Os mais escolhidos</h3>
          {rank.size ? (
            [...rank]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([name, n]) => (
                <div key={name} className="admin-rank">
                  <span>{name}</span>
                  <span>{n} un.</span>
                </div>
              ))
          ) : (
            <p className="admin-empty">Seu primeiro pedido vai começar esta história.</p>
          )}
        </section>
      </div>
      <section className="admin-box">
        <h3>Pronto para experimentar?</h3>
        <p className="text-xs text-muted-foreground leading-6">
          Abra o cardápio, personalize um produto e confirme um pedido de teste. Ele aparecerá na
          aba Pedidos. Os dados permanecem salvos ao reiniciar o servidor.
        </p>
      </section>
    </>
  );
}
function OrderCard({ order: o, onStatus }: { order: LaborOrder; onStatus: (v: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <article className="admin-order">
      <div className="flex justify-between">
        <strong>#{o.order_number}</strong>
        <span>{formatBRL(o.total)}</span>
      </div>
      <p>
        {o.customer_name} · {o.customer_phone}
        <br />
        {new Date(o.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
      </p>
      <ul>
        {o.order_items.map((i) => (
          <li key={i.id}>
            {i.quantity}× {i.product_name}
            {i.order_item_addons.map((a) => (
              <small className="block ml-2" key={a.id}>
                + {a.quantity}× {a.name}
              </small>
            ))}
            {i.notes && <small className="block">Obs.: {i.notes}</small>}
          </li>
        ))}
      </ul>
      <p>
        {o.fulfillment === "pickup"
          ? "Retirada na loja"
          : `${o.street}, ${o.number} · ${o.neighborhood}`}
        {o.complement && (
          <>
            <br />
            {o.complement}
          </>
        )}
        {o.reference && (
          <>
            <br />
            Referência: {o.reference}
          </>
        )}
        <br />
        {PAYMENT_LABEL[o.payment_method]}
        {o.change_for != null && <> · Troco para {formatBRL(o.change_for)}</>}
        {o.notes && (
          <>
            <br />
            Obs.: {o.notes}
          </>
        )}
      </p>
      <select
        aria-label={`Status do pedido ${o.order_number}`}
        value={o.status}
        disabled={busy || ["entregue", "cancelado"].includes(o.status)}
        onChange={async (e) => {
          setBusy(true);
          try {
            await onStatus(e.target.value);
          } finally {
            setBusy(false);
          }
        }}
      >
        {STATUSES.filter((s) => o.fulfillment !== "pickup" || s !== "saiu_entrega").map((s) => (
          <option value={s} key={s}>
            {ORDER_STATUS_LABEL[s]}
          </option>
        ))}
      </select>
    </article>
  );
}

function newProduct(category_id: string | null): Product {
  return {
    id: crypto.randomUUID(),
    category_id,
    name: "Novo produto",
    slug: `produto-${crypto.randomUUID().slice(0, 8)}`,
    description: "",
    price: 1,
    price_from: false,
    weight: null,
    quantity_label: null,
    serves: null,
    is_active: true,
    is_sold_out: false,
    is_featured: false,
    featured_order: 0,
    sort_order: 100,
    product_images: [],
    addon_groups: [],
    promotions: [],
  };
}
function ProductEditor({
  product,
  categories,
  onSave,
  busy,
}: {
  product: Product;
  categories: Category[];
  onSave: (p: Product) => void;
  busy: boolean;
}) {
  const [p, setP] = useState(product);
  const [promo, setPromo] = useState(product.promotions[0]?.promo_price?.toString() || "");
  const [start, setStart] = useState(product.promotions[0]?.starts_at?.slice(0, 10) || "");
  const [end, setEnd] = useState(product.promotions[0]?.ends_at?.slice(0, 10) || "");
  const update = (patch: Partial<Product>) => setP((v) => ({ ...v, ...patch }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (promo && Number(promo) >= p.price) {
      toast.error("O preço promocional deve ser menor que o preço base.");
      return;
    }
    onSave({
      ...p,
      promotions: promo
        ? [
            {
              id: p.promotions[0]?.id || crypto.randomUUID(),
              title: "Oferta da casa",
              promo_price: Number(promo),
              discount_percent: null,
              starts_at: start ? `${start}T00:00:00-03:00` : null,
              ends_at: end ? `${end}T23:59:59-03:00` : null,
              is_active: true,
            },
          ]
        : [],
    });
  };
  return (
    <form onSubmit={submit}>
      <div className="admin-form-grid">
        <label className="span-two">
          Nome
          <input required value={p.name} onChange={(e) => update({ name: e.target.value })} />
        </label>
        <label className="span-two">
          Descrição
          <textarea
            rows={3}
            value={p.description || ""}
            onChange={(e) => update({ description: e.target.value })}
          />
        </label>
        <label>
          Preço base (R$)
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={p.price}
            onChange={(e) => update({ price: Number(e.target.value) })}
          />
        </label>
        <label>
          Preço promocional (R$)
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={promo}
            onChange={(e) => setPromo(e.target.value)}
            placeholder="Sem promoção"
          />
        </label>
        <label>
          Início da promoção
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label>
          Fim da promoção
          <input type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <label>
          Categoria
          <select
            value={p.category_id || ""}
            required
            onChange={(e) => update({ category_id: e.target.value })}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ordem no cardápio
          <input
            type="number"
            value={p.sort_order}
            onChange={(e) => update({ sort_order: Number(e.target.value) })}
          />
        </label>
        <label>
          Ordem nos destaques
          <input
            type="number"
            value={p.featured_order}
            onChange={(e) => update({ featured_order: Number(e.target.value) })}
          />
        </label>
        <label>
          Quantidade / tamanho
          <input
            value={p.quantity_label || ""}
            onChange={(e) => update({ quantity_label: e.target.value })}
          />
        </label>
        <label className="span-two">
          Foto do produto (PNG, JPG ou WebP, até 700 KB)
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 700000 || !["image/png", "image/jpeg", "image/webp"].includes(f.type)) {
                toast.error("Selecione PNG, JPG ou WebP de até 700 KB.");
                return;
              }
              const reader = new FileReader();
              reader.onload = () =>
                update({
                  product_images: [
                    {
                      id: crypto.randomUUID(),
                      url: String(reader.result),
                      sort_order: 0,
                      is_primary: true,
                    },
                  ],
                });
              reader.readAsDataURL(f);
            }}
          />
        </label>
        {primaryImage(p) && (
          <div className="span-two flex items-center gap-4">
            <img
              src={primaryImage(p)!}
              alt="Prévia"
              className="w-20 h-20 rounded-xl object-cover"
            />
            <button
              type="button"
              className="text-xs text-primary underline"
              onClick={() => update({ product_images: [] })}
            >
              Remover foto
            </button>
          </div>
        )}
      </div>
      <div className="admin-checks">
        {(
          [
            ["is_active", "Publicado"],
            ["is_sold_out", "Esgotado"],
            ["is_featured", "Destaque"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={p[key]}
              onChange={(e) => update({ [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
      </div>
      <SaleFields product={p} update={update} />
      <div className="flex items-center justify-between mt-5">
        <h3 className="text-sm font-semibold">Personalização</h3>
        <button
          type="button"
          className="text-xs text-primary"
          onClick={() => {
            const id = crypto.randomUUID();
            update({
              addon_groups: [
                ...p.addon_groups,
                {
                  id,
                  title: "Novo grupo de opções",
                  min_select: 0,
                  max_select: 1,
                  is_required: false,
                  sort_order: p.addon_groups.length,
                  product_addons: [],
                },
              ],
            });
          }}
        >
          + Grupo
        </button>
      </div>
      {p.addon_groups.map((g, gi) => (
        <div className="addons-editor" key={g.id}>
          <div className="flex gap-2">
            <input
              aria-label="Título do grupo"
              value={g.title}
              onChange={(e) =>
                update({
                  addon_groups: p.addon_groups.map((x, i) =>
                    i === gi ? { ...x, title: e.target.value } : x,
                  ),
                })
              }
            />
            <button
              type="button"
              className="text-xs"
              onClick={() => update({ addon_groups: p.addon_groups.filter((x) => x.id !== g.id) })}
            >
              Remover
            </button>
          </div>
          <div className="admin-checks">
            <label>
              Mín.
              <input
                aria-label="Mínimo de opções"
                type="number"
                min="0"
                max={g.max_select}
                value={g.min_select}
                style={{ width: 50 }}
                onChange={(e) =>
                  update({
                    addon_groups: p.addon_groups.map((x, i) =>
                      i === gi ? { ...x, min_select: Number(e.target.value) } : x,
                    ),
                  })
                }
              />
            </label>
            <label>
              Máx.
              <input
                aria-label="Máximo de opções"
                type="number"
                min="1"
                max="30"
                value={g.max_select}
                style={{ width: 50 }}
                onChange={(e) =>
                  update({
                    addon_groups: p.addon_groups.map((x, i) =>
                      i === gi ? { ...x, max_select: Number(e.target.value) } : x,
                    ),
                  })
                }
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={g.is_required}
                onChange={(e) =>
                  update({
                    addon_groups: p.addon_groups.map((x, i) =>
                      i === gi ? { ...x, is_required: e.target.checked } : x,
                    ),
                  })
                }
              />
              Obrigatório
            </label>
          </div>
          {g.product_addons.map((a, ai) => (
            <div className="addon-row" key={a.id}>
              <input
                aria-label="Nome do adicional"
                required
                value={a.name}
                onChange={(e) =>
                  update({
                    addon_groups: p.addon_groups.map((x, i) =>
                      i === gi
                        ? {
                            ...x,
                            product_addons: x.product_addons.map((y, j) =>
                              j === ai ? { ...y, name: e.target.value } : y,
                            ),
                          }
                        : x,
                    ),
                  })
                }
              />
              <input
                aria-label="Preço do adicional"
                type="number"
                min="0"
                step="0.01"
                value={a.price}
                onChange={(e) =>
                  update({
                    addon_groups: p.addon_groups.map((x, i) =>
                      i === gi
                        ? {
                            ...x,
                            product_addons: x.product_addons.map((y, j) =>
                              j === ai ? { ...y, price: Number(e.target.value) } : y,
                            ),
                          }
                        : x,
                    ),
                  })
                }
              />
              <button
                type="button"
                onClick={() =>
                  update({
                    addon_groups: p.addon_groups.map((x, i) =>
                      i === gi
                        ? { ...x, product_addons: x.product_addons.filter((y) => y.id !== a.id) }
                        : x,
                    ),
                  })
                }
              >
                ×
              </button>
            </div>
          ))}
          <button
            className="text-xs text-primary mt-2"
            type="button"
            onClick={() =>
              update({
                addon_groups: p.addon_groups.map((x, i) =>
                  i === gi
                    ? {
                        ...x,
                        product_addons: [
                          ...x.product_addons,
                          {
                            id: crypto.randomUUID(),
                            group_id: g.id,
                            name: "Nova opção",
                            description: null,
                            price: 0,
                            is_active: true,
                            sort_order: x.product_addons.length,
                          },
                        ],
                      }
                    : x,
                ),
              })
            }
          >
            + Adicionar opção
          </button>
        </div>
      ))}
      <Button className="w-full mt-5" disabled={busy}>
        {busy ? "Salvando…" : "Salvar produto"}
      </Button>
    </form>
  );
}

function Categories({
  categories,
  onSave,
}: {
  categories: Category[];
  onSave: (c: Category) => Promise<void>;
}) {
  const [editing, setEditing] = useState<Category | null>(null);
  return (
    <>
      <div className="admin-actions">
        <p className="text-xs text-muted-foreground">
          Desative uma categoria para ocultar seus produtos.
        </p>
        <Button
          onClick={() =>
            setEditing({
              id: crypto.randomUUID(),
              name: "Nova categoria",
              slug: `categoria-${crypto.randomUUID().slice(0, 8)}`,
              sort_order: categories.length,
              emoji: null,
              is_active: true,
            })
          }
        >
          Nova categoria
        </Button>
      </div>
      <div className="admin-box">
        {categories.map((c) => (
          <div key={c.id} className="admin-rank">
            <span>
              {c.sort_order + 1}. {c.name} {!c.is_active && "· Oculta"}
            </span>
            <button className="text-primary" onClick={() => setEditing({ ...c })}>
              Editar
            </button>
          </div>
        ))}
      </div>
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogTitle>Categoria</DialogTitle>
          <DialogDescription>Nome, ordem e disponibilidade no cardápio.</DialogDescription>
          {editing && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await onSave(editing);
                setEditing(null);
              }}
            >
              <div className="admin-form-grid">
                <label>
                  Nome
                  <input
                    required
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </label>
                <label>
                  Ordem
                  <input
                    type="number"
                    value={editing.sort_order}
                    onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                  />
                </label>
              </div>
              <label className="flex gap-2 items-center my-4 text-sm">
                <input
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                />
                Visível no cardápio
              </label>
              <Button>Salvar categoria</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function StoreEditor({
  store,
  onSave,
}: {
  store: StoreSettings;
  onSave: (s: StoreSettings) => Promise<void>;
}) {
  const [s, setS] = useState(store);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="admin-box"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSave(s);
        } catch (error) {
          toast.error(errorMessage(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Editor universal da página</h3>
      <p className="text-xs text-muted-foreground mb-6">
        Nome, logomarca, cores, textos, entrega e regras ficam centralizados aqui. Ao salvar, o site
        público inteiro recebe a atualização.
      </p>
      <div className="admin-form-grid">
        <label className="span-two">
          Logomarca (PNG, JPG ou WebP, até 700 KB)
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (
                file.size > 700000 ||
                !["image/png", "image/jpeg", "image/webp"].includes(file.type)
              ) {
                toast.error("Selecione PNG, JPG ou WebP de até 700 KB.");
                return;
              }
              const reader = new FileReader();
              reader.onload = () =>
                setS((current) => ({ ...current, logo_url: String(reader.result) }));
              reader.readAsDataURL(file);
            }}
          />
        </label>
        {s.logo_url && (
          <div className="span-two flex items-center gap-4">
            <img src={s.logo_url} alt="Prévia da logomarca" className="h-16 w-16 object-contain" />
            <button
              type="button"
              className="text-xs text-primary underline"
              onClick={() => setS({ ...s, logo_url: "/images/acai-labor-logo.png" })}
            >
              Restaurar logomarca Açaí Labor
            </button>
          </div>
        )}
        {(
          [
            ["store_name", "Nome da loja"],
            ["tagline", "Frase da marca"],
            ["address_line", "Localização / endereço"],
            ["opening_hours", "Horários"],
            ["whatsapp", "WhatsApp (com 55 e DDD)"],
            ["phone", "Telefone"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <input value={s[key]} onChange={(e) => setS({ ...s, [key]: e.target.value })} />
          </label>
        ))}
        <label className="span-two">
          Descrição
          <textarea
            rows={3}
            value={s.description}
            onChange={(e) => setS({ ...s, description: e.target.value })}
          />
        </label>
        <label>
          Taxa de entrega (R$)
          <input
            type="number"
            min="0"
            max="200"
            step="0.01"
            value={s.delivery_fee}
            onChange={(e) => setS({ ...s, delivery_fee: Number(e.target.value) })}
          />
        </label>
        <label>
          Entrega mínima estimada (min)
          <input
            type="number"
            min="0"
            value={s.delivery_time_min}
            onChange={(e) => setS({ ...s, delivery_time_min: Number(e.target.value) })}
          />
        </label>
        <label>
          Entrega máxima estimada (min)
          <input
            type="number"
            min={s.delivery_time_min}
            value={s.delivery_time_max}
            onChange={(e) => setS({ ...s, delivery_time_max: Number(e.target.value) })}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs my-5">
        <input
          type="checkbox"
          checked={s.is_open}
          onChange={(e) => setS({ ...s, is_open: e.target.checked })}
        />
        Loja aberta para pedidos de teste
      </label>
      <StoreRulesFields
        store={s}
        update={(patch) => setS((current) => ({ ...current, ...patch }))}
      />
      <Button disabled={busy}>{busy ? "Salvando…" : "Salvar configurações"}</Button>
    </form>
  );
}
