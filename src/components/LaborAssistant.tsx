import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, UserRound, ShoppingBag } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  supportOpen,
  supportGet,
  supportSend,
  supportHandoff,
  supportCart,
} from "@/lib/labor.functions";
import type { SupportView } from "@/lib/support.types";
import { useCart } from "@/lib/cart";
import { formatBRL, fetchProducts, type Product } from "@/lib/menu";
import { ProductDialog } from "./ProductDialog";
import "@/styles/support.css";

const message = (e: unknown) => {
  const detail = e instanceof Error ? e.message : "";
  if (!detail || /API|Gemini|HTTP|fetch|server|servidor|endpoint|stack|webhook|token|modelo|TypeError|Cannot|Failed/i.test(detail))
    return "Atendimento indisponível agora. Tente de novo ou fale com nossa equipe.";
  return detail;
};
export function LaborAssistant() {
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<SupportView | null>(null);
  const [name, setName] = useState("Assistente Labor");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [adding, setAdding] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const pending = useRef<{ messageId: string; text: string } | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const { addItem } = useCart();
  async function start() {
    setLoading(true);
    setError("");
    try {
      const result = await supportOpen();
      setName(result.name);
      setEnabled(result.enabled);
      setConversation(result.conversation);
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (open) {
      void start();
      input.current?.focus();
    }
  }, [open]);
  useEffect(() => {
    if (!open || !conversation) return;
    let disposed = false;
    const timer = setInterval(async () => {
      try {
        const c = await supportGet({ data: { id: conversation.id } });
        if (!disposed) setConversation(c);
      } catch {
        /* Preserve the transcript during transient polling errors. */
      }
    }, 3000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [open, conversation?.id]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [conversation?.messages.length, busy]);
  async function send(value = text) {
    if (busy || !conversation || !value.trim()) return;
    const request =
      pending.current?.text === value.trim()
        ? pending.current
        : { messageId: crypto.randomUUID(), text: value.trim() };
    pending.current = request;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setConversation(await supportSend({ data: { id: conversation.id, ...request } }));
      setText("");
      pending.current = null;
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }
  return (
    <>
      <div className="labor-assistant labor-support">
        {open && (
          <section className="support-panel" aria-label="Atendimento Açaí Labor">
            <header className="support-header">
              <div className="support-avatar">
                <MessageCircle size={22} />
              </div>
              <div>
                <strong>{name}</strong>
                <small>
                  {conversation?.mode === "human"
                    ? "Atendimento humano"
                    : conversation?.mode === "waiting"
                      ? "Aguardando a loja"
                      : "Assistente virtual"}
                </small>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Minimizar atendimento">
                <X size={20} />
              </button>
            </header>
            <div
              className="support-history"
              role="log"
              aria-label="Histórico da conversa"
              aria-live="polite"
            >
              {loading && <p role="status">Abrindo sua conversa…</p>}
              {!enabled && (
                <p>Atendimento desativado no momento. Você pode consultar o cardápio.</p>
              )}
              {conversation?.messages.map((m) => (
                <article className={`support-message ${m.role}`} key={m.id}>
                  <span className="support-author">
                    {m.role === "customer"
                      ? "Você"
                      : m.role === "human"
                        ? "Equipe Labor"
                        : m.role === "system"
                          ? "Atendimento"
                          : name}
                  </span>
                  <p>{m.text}</p>
                  {m.cards?.map((p) => (
                    <div className="support-product" key={p.id}>
                      <strong>{p.name}</strong>
                      <span>
                        {p.priceFrom ? "A partir de " : ""}
                        {formatBRL(p.price)} · {p.available ? "Disponível" : "Esgotado"}
                      </span>
                      {p.description && <p>{p.description}</p>}
                      {p.canAdd ? (
                        <button
                          disabled={!!adding}
                          onClick={async () => {
                            if (!conversation) return;
                            setAdding(p.id);
                            setError("");
                            try {
                              const item = await supportCart({
                                data: { id: conversation.id, messageId: m.id, productId: p.id },
                              });
                              addItem(item);
                              setNotice(`${item.quantity} × ${item.name} adicionado ao carrinho.`);
                            } catch (e) {
                              setError(message(e));
                            } finally {
                              setAdding("");
                            }
                          }}
                        >
                          <ShoppingBag size={14} />
                          {adding === p.id ? "Adicionando…" : `Adicionar ${p.quantity}`}
                        </button>
                      ) : null}
                      <button
                        disabled={!!adding}
                        onClick={async () => {
                          setAdding(p.id);
                          setError("");
                          try {
                            const product = (await fetchProducts()).find(
                              (product) => product.id === p.id,
                            );
                            if (!product)
                              throw new Error("Produto não está mais disponível no cardápio.");
                            setSelectedProduct(product);
                            setOpen(false);
                          } catch (e) {
                            setError(message(e));
                          } finally {
                            setAdding("");
                          }
                        }}
                      >
                        Ver produto e opções
                      </button>
                    </div>
                  ))}
                  <time dateTime={m.at}>
                    {new Date(m.at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </article>
              ))}
              {busy && (
                <p role="status" className="support-typing">
                  Consultando sua mensagem…
                </p>
              )}
              <div ref={end} />
            </div>
            {error && (
              <p className="support-error" role="alert">
                {error} {!conversation && <button onClick={start}>Tentar novamente</button>}
              </p>
            )}
            {notice && (
              <p className="support-notice" role="status">
                {notice}{" "}
                <Link to="/carrinho" onClick={() => setOpen(false)}>
                  Ver carrinho
                </Link>
              </p>
            )}
            {conversation?.mode === "closed" ? (
              <button className="support-reopen" onClick={start}>
                Iniciar nova conversa
              </button>
            ) : (
              enabled && (
                <>
                  <div className="support-shortcuts">
                    <button disabled={busy || !conversation} onClick={() => send("Ver ofertas")}>
                      Ofertas
                    </button>
                    <button
                      disabled={busy || !conversation}
                      onClick={() => send("Horários e entrega")}
                    >
                      Entrega
                    </button>
                    <button
                      disabled={!conversation || conversation.mode !== "automatic"}
                      onClick={async () => {
                        if (!conversation) return;
                        setError("");
                        try {
                          setConversation(await supportHandoff({ data: { id: conversation.id } }));
                        } catch (e) {
                          setError(message(e));
                        }
                      }}
                    >
                      <UserRound size={13} />
                      Solicitar atendente
                    </button>
                  </div>
                  <form
                    className="support-compose"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void send();
                    }}
                  >
                    <input
                      ref={input}
                      aria-label="Mensagem para atendimento"
                      placeholder="O que você procura?"
                      value={text}
                      maxLength={1000}
                      onChange={(e) => setText(e.target.value)}
                      disabled={busy || !conversation}
                    />
                    <button
                      aria-label="Enviar mensagem"
                      disabled={busy || !text.trim() || !conversation}
                    >
                      <Send size={18} />
                    </button>
                  </form>
                </>
              )
            )}
            <footer>
              Histórico disponível por 30 dias sem atividade. IA, quando ativada, usa as últimas 5
              mensagens. Não envie dados de cartão.{" "}
              <Link to="/privacidade" onClick={() => setOpen(false)}>
                Privacidade
              </Link>
            </footer>
          </section>
        )}
        <button
          className="assistant-toggle"
          aria-label={open ? "Fechar ajuda" : "Ajuda com o catálogo"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={21} /> : <MessageCircle size={21} />}
        </button>
      </div>
      <ProductDialog
        product={selectedProduct}
        open={!!selectedProduct}
        onOpenChange={(open) => {
          if (!open) setSelectedProduct(null);
        }}
      />
    </>
  );
}
