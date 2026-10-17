import { createFileRoute } from "@tanstack/react-router";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FlaskConical, CheckCircle2, XCircle, Clock, AlertCircle,
  RefreshCw, Send, ExternalLink, Info, Bot, Trash2, MessageSquare,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  runIntegrationTests, sendWhatsAppCloudMessage,
  simulateConversation, getSimulatorHistory,
} from "@/lib/whatsapp.server";

export const Route = createFileRoute("/admin/testes-integracoes")({
  component: AdminTestesPage,
});

type TestResult = {
  id: string;
  name: string;
  status: "passed" | "failed" | "pending" | "skipped";
  detail?: string;
  duration?: number;
};

type ChatMessage = {
  role: "user" | "model";
  content: string;
  created_at?: string;
};

function StatusIcon({ status }: { status: TestResult["status"] }) {
  if (status === "passed") return <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />;
  if (status === "failed") return <XCircle className="w-5 h-5 text-red-600 shrink-0" />;
  if (status === "pending") return <Clock className="w-5 h-5 text-yellow-500 shrink-0 animate-pulse" />;
  return <AlertCircle className="w-5 h-5 text-slate-400 shrink-0" />;
}

function StatusBadge({ status }: { status: TestResult["status"] }) {
  const map = {
    passed: "bg-green-100 text-green-800 border-green-200",
    failed: "bg-red-100 text-red-800 border-red-200",
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    skipped: "bg-slate-100 text-slate-600 border-slate-200",
  };
  const labels = { passed: "Aprovado", failed: "Reprovado", pending: "Testando...", skipped: "Não testado" };
  return (
    <Badge variant="outline" className={`text-xs ${map[status]}`}>
      {labels[status]}
    </Badge>
  );
}

// ============================================================
// Conversation Simulator Component
// ============================================================
function ConversationSimulator() {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [lastInfo, setLastInfo] = useState<{
    tokensUsed?: number; model?: string; contextUsed?: number;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const SIMULATOR_PHONE = "TEST_SIMULATOR";

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const r = await getSimulatorHistory({ data: { phone: SIMULATOR_PHONE } });
      setHistory((r as any).messages ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const sendMessage = async (overrideMessage?: string) => {
    const msg = (overrideMessage ?? inputMessage).trim();
    if (!msg) return;
    setInputMessage("");
    setIsSending(true);

    // Optimistic update
    const userMsg: ChatMessage = { role: "user", content: msg, created_at: new Date().toISOString() };
    setHistory((prev) => [...prev, userMsg]);

    try {
      const r = await simulateConversation({
        data: { phone: SIMULATOR_PHONE, message: msg, clearHistory: false },
      });
      if ((r as any).success) {
        const aiMsg: ChatMessage = {
          role: "model",
          content: (r as any).reply,
          created_at: new Date().toISOString(),
        };
        setHistory((prev) => [...prev, aiMsg]);
        setLastInfo({
          tokensUsed: (r as any).tokensUsed,
          model: (r as any).model,
          contextUsed: (r as any).contextUsed,
        });
      } else {
        toast.error("Erro: " + (r as any).error);
        // Remove optimistic message
        setHistory((prev) => prev.filter((m) => m !== userMsg));
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro");
      setHistory((prev) => prev.filter((m) => m !== userMsg));
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const clearHistory = async () => {
    setIsClearing(true);
    try {
      await simulateConversation({
        data: { phone: SIMULATOR_PHONE, message: ".", clearHistory: true },
      });
      setHistory([]);
      setLastInfo(null);
      toast.success("Histórico do simulador limpo.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao limpar");
    } finally {
      setIsClearing(false);
    }
  };

  const sendExample = (msg: string) => sendMessage(msg);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="w-5 h-5 text-indigo-600" />Simulador de Conversa com IA
            </CardTitle>
            <CardDescription>
              Teste o atendimento com memória contextual real (últimas {5} mensagens). 
              As mensagens são persistidas no banco até você limpar o histórico.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={clearHistory}
            disabled={isClearing || history.length === 0}
            className="text-red-600 border-red-300"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {isClearing ? "Limpando..." : "Limpar histórico"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Example prompts for memory test */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-indigo-800">
            📝 Teste de memória contextual — envie nesta ordem:
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              "Quero 2 frangos.",
              "Quanto fica?",
              "E se eu tirar 1?",
              "Tem entrega?",
              "Quanto fica tudo com entrega?",
            ].map((msg) => (
              <button
                key={msg}
                onClick={() => sendExample(msg)}
                disabled={isSending}
                className="text-xs bg-white border border-indigo-300 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50 disabled:opacity-50 transition-colors"
              >
                {msg}
              </button>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div
          ref={scrollRef}
          className="h-80 overflow-y-auto space-y-3 p-3 bg-slate-50 rounded-lg border"
        >
          {isLoadingHistory && (
            <div className="text-center text-sm text-muted-foreground py-4">
              <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Carregando histórico...
            </div>
          )}
          {!isLoadingHistory && history.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p>Nenhuma mensagem ainda.</p>
              <p className="text-xs mt-1">Use os exemplos acima ou digite uma mensagem abaixo.</p>
            </div>
          )}
          {history.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-none"
                    : "bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm"
                }`}
              >
                {msg.role === "model" && (
                  <div className="flex items-center gap-1 mb-1">
                    <Bot className="w-3 h-3 text-indigo-600" />
                    <span className="text-[10px] text-indigo-600 font-semibold">IA</span>
                  </div>
                )}
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.created_at && (
                  <p className={`text-[10px] mt-1 ${msg.role === "user" ? "text-indigo-200" : "text-gray-400"}`}>
                    {new Date(msg.created_at).toLocaleTimeString("pt-BR")}
                  </p>
                )}
              </div>
            </div>
          ))}
          {isSending && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 text-gray-500 px-3 py-2 rounded-xl rounded-bl-none text-sm">
                <RefreshCw className="w-3 h-3 animate-spin inline mr-2" />A IA está respondendo...
              </div>
            </div>
          )}
        </div>

        {/* Last response info */}
        {lastInfo && (
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {lastInfo.model && <Badge variant="outline" className="font-mono text-[10px]">{lastInfo.model}</Badge>}
            {lastInfo.tokensUsed !== undefined && (
              <span>Tokens usados: <strong>{lastInfo.tokensUsed}</strong></span>
            )}
            {lastInfo.contextUsed !== undefined && (
              <span>Mensagens no contexto: <strong>{lastInfo.contextUsed}</strong></span>
            )}
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Digite a mensagem do cliente..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={isSending}
            className="flex-1"
          />
          <Button
            onClick={() => sendMessage()}
            disabled={isSending || !inputMessage.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Enter para enviar. As últimas 5 mensagens são enviadas como contexto a cada resposta.
        </p>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Main Page
// ============================================================
function AdminTestesPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [testedAt, setTestedAt] = useState<string | null>(null);
  const [sendPhone, setSendPhone] = useState("");
  const [sendMessage, setSendMessage] = useState("Teste de integração Skina do Frango - mensagem de verificação.");
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleRunTests = async () => {
    setIsRunning(true);
    setResults([]);
    setSendResult(null);
    try {
      const r = await runIntegrationTests();
      setResults((r as any).results ?? []);
      setTestedAt((r as any).testedAt ?? null);
      const passed = ((r as any).results ?? []).filter((x: TestResult) => x.status === "passed").length;
      const total = ((r as any).results ?? []).length;
      if (passed === total) {
        toast.success(`Todos os ${total} testes aprovados!`);
      } else {
        toast.warning(`${passed}/${total} testes aprovados.`);
      }
    } catch (e: unknown) {
      toast.error("Erro ao executar testes: " + (e instanceof Error ? e.message : "Erro desconhecido"));
    } finally {
      setIsRunning(false);
    }
  };

  const handleSendTest = async () => {
    if (!sendPhone.trim()) { toast.error("Informe o número de destino."); return; }
    setIsSending(true);
    setSendResult(null);
    try {
      const r = await sendWhatsAppCloudMessage({
        data: { to_phone: sendPhone.trim(), message: sendMessage },
      });
      if ((r as any).success) {
        setSendResult({ ok: true, msg: `Mensagem enviada! ID: ${(r as any).messageId ?? "n/d"}` });
        toast.success("Mensagem enviada com sucesso!");
      } else {
        setSendResult({ ok: false, msg: (r as any).error ?? "Falha ao enviar" });
        toast.error("Erro: " + (r as any).error);
      }
    } catch (e: unknown) {
      setSendResult({ ok: false, msg: e instanceof Error ? e.message : "Erro" });
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setIsSending(false);
    }
  };

  const passed = results.filter((r) => r.status === "passed").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const total = results.length;

  const waTests = results.filter((r) => r.id.startsWith("wa_"));
  const geminiTests = results.filter((r) => r.id.startsWith("gemini_"));
  const flowTests = results.filter((r) => r.id.startsWith("full_") || r.id.startsWith("webhook_"));

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
            <FlaskConical className="w-8 h-8 text-violet-600" />Diagnóstico da IA
          </h1>
          <p className="text-muted-foreground mt-2">
            Valide a integração WhatsApp + Gemini e simule conversas com memória contextual.
          </p>
        </div>
        <Button
          className="bg-violet-600 hover:bg-violet-700 text-white"
          onClick={handleRunTests}
          disabled={isRunning}
        >
          {isRunning
            ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Executando...</>
            : <><FlaskConical className="w-4 h-4 mr-2" />Executar Todos os Testes</>
          }
        </Button>
      </div>

      <Tabs defaultValue="testes" className="w-full">
        <TabsList>
          <TabsTrigger value="testes">
            <FlaskConical className="w-4 h-4 mr-2" />Testes de Integração
          </TabsTrigger>
          <TabsTrigger value="simulador">
            <Bot className="w-4 h-4 mr-2" />Simulador de Conversa
          </TabsTrigger>
          <TabsTrigger value="whatsapp">
            <Send className="w-4 h-4 mr-2" />Envio Manual
          </TabsTrigger>
        </TabsList>

        {/* ===== TAB: TESTS ===== */}
        <TabsContent value="testes" className="space-y-5 mt-5">

          {/* Summary */}
          {total > 0 && (
            <div className="grid grid-cols-3 gap-4">
              <Card className="border-green-200 bg-green-50/50">
                <CardContent className="pt-4 pb-4 text-center">
                  <div className="text-3xl font-bold text-green-700">{passed}</div>
                  <div className="text-sm text-green-600 mt-1">Aprovados</div>
                </CardContent>
              </Card>
              <Card className="border-red-200 bg-red-50/50">
                <CardContent className="pt-4 pb-4 text-center">
                  <div className="text-3xl font-bold text-red-700">{failed}</div>
                  <div className="text-sm text-red-600 mt-1">Reprovados</div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 bg-slate-50/50">
                <CardContent className="pt-4 pb-4 text-center">
                  <div className="text-3xl font-bold text-slate-700">{total}</div>
                  <div className="text-sm text-slate-600 mt-1">Total</div>
                </CardContent>
              </Card>
            </div>
          )}

          {testedAt && (
            <p className="text-xs text-muted-foreground">
              Executado em: {new Date(testedAt).toLocaleString("pt-BR")}
            </p>
          )}

          {/* Test Groups */}
          {total > 0 && (
            <div className="space-y-4">
              {[
                { label: "WhatsApp Cloud API", tests: waTests, color: "text-green-700" },
                { label: "Gemini AI", tests: geminiTests, color: "text-blue-700" },
                { label: "Fluxo Completo & Webhook", tests: flowTests, color: "text-violet-700" },
              ].map(
                (group) =>
                  group.tests.length > 0 && (
                    <Card key={group.label} className="shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className={`text-base ${group.color}`}>{group.label}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {group.tests.map((test) => (
                          <div
                            key={test.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border ${
                              test.status === "passed"
                                ? "bg-green-50/50 border-green-200/60"
                                : test.status === "failed"
                                ? "bg-red-50/50 border-red-200/60"
                                : "bg-slate-50 border-slate-200"
                            }`}
                          >
                            <StatusIcon status={test.status} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                  {test.name}
                                </span>
                                <div className="flex items-center gap-2">
                                  {test.duration != null && (
                                    <span className="text-xs text-muted-foreground">{test.duration}ms</span>
                                  )}
                                  <StatusBadge status={test.status} />
                                </div>
                              </div>
                              {test.detail && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 break-words">
                                  {test.detail}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )
              )}
            </div>
          )}

          {total === 0 && !isRunning && (
            <Card className="border-dashed border-2 bg-slate-50/50 h-40 flex flex-col items-center justify-center text-slate-500">
              <FlaskConical className="w-10 h-10 mb-3 text-slate-300" />
              <p className="text-sm font-medium">Nenhum teste executado ainda</p>
              <p className="text-xs mt-1">Clique em "Executar Todos os Testes" para iniciar</p>
            </Card>
          )}

          {/* External config guide */}
          <Card className="border-blue-200/60 bg-blue-50/30 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600" />Configurações Externas Necessárias
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-blue-800/80">Para que os testes reais passem, você precisa:</p>
              <div className="space-y-2">
                {[
                  { step: "1", text: "Criar um App no painel de desenvolvedores da Meta (developers.facebook.com)", link: "https://developers.facebook.com" },
                  { step: "2", text: "Adicionar o produto WhatsApp ao app e obter o Phone Number ID e WABA ID", link: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" },
                  { step: "3", text: "Gerar um token de acesso permanente (System User Token recomendado)", link: "https://developers.facebook.com/docs/whatsapp/business-management-api/get-started" },
                  { step: "4", text: "Configurar WHATSAPP_ACCESS_TOKEN como variável de ambiente no servidor", link: null },
                  { step: "5", text: "Registrar a URL do webhook (/api/webhook/whatsapp) no painel da Meta com o token de verificação", link: null },
                  { step: "6", text: "Salvar a chave Gemini no painel (aba Chatbot → Inserir Chave Gemini) ou definir GEMINI_API_KEY no servidor", link: "https://aistudio.google.com/app/apikey" },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shrink-0 mt-0.5">
                      {item.step}
                    </div>
                    <p className="text-blue-800/80 text-xs flex-1">
                      {item.text}
                      {item.link && (
                        <a href={item.link} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 underline">
                          Ver docs <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== TAB: SIMULATOR ===== */}
        <TabsContent value="simulador" className="mt-5">
          <ConversationSimulator />
        </TabsContent>

        {/* ===== TAB: MANUAL SEND ===== */}
        <TabsContent value="whatsapp" className="mt-5">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Send className="w-4 h-4 text-green-600" />Enviar Mensagem de Teste (WhatsApp)
              </CardTitle>
              <CardDescription>
                Envia uma mensagem real via Cloud API para um número autorizado no painel da Meta.
                Em contas de teste, apenas números registrados como destinatários de teste são aceitos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <Info className="w-3 h-3 inline mr-1" />
                <strong>Conta de teste Meta:</strong> Para enviar para números não verificados, a conta precisa estar em modo de produção.
                Adicione o número como destinatário em{" "}
                <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="underline">
                  developers.facebook.com
                </a>.
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Número de Destino</Label>
                  <Input
                    value={sendPhone}
                    onChange={(e) => setSendPhone(e.target.value)}
                    placeholder="+55 66 90000-0000"
                  />
                  <p className="text-xs text-muted-foreground">Formato internacional, ex: 5566900000000</p>
                </div>
                <div className="space-y-2">
                  <Label>Mensagem</Label>
                  <Input value={sendMessage} onChange={(e) => setSendMessage(e.target.value)} />
                </div>
              </div>
              <Button
                onClick={handleSendTest}
                disabled={isSending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isSending
                  ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Enviando...</>
                  : <><Send className="w-4 h-4 mr-2" />Enviar Mensagem de Teste</>
                }
              </Button>
              {sendResult && (
                <div className={`p-3 rounded-lg border text-sm ${sendResult.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
                  {sendResult.ok
                    ? <CheckCircle2 className="w-4 h-4 inline mr-2" />
                    : <XCircle className="w-4 h-4 inline mr-2" />
                  }
                  {sendResult.msg}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
