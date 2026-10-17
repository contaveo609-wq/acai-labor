import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Send, X } from "lucide-react";
import { askAttendant } from "@/lib/chat.functions";
import { fetchStoreSettings, whatsappLink } from "@/lib/menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Msg = { role: "user" | "assistant"; content: string };

export function Chatbot() {
  const ask = useServerFn(askAttendant);
  const { data: store } = useQuery({ queryKey: ["store"], queryFn: fetchStoreSettings });
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showWhats, setShowWhats] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Olá! Sou o atendente virtual da Skina do Frango & Assados. Posso te ajudar com cardápio, preços, porções e adicionais. O que você procura hoje?",
    },
  ]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const result = await ask({ data: { messages: next.slice(-14) } });
      setMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
      if (result.needsWhatsapp) setShowWhats(true);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Tive um problema para responder agora. Fale com a gente pelo WhatsApp.",
        },
      ]);
      setShowWhats(true);
    } finally {
      setBusy(false);
    }
  }

  const wa = store?.whatsapp ?? "556681055779";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fechar atendimento virtual" : "Abrir atendimento virtual"}
        className="fixed bottom-5 left-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform hover:scale-105"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {open ? (
        <div className="fixed bottom-24 left-3 right-3 z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:left-5 sm:right-auto sm:w-96">
          <div className="brand-gradient px-4 py-3 text-primary-foreground">
            <p className="font-display text-xl">Atendente Skina</p>
            <p className="text-xs opacity-90">Respostas baseadas no cardápio real</p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-1 [&_strong]:font-semibold ${
                  m.role === "user"
                    ? "ml-auto whitespace-pre-wrap bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {m.role === "assistant" ? <ReactMarkdown>{m.content}</ReactMarkdown> : m.content}
              </div>
            ))}
            {busy ? <p className="text-xs text-muted-foreground">Digitando...</p> : null}
            {showWhats ? (
              <a
                href={whatsappLink(wa, "Olá! Preciso de ajuda com um pedido.")}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl bg-success px-3 py-2 text-center text-sm font-semibold text-success-foreground"
              >
                Falar com atendente no WhatsApp
              </a>
            ) : null}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex gap-2 border-t border-border p-2"
          >
            <Input
              value={input}
              maxLength={500}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua dúvida..."
              aria-label="Mensagem para o atendente virtual"
            />
            <Button type="submit" size="icon" disabled={busy} aria-label="Enviar mensagem">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      ) : null}
    </>
  );
}
