import { createFileRoute } from "@tanstack/react-router";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Bot, Save, Sparkles, Key, Zap, ExternalLink, RefreshCw,
  CheckCircle2, XCircle, AlertCircle, Info, Eye, EyeOff, Trash2,
  ShieldCheck, Globe, Lock,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  getGeminiConfigSafe, saveGeminiConfig, testGeminiConnection, listGeminiModels,
  removeGeminiApiKey,
} from "@/lib/whatsapp.server";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/chatbot")({
  component: AdminChatbotPage,
});

// ============================================================
// Gemini Free-Tier Limits (fontes oficiais — outubro 2026)
// Ref: https://ai.google.dev/pricing
// ============================================================
const GEMINI_MODELS_FREE = [
  {
    id: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash Lite",
    tag: "RECOMENDADO",
    tagColor: "bg-green-600",
    desc: "Modelo mais leve e rápido. Ideal para atendimento de alto volume.",
    speed: "Muito rápido",
    quality: "Boa para atendimento simples",
    rpm: 15,
    rpd: 1500,
    tpm: 1000000,
    estimatedDailyConversations: "~150–300",
    freeTier: true,
    note: "Recomendado para volume alto e respostas objetivas",
    recommended: true,
  },
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    tag: "BALANCEADO",
    tagColor: "bg-blue-600",
    desc: "Mais inteligente, ideal para conversas complexas.",
    speed: "Rápido",
    quality: "Ótima para atendimento complexo",
    rpm: 10,
    rpd: 500,
    tpm: 250000,
    estimatedDailyConversations: "~50–100",
    freeTier: true,
    note: "Bom equilíbrio entre qualidade e limite gratuito",
    recommended: false,
  },
];

function ModelCard({
  model,
  selected,
  onSelect,
  freeTierOnly,
}: {
  model: typeof GEMINI_MODELS_FREE[0];
  selected: boolean;
  onSelect: () => void;
  freeTierOnly: boolean;
}) {
  const blocked = freeTierOnly && !model.freeTier;
  return (
    <div className="relative">
      <div
        onClick={blocked ? undefined : onSelect}
        className={`flex flex-col h-full p-4 border-2 rounded-xl transition-all ${
          blocked
            ? "opacity-40 cursor-not-allowed border-gray-200 bg-gray-50"
            : selected
            ? "border-indigo-600 bg-indigo-50/30 dark:bg-indigo-900/10 cursor-pointer shadow-md"
            : "border-gray-200 bg-white dark:bg-slate-800 hover:border-gray-300 cursor-pointer hover:shadow-sm"
        }`}
      >
        {model.recommended && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            RECOMENDADO
          </div>
        )}
        <div className="flex items-center justify-between mb-2 mt-1">
          <span className="font-bold text-gray-900 dark:text-white text-sm">{model.name}</span>
          <Badge className={`${model.tagColor} text-white text-[9px] px-1.5 py-0.5`}>{model.tag}</Badge>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 flex-1 mb-3">{model.desc}</p>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Velocidade:</span>
            <span className="font-medium">{model.speed}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Qualidade:</span>
            <span className="font-medium text-right">{model.quality}</span>
          </div>
          {model.freeTier ? (
            <>
              <Separator className="my-1" />
              <div className="flex justify-between">
                <span className="text-muted-foreground">RPM (grátis):</span>
                <span className="font-mono text-green-700">{model.rpm}/min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">RPD (grátis):</span>
                <span className="font-mono text-green-700">{model.rpd}/dia</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Conversas/dia:</span>
                <span className="font-mono text-blue-700">{model.estimatedDailyConversations}</span>
              </div>
            </>
          ) : (
            <div className="mt-1 text-[10px] text-red-600 font-medium">Requer faturamento ativo</div>
          )}
        </div>
        {model.freeTier && (
          <div className="mt-3 pt-2 border-t text-[10px] text-green-700 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Disponível no plano gratuito
          </div>
        )}
      </div>
    </div>
  );
}

function AdminChatbotPage() {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [greeting, setGreeting] = useState("");
  const [isActiveSite, setIsActiveSite] = useState(false);
  const [isActiveWA, setIsActiveWA] = useState(false);
  const [geminiModel, setGeminiModel] = useState("gemini-3.5-flash-lite");
  const [dailyLimit, setDailyLimit] = useState(500);
  const [contextWindow, setContextWindow] = useState(5);
  const [freeTierOnly, setFreeTierOnly] = useState(true);

  // Gemini key field — properly editable
  const [geminiKey, setGeminiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keyMode, setKeyMode] = useState<"hidden" | "entering" | "changing">("hidden");
  const keyInputRef = useRef<HTMLInputElement>(null);

  const [testResult, setTestResult] = useState<{ ok: boolean; detail: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [isRemovingKey, setIsRemovingKey] = useState(false);

  // Site chatbot config
  const { data: siteConfig } = useQuery({
    queryKey: ["admin_chatbot_config"],
    queryFn: async () => {
      const { data } = await supabase.from("chatbot_settings").select("*").maybeSingle();
      return data;
    },
  });

  // Gemini config
  const { data: geminiConfig, isLoading } = useQuery({
    queryKey: ["admin_gemini_config"],
    queryFn: () => getGeminiConfigSafe(),
  });

  useEffect(() => {
    if (siteConfig) {
      setPrompt((siteConfig as any).system_prompt ?? "");
      setGreeting((siteConfig as any).welcome_message ?? "");
      setIsActiveSite((siteConfig as any).is_enabled ?? false);
    }
  }, [siteConfig]);

  useEffect(() => {
    if (geminiConfig) {
      setGeminiModel((geminiConfig as any).gemini_model ?? "gemini-3.5-flash-lite");
      setDailyLimit((geminiConfig as any).daily_limit ?? 500);
      setIsActiveWA((geminiConfig as any).is_active ?? false);
      setFreeTierOnly((geminiConfig as any).free_tier_only ?? true);
      setContextWindow((geminiConfig as any).context_window ?? 5);
      // If key is configured, stay in hidden mode
      if ((geminiConfig as any)?.has_api_key) {
        setKeyMode("hidden");
      }
    }
  }, [geminiConfig]);

  const hasApiKey = !!(geminiConfig as any)?.has_api_key;
  const apiKeySource = (geminiConfig as any)?.api_key_source as string | null;
  const keyMasked = (geminiConfig as any)?.gemini_api_key_masked as string | null;
  const keySetAt = (geminiConfig as any)?.gemini_api_key_set_at as string | null;

  const saveSiteMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        system_prompt: prompt,
        welcome_message: greeting,
        is_enabled: isActiveSite,
        id: (siteConfig as any)?.id,
      };
      if ((siteConfig as any)?.id) {
        await supabase.from("chatbot_settings").update(payload).eq("id", (siteConfig as any).id);
      } else {
        await supabase.from("chatbot_settings").insert(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_chatbot_config"] });
      toast.success("Configurações do chatbot do site salvas!");
    },
    onError: () => toast.error("Erro ao salvar."),
  });

  const saveGeminiMutation = useMutation({
    mutationFn: () =>
      saveGeminiConfig({
        data: {
          gemini_api_key: geminiKey || undefined,
          gemini_model: geminiModel,
          ai_instructions: prompt,
          is_active: isActiveWA,
          daily_limit: dailyLimit,
          free_tier_only: freeTierOnly,
          context_window: contextWindow,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_gemini_config"] });
      setGeminiKey("");
      setKeyMode("hidden");
      toast.success("Configurações Gemini salvas com sucesso!");
    },
    onError: (e: unknown) =>
      toast.error("Erro: " + (e instanceof Error ? e.message : "Erro")),
  });

  const handleTestGemini = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const r = await testGeminiConnection();
      if ((r as any).success) {
        setTestResult({
          ok: true,
          detail: `Resposta: "${(r as any).reply}" | Modelo: ${(r as any).model} | Tempo: ${(r as any).elapsed}ms | Tokens: ${(r as any).tokensUsed ?? "n/d"}`,
        });
        toast.success("Conexão com Gemini verificada!");
      } else {
        setTestResult({ ok: false, detail: (r as any).error ?? "Falha" });
        toast.error("Falha: " + (r as any).error);
      }
    } catch (e: unknown) {
      setTestResult({ ok: false, detail: e instanceof Error ? e.message : "Erro" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleFetchModels = async () => {
    setIsFetchingModels(true);
    try {
      const r = await listGeminiModels();
      if ((r as any).success && (r as any).models.length > 0) {
        const names = (r as any).models.map((m: Record<string, unknown>) => {
          const name = m["name"] as string;
          return name.replace("models/", "");
        });
        setAvailableModels(names);
        toast.success(`${names.length} modelos encontrados na sua conta.`);
      } else {
        toast.error((r as any).error ?? "Nenhum modelo encontrado.");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao consultar modelos");
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleRemoveKey = async () => {
    setIsRemovingKey(true);
    try {
      await removeGeminiApiKey();
      queryClient.invalidateQueries({ queryKey: ["admin_gemini_config"] });
      setGeminiKey("");
      setKeyMode("hidden");
      toast.success("Chave Gemini removida do banco de dados.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover chave");
    } finally {
      setIsRemovingKey(false);
    }
  };

  const startEnteringKey = () => {
    setKeyMode(hasApiKey ? "changing" : "entering");
    setGeminiKey("");
    setTimeout(() => keyInputRef.current?.focus(), 100);
  };

  const cancelKeyEntry = () => {
    setGeminiKey("");
    setKeyMode("hidden");
  };

  if (isLoading)
    return <div className="p-6 text-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
            <Bot className="w-8 h-8 text-indigo-600" />Atendente IA — Gemini
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure a inteligência artificial de atendimento no WhatsApp e no site.
          </p>
        </div>
      </div>

      <Tabs defaultValue="whatsapp" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="whatsapp" className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />IA — WhatsApp (Gemini)
          </TabsTrigger>
          <TabsTrigger value="modelos" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />Modelos e Limites Gratuitos
          </TabsTrigger>
          <TabsTrigger value="site" className="flex items-center gap-2">
            <Bot className="w-4 h-4" />Chatbot do Site
          </TabsTrigger>
        </TabsList>

        {/* ===== TAB: GEMINI / WhatsApp ===== */}
        <TabsContent value="whatsapp" className="space-y-6">

          {/* API Key Card — FULLY FUNCTIONAL */}
          <Card className="border-indigo-100 shadow-sm">
            <CardHeader className="bg-indigo-50/50 border-b border-indigo-50 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-indigo-900">
                    <Key className="h-5 w-5 text-indigo-600" />Chave da API Gemini
                  </CardTitle>
                  <CardDescription className="mt-1">
                    A chave é armazenada com segurança no banco (acesso exclusivo do servidor). O conteúdo nunca é devolvido ao navegador.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{isActiveWA ? "IA Ativa" : "Inativa"}</span>
                  <Switch checked={isActiveWA} onCheckedChange={setIsActiveWA} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">

              {/* Status indicator */}
              <div className={`flex items-center gap-3 p-3 rounded-lg border ${hasApiKey ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
                {hasApiKey
                  ? <ShieldCheck className="w-5 h-5 text-green-600 shrink-0" />
                  : <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                }
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${hasApiKey ? "text-green-800" : "text-amber-800"}`}>
                    {hasApiKey
                      ? "Chave Gemini configurada"
                      : "Chave Gemini não configurada"
                    }
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {hasApiKey
                      ? <>
                          {keyMasked && <span className="font-mono">{keyMasked}</span>}
                          {apiKeySource === "env" && <span className="ml-2 text-blue-600">(variável de ambiente)</span>}
                          {apiKeySource === "db" && <span className="ml-2 text-green-600">(salva no banco)</span>}
                          {keySetAt && <span className="ml-2 text-gray-500">— definida em {new Date(keySetAt).toLocaleDateString("pt-BR")}</span>}
                        </>
                      : "Insira e salve a chave AIzaSy... do Google AI Studio para ativar as respostas automáticas."
                    }
                  </p>
                </div>
              </div>

              {/* Key input area */}
              {keyMode === "hidden" ? (
                <div className="flex flex-wrap gap-2">
                  {!hasApiKey ? (
                    <Button
                      className="bg-indigo-600 hover:bg-indigo-700 text-white"
                      onClick={startEnteringKey}
                    >
                      <Key className="w-4 h-4 mr-2" />Inserir Chave Gemini
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" size="sm" onClick={startEnteringKey} className="text-indigo-700 border-indigo-300">
                        <Key className="w-4 h-4 mr-2" />Alterar Chave
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTestGemini}
                        disabled={isTesting}
                        className="text-green-700 border-green-300"
                      >
                        {isTesting
                          ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Testando...</>
                          : <><CheckCircle2 className="w-4 h-4 mr-2" />Testar Conexão</>
                        }
                      </Button>
                      {apiKeySource === "db" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRemoveKey}
                          disabled={isRemovingKey}
                          className="text-red-600 border-red-300"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />{isRemovingKey ? "Removendo..." : "Remover Chave"}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open("https://aistudio.google.com/app/apikey", "_blank")}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />Google AI Studio
                      </Button>
                    </>
                  )}
                  {!hasApiKey && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open("https://aistudio.google.com/app/apikey", "_blank")}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />Obter chave no AI Studio
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3 bg-amber-50 dark:bg-amber-900/10 p-4 rounded-lg border border-amber-200">
                  <Label className="text-amber-900 font-semibold flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    {keyMode === "changing" ? "Nova Chave da API Gemini" : "Chave da API Gemini"}
                  </Label>
                  {keyMode === "changing" && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        A nova chave substituirá a atual. Após salvar, será armazenada com segurança no banco.
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="relative max-w-lg">
                    <input
                      ref={keyInputRef}
                      id="gemini-api-key-input"
                      autoComplete="off"
                      spellCheck={false}
                      autoCorrect="off"
                      autoCapitalize="off"
                      type={showKey ? "text" : "password"}
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      placeholder={hasApiKey ? "Cole a nova chave AIza... aqui" : "Cole ou digite a chave AIzaSy... aqui"}
                      className="w-full h-10 px-3 py-2 pr-10 rounded-md border border-amber-300 bg-white dark:bg-slate-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1"
                      tabIndex={-1}
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {geminiKey && (
                    <p className="text-xs text-green-700">
                      ✓ {geminiKey.length} caracteres inseridos{geminiKey.startsWith("AIza") ? " — formato válido" : " — verifique o formato (deve começar com AIza)"}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Button
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white"
                      onClick={() => saveGeminiMutation.mutate()}
                      disabled={saveGeminiMutation.isPending || !geminiKey.trim()}
                    >
                      {saveGeminiMutation.isPending
                        ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                        : <><Save className="w-4 h-4 mr-2" />Salvar Chave</>
                      }
                    </Button>
                    <Button variant="ghost" size="sm" onClick={cancelKeyEntry}>
                      Cancelar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open("https://aistudio.google.com/app/apikey", "_blank")}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />Obter chave
                    </Button>
                  </div>
                  {!hasApiKey && (
                    <p className="text-xs text-amber-700/80">
                      Alternativamente, defina <code className="bg-amber-100 px-1 rounded">GEMINI_API_KEY</code> como variável de ambiente no servidor.
                    </p>
                  )}
                </div>
              )}

              {/* Test result */}
              {testResult && (
                <div className={`p-3 rounded-lg border text-sm ${testResult.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
                  {testResult.ok
                    ? <CheckCircle2 className="w-4 h-4 inline mr-2" />
                    : <XCircle className="w-4 h-4 inline mr-2" />
                  }
                  {testResult.detail}
                </div>
              )}

              <Separator />

              {/* Model selector */}
              <div className="space-y-2">
                <Label>Modelo em uso</Label>
                <div className="flex items-center gap-3">
                  <select
                    value={geminiModel}
                    onChange={(e) => setGeminiModel(e.target.value)}
                    className="h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {GEMINI_MODELS_FREE.filter(m => !freeTierOnly || m.freeTier).map(m => (
                      <option key={m.id} value={m.id}>{m.name} — {m.id}</option>
                    ))}
                  </select>
                  <Badge variant="outline" className="text-blue-600 border-blue-200 shrink-0">
                    {GEMINI_MODELS_FREE.find(m => m.id === geminiModel)?.tag ?? ""}
                  </Badge>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Daily limit */}
                <div className="space-y-2">
                  <Label>Limite diário interno de respostas</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      value={dailyLimit}
                      onChange={(e) => setDailyLimit(Number(e.target.value))}
                      className="max-w-[140px]"
                      min={1}
                      max={99999}
                    />
                    <span className="text-sm text-muted-foreground">respostas/dia</span>
                    <Badge variant="outline" className="text-blue-600 border-blue-200">
                      Hoje: {(geminiConfig as any)?.daily_used ?? 0} usadas
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Após atingir o limite, o sistema encaminha para atendimento humano.
                    <span className="text-amber-600"> Este contador é interno e não representa o consumo total no Google.</span>
                  </p>
                </div>

                {/* Context window */}
                <div className="space-y-2">
                  <Label>Memória contextual (mensagens anteriores)</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      value={contextWindow}
                      onChange={(e) => setContextWindow(Math.max(1, Math.min(20, Number(e.target.value))))}
                      className="max-w-[100px]"
                      min={1}
                      max={20}
                    />
                    <span className="text-sm text-muted-foreground">mensagens anteriores</span>
                    <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200">
                      Padrão: 5
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A IA recebe as últimas N mensagens como contexto a cada nova resposta.
                  </p>
                </div>
              </div>

              {/* Free tier mode */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-green-200 bg-green-50/50">
                <div>
                  <p className="text-sm font-semibold text-green-900">Somente plano gratuito</p>
                  <p className="text-xs text-green-700">Bloqueia seleção de modelos pagos. Ativado por padrão.</p>
                </div>
                <Switch checked={freeTierOnly} onCheckedChange={setFreeTierOnly} />
              </div>

              {/* Instructions */}
              <div className="space-y-2">
                <Label>Instruções da IA (System Prompt para WhatsApp)</Label>
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-md text-xs mb-1">
                  <strong>Atenção:</strong> Estas instruções definem o comportamento da IA no WhatsApp.
                  A regra de nunca inventar dados está programada no backend e não pode ser removida pelo cliente.
                </div>
                <Textarea
                  className="w-full min-h-[160px] font-mono text-sm leading-relaxed"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Você é a Brenda, atendente virtual da Skina do Frango & Assados..."
                />
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <Button
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => saveGeminiMutation.mutate()}
                disabled={saveGeminiMutation.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                {saveGeminiMutation.isPending ? "Salvando..." : "Salvar Configurações Gemini"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* ===== TAB: MODELOS E LIMITES GRATUITOS ===== */}
        <TabsContent value="modelos" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    Modelos Gemini — Plano Gratuito
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Limites oficiais do plano gratuito conforme{" "}
                    <a href="https://ai.google.dev/pricing" target="_blank" rel="noreferrer" className="underline text-blue-600">
                      ai.google.dev/pricing
                    </a>. Para limites específicos do seu projeto, consulte{" "}
                    <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="underline text-blue-600">
                      Google AI Studio <ExternalLink className="w-3 h-3 inline" />
                    </a>.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFetchModels}
                  disabled={isFetchingModels || !hasApiKey}
                >
                  {isFetchingModels
                    ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Consultando...</>
                    : <><RefreshCw className="w-4 h-4 mr-2" />Atualizar modelos da conta</>
                  }
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Free-tier mode toggle */}
              <div className="flex items-center gap-3 p-3 rounded-lg border border-green-200 bg-green-50/30">
                <Globe className="w-5 h-5 text-green-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-900">Modo Somente Plano Gratuito</p>
                  <p className="text-xs text-green-700">Quando ativo, bloqueia seleção de modelos que exigem faturamento.</p>
                </div>
                <Switch checked={freeTierOnly} onCheckedChange={setFreeTierOnly} />
              </div>

              {/* Models account list */}
              {availableModels.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                  <p className="font-semibold text-green-800 mb-2">Modelos disponíveis na sua conta:</p>
                  <div className="flex flex-wrap gap-1">
                    {availableModels.filter(m => m.includes("gemini")).slice(0, 20).map(m => (
                      <Badge
                        key={m}
                        variant="outline"
                        className="text-xs cursor-pointer hover:bg-green-100"
                        onClick={() => setGeminiModel(m)}
                      >
                        {m}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Model cards */}
              <div className="grid md:grid-cols-2 gap-4">
                {GEMINI_MODELS_FREE.map((m) => (
                  <ModelCard
                    key={m.id}
                    model={m}
                    selected={geminiModel === m.id}
                    onSelect={() => setGeminiModel(m.id)}
                    freeTierOnly={freeTierOnly}
                  />
                ))}
              </div>

              {/* Important disclaimers */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs space-y-1">
                  <p><strong>Atenção sobre conversas vs. requisições:</strong> Uma conversa pode gerar múltiplas requisições à API (uma por mensagem). Com 500 requisições/dia e 5 msgs por conversa, isso equivale a aproximadamente 100 conversas/dia.</p>
                  <p><strong>O contador interno do sistema</strong> (campo "Limite diário") registra apenas as chamadas feitas pelo seu painel — não representa o consumo total do seu projeto Google.</p>
                  <p><strong>Para limites do seu projeto específico</strong>, acesse{" "}
                    <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="underline text-blue-600">
                      Google AI Studio <ExternalLink className="w-3 h-3 inline" />
                    </a>{" "}ou{" "}
                    <a href="https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas" target="_blank" rel="noreferrer" className="underline text-blue-600">
                      Google Cloud Console (Quotas) <ExternalLink className="w-3 h-3 inline" />
                    </a>.
                  </p>
                </AlertDescription>
              </Alert>

              {/* Table with limits */}
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-3 font-semibold">Modelo</th>
                      <th className="text-center p-3 font-semibold">RPM</th>
                      <th className="text-center p-3 font-semibold">RPD</th>
                      <th className="text-center p-3 font-semibold">TPM</th>
                      <th className="text-center p-3 font-semibold">Conv./dia</th>
                      <th className="text-center p-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {GEMINI_MODELS_FREE.map((m) => (
                      <tr key={m.id} className={`border-t ${m.id === geminiModel ? "bg-indigo-50/50" : ""}`}>
                        <td className="p-3">
                          <div className="font-semibold">{m.name}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{m.id}</div>
                        </td>
                        <td className="p-3 text-center font-mono">{m.freeTier ? m.rpm : "—"}</td>
                        <td className="p-3 text-center font-mono">{m.freeTier ? m.rpd.toLocaleString() : "—"}</td>
                        <td className="p-3 text-center font-mono">{m.freeTier ? (m.tpm / 1000) + "K" : "—"}</td>
                        <td className="p-3 text-center font-mono">{m.estimatedDailyConversations}</td>
                        <td className="p-3 text-center">
                          {m.freeTier
                            ? <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px]">Disponível</Badge>
                            : <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px]">Pago</Badge>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-2 bg-slate-50 text-[10px] text-muted-foreground border-t">
                  Fonte: ai.google.dev/pricing (outubro 2026). Limites podem variar por conta/região. RPM = requisições/minuto, RPD = requisições/dia, TPM = tokens/minuto.
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4 gap-3 flex-wrap">
              <Button
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => saveGeminiMutation.mutate()}
                disabled={saveGeminiMutation.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                {saveGeminiMutation.isPending ? "Salvando..." : `Salvar modelo: ${GEMINI_MODELS_FREE.find(m => m.id === geminiModel)?.name ?? geminiModel}`}
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open("https://ai.google.dev/pricing", "_blank")}
              >
                <ExternalLink className="w-4 h-4 mr-2" />Ver preços oficiais
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* ===== TAB: SITE CHATBOT ===== */}
        <TabsContent value="site">
          <Card className="border-indigo-100 shadow-sm">
            <CardHeader className="bg-indigo-50/50 border-b border-indigo-50 pb-4">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2 text-indigo-900">
                    <Bot className="h-5 w-5 text-indigo-600" />Chatbot do Site (Brenda)
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Configura o widget de chat existente no site. Independente do atendimento via WhatsApp.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{isActiveSite ? "Ativado" : "Desativado"}</span>
                  <Switch checked={isActiveSite} onCheckedChange={setIsActiveSite} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-900">Mensagem de Saudação</label>
                <p className="text-xs text-gray-500">Primeira mensagem exibida ao cliente ao abrir o chat do site.</p>
                <Textarea
                  className="w-full min-h-[80px]"
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  placeholder="Olá! Sou a Brenda, atendente da Skina do Frango..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-900">Instruções Base (System Prompt)</label>
                <Textarea
                  className="w-full min-h-[200px] font-mono text-sm"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Você é Brenda, atendente virtual da Skina do Frango..."
                />
              </div>
            </CardContent>
          </Card>
          <div className="mt-4">
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => saveSiteMutation.mutate()}
              disabled={saveSiteMutation.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              {saveSiteMutation.isPending ? "Salvando..." : "Salvar Chatbot do Site"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
