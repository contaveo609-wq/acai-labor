import { createFileRoute } from "@tanstack/react-router";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Shield, KeyRound, Wifi, WifiOff, Smartphone, Trash2, RefreshCw,
  CheckCircle2, XCircle, AlertCircle, ExternalLink, Copy, Info,
  Webhook, Clock, History, Zap, Lock, ShieldCheck, AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  getWhatsAppConfigSafe, saveWhatsAppConfig, testWhatsAppConnection, removeWhatsAppIntegration,
  generateWebhookVerifyToken,
} from "@/lib/whatsapp.server";

export const Route = createFileRoute("/admin/whatsapp")({
  component: AdminWhatsappPage,
});

function StatusBadge({ status, lastError }: { status?: string | null; lastError?: string | null }) {
  if (status === "ok") return <Badge className="bg-green-600 text-white gap-1"><CheckCircle2 className="w-3 h-3" />Conectado</Badge>;
  if (status === "error") return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />Erro{lastError ? `: ${lastError.slice(0, 40)}` : ""}</Badge>;
  return <Badge variant="outline" className="text-slate-500 gap-1"><AlertCircle className="w-3 h-3" />Não testado</Badge>;
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(label ? `${label} copiado!` : "Copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar. Selecione e copie manualmente.");
    }
  };
  return (
    <Button size="icon" variant="ghost" className="shrink-0 h-8 w-8" onClick={handleCopy}>
      {copied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
    </Button>
  );
}

function AdminWhatsappPage() {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Form state
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [webhookVerifyToken, setWebhookVerifyToken] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");

  const { data: config, isLoading } = useQuery({
    queryKey: ["admin_wa_config_v3"],
    queryFn: () => getWhatsAppConfigSafe(),
  });

  useEffect(() => {
    if (config) {
      setPhoneNumber((config as any).phone_number ?? "");
      setPhoneNumberId((config as any).phone_number_id ?? "");
      setWabaId((config as any).business_account_id ?? "");
      setWebhookVerifyToken((config as any).webhook_verify_token ?? "");
    }
  }, [config]);

  const isConnected = !!(config as any)?.is_connected;
  const lastStatus = (config as any)?.last_test_status;
  const lastError = (config as any)?.last_test_error;
  const lastTested = (config as any)?.last_tested_at;
  const hasToken = !!(config as any)?.has_access_token;

  // Webhook URL is always the local server route
  const webhookEndpoint = typeof window !== "undefined"
    ? `${window.location.origin}/api/webhook/whatsapp`
    : "/api/webhook/whatsapp";

  const handleSave = async () => {
    if (!phoneNumberId.trim()) { toast.error("Phone Number ID é obrigatório."); return; }
    if (!wabaId.trim()) { toast.error("WABA ID é obrigatório."); return; }
    if (!webhookVerifyToken.trim() || webhookVerifyToken.length < 6) {
      toast.error("Token de verificação deve ter pelo menos 6 caracteres."); return;
    }

    setIsSaving(true);
    try {
      await saveWhatsAppConfig({
        data: {
          phone_number: phoneNumber || undefined,
          phone_number_id: phoneNumberId,
          business_account_id: wabaId,
          webhook_verify_token: webhookVerifyToken,
          app_secret: appSecret || undefined,
        },
      });
      toast.success("Configurações salvas com sucesso!");
      setAccessToken("");
      setAppSecret("");
      queryClient.invalidateQueries({ queryKey: ["admin_wa_config_v3"] });
    } catch (err: unknown) {
      toast.error("Erro ao salvar: " + (err instanceof Error ? err.message : "Erro desconhecido"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testWhatsAppConnection();
      if ((result as any).success) {
        setTestResult({ ok: true, msg: `Conectado: ${(result as any).displayName}` });
        toast.success("Conexão verificada com sucesso!");
      } else {
        setTestResult({ ok: false, msg: (result as any).error ?? "Falha na verificação" });
        toast.error("Falha na conexão: " + (result as any).error);
      }
      queryClient.invalidateQueries({ queryKey: ["admin_wa_config_v3"] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setTestResult({ ok: false, msg });
      toast.error("Erro ao testar: " + msg);
    } finally {
      setIsTesting(false);
    }
  };

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      await removeWhatsAppIntegration();
      toast.success("Integração removida. Credenciais apagadas do sistema.");
      setPhoneNumber(""); setPhoneNumberId(""); setWabaId(""); setWebhookVerifyToken("");
      queryClient.invalidateQueries({ queryKey: ["admin_wa_config_v3"] });
    } catch (err: unknown) {
      toast.error("Erro ao remover: " + (err instanceof Error ? err.message : "Erro"));
    } finally {
      setIsRemoving(false);
    }
  };

  const handleGenerateToken = async () => {
    setIsGeneratingToken(true);
    try {
      const result = await generateWebhookVerifyToken();
      if ((result as any).success) {
        const token = (result as any).token as string;
        setWebhookVerifyToken(token);
        toast.success("Token gerado e salvo! Copie e configure no painel da Meta.");
        queryClient.invalidateQueries({ queryKey: ["admin_wa_config_v3"] });
      } else {
        toast.error("Erro ao gerar token.");
      }
    } catch (err: unknown) {
      toast.error("Erro: " + (err instanceof Error ? err.message : "Erro desconhecido"));
    } finally {
      setIsGeneratingToken(false);
    }
  };

  if (isLoading) return <div className="p-6 text-center text-muted-foreground">Carregando configurações...</div>;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
            <Smartphone className="w-8 h-8 text-green-600" />
            WhatsApp Cloud API
          </h1>
          <p className="text-muted-foreground mt-2">
            Integração oficial com a API da Meta para atendimento automatizado via WhatsApp Business.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={lastStatus} lastError={lastError} />
          {isConnected && <Badge className="bg-green-100 text-green-800 border-green-200">Ativo</Badge>}
        </div>
      </div>

      <Tabs defaultValue="api" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="api" className="flex items-center gap-2">
            <Smartphone className="w-4 h-4" />WhatsApp API
          </TabsTrigger>
          <TabsTrigger value="webhook" className="flex items-center gap-2">
            <Webhook className="w-4 h-4" />Configuração de Webhook
          </TabsTrigger>
          <TabsTrigger value="signup" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />Conexão Rápida
          </TabsTrigger>
        </TabsList>

        {/* ===== TAB: API ===== */}
        <TabsContent value="api" className="space-y-6">

          {/* Status Card */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-1 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Status da Conexão</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-6 space-y-3">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-2 border-4 shadow-inner ${isConnected ? "bg-green-100 text-green-600 border-green-50" : "bg-slate-100 text-slate-400 border-slate-50"}`}>
                  {isConnected ? <Wifi className="w-10 h-10 animate-pulse" /> : <WifiOff className="w-10 h-10" />}
                </div>
                <StatusBadge status={lastStatus} lastError={lastError} />
                {(config as any)?.phone_number && (
                  <p className="text-sm font-semibold text-gray-700 text-center">{(config as any).phone_number}</p>
                )}
                {lastTested && (
                  <p className="text-xs text-muted-foreground text-center">
                    Último teste: {new Date(lastTested).toLocaleString("pt-BR")}
                  </p>
                )}
                {lastError && (
                  <p className="text-xs text-red-600 text-center bg-red-50 p-2 rounded-md">{lastError}</p>
                )}
                {testResult && (
                  <div className={`text-xs text-center p-2 rounded-md w-full ${testResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {testResult.msg}
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex-col gap-2 bg-slate-50/50 rounded-b-xl border-t pt-4">
                <Button className="w-full" variant="outline" onClick={handleTest} disabled={isTesting || !hasToken || !(config as any)?.phone_number_id}>
                  {isTesting ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Testando...</> : "Testar Conexão"}
                </Button>
                {!hasToken && (
                  <p className="text-xs text-amber-600 text-center">Configure WHATSAPP_ACCESS_TOKEN no servidor</p>
                )}
              </CardFooter>
            </Card>

            {/* Config Form */}
            <Card className="md:col-span-2 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Credenciais Meta Cloud API</CardTitle>
                <CardDescription>
                  Configure as credenciais obtidas no <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-1">Meta for Developers <ExternalLink className="w-3 h-3" /></a>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Número do WhatsApp Business</Label>
                    <Input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="+55 (66) 00000-0000" />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number ID <span className="text-red-500">*</span></Label>
                    <Input value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)} placeholder="1234567890123456" className="font-mono text-sm" />
                    <p className="text-[11px] text-muted-foreground">Em: App Dashboard {">"} WhatsApp {">"} Configuration</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>WhatsApp Business Account ID (WABA ID) <span className="text-red-500">*</span></Label>
                  <Input value={wabaId} onChange={e => setWabaId(e.target.value)} placeholder="1234567890123456" className="font-mono text-sm" />
                </div>

                <Separator />

                {/* Credentials (write-only) */}
                <div className="space-y-4 bg-amber-50 dark:bg-amber-900/10 p-4 rounded-lg border border-amber-200 dark:border-amber-900/30">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-semibold text-amber-900 dark:text-amber-400">Credenciais Sensíveis</span>
                  </div>
                  <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
                    O token de acesso não é armazenado no banco de dados — deve ser definido como variável de ambiente{" "}
                    <code className="mx-1 bg-amber-100 px-1 rounded">WHATSAPP_ACCESS_TOKEN</code> no servidor.
                  </p>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-amber-900 dark:text-amber-400">
                      <KeyRound className="w-4 h-4" /> Token de Acesso (variável de ambiente)
                    </Label>
                    <div className={`flex-1 h-9 px-3 py-2 rounded-md border text-sm font-mono flex items-center ${hasToken ? "bg-green-50 border-green-300 text-green-700" : "bg-red-50 border-red-300 text-red-700"}`}>
                      {hasToken ? "WHATSAPP_ACCESS_TOKEN ✓ Configurado no servidor" : "WHATSAPP_ACCESS_TOKEN ✗ Não configurado"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-amber-900 dark:text-amber-400">App Secret (opcional, para validar assinaturas HMAC)</Label>
                    <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
                      Defina via variável de ambiente <code className="bg-amber-100 px-1 rounded">WHATSAPP_APP_SECRET</code>.
                      O campo abaixo é apenas para referência — não é armazenado no banco.
                    </p>
                    <div className="relative">
                      <Input
                        type={showSecret ? "text" : "password"}
                        value={appSecret}
                        onChange={e => setAppSecret(e.target.value)}
                        placeholder="Cole o App Secret aqui (não será armazenado)"
                        className="font-mono text-sm pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1"
                        tabIndex={-1}
                      >
                        {showSecret ? <XCircle className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-3 pt-4 border-t">
                <Button onClick={handleSave} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white">
                  {isSaving ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : "Salvar Configuração"}
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isRemoving} size="sm">
                      <Trash2 className="w-4 h-4 mr-2" />Remover Integração
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover integração do WhatsApp?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Todas as credenciais salvas (Phone Number ID, WABA ID, token de verificação) serão apagadas do sistema.
                        Isso NÃO exclui nada no painel da Meta. O atendimento automático será desativado.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={handleRemove}>
                        {isRemoving ? "Removendo..." : "Sim, remover"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            </Card>
          </div>

          {/* Environment Variable Guide */}
          <Card className="border-blue-200/60 bg-blue-50/30 dark:bg-blue-900/10 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600" /> Variáveis de Ambiente Necessárias
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-blue-800/80 dark:text-blue-300/80">Configure estas variáveis no ambiente de execução do servidor (ex: .env, Cloudflare Pages, Vercel):</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { name: "WHATSAPP_ACCESS_TOKEN", desc: "Token de acesso permanente da Meta (obrigatório para envio)", required: true },
                  { name: "WHATSAPP_APP_SECRET", desc: "App Secret para validar assinaturas HMAC dos webhooks (recomendado)", required: false },
                  { name: "WHATSAPP_WEBHOOK_VERIFY_TOKEN", desc: "Alternativa ao token salvo no banco de dados", required: false },
                  { name: "GEMINI_API_KEY", desc: "Chave da API do Google Gemini (obrigatório para respostas automáticas)", required: true },
                ].map(v => (
                  <div key={v.name} className="bg-white dark:bg-slate-800 border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-xs font-mono font-bold text-blue-700 dark:text-blue-300">{v.name}</code>
                      {v.required && <Badge className="text-[10px] px-1 py-0 bg-red-100 text-red-700 border-red-200">obrigatório</Badge>}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{v.desc}</p>
                  </div>
                ))}
              </div>
              <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                Documentação oficial da Meta Cloud API <ExternalLink className="w-3 h-3" />
              </a>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== TAB: WEBHOOK ===== */}
        <TabsContent value="webhook" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="w-5 h-5 text-blue-600" />
                Configuração de Webhook
              </CardTitle>
              <CardDescription>
                Configure o webhook para receber mensagens do WhatsApp em tempo real.
                O endpoint GET valida o token com a Meta; o POST recebe as mensagens.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* Webhook URL */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-500" />
                  URL do Webhook (use esta no painel da Meta)
                </Label>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <code className="text-sm bg-white dark:bg-slate-900 border rounded px-2 py-1.5 flex-1 break-all font-mono">
                      {webhookEndpoint}
                    </code>
                    <CopyButton text={webhookEndpoint} label="URL do webhook" />
                  </div>
                  <p className="text-xs text-blue-700 mt-2">
                    ⚠️ Esta URL precisa ser acessível publicamente pela Meta. Se estiver rodando localmente, utilize um serviço de tunelamento como{" "}
                    <a href="https://ngrok.com" target="_blank" rel="noreferrer" className="underline">ngrok</a> ou{" "}
                    <a href="https://cloudflare.com/products/tunnel" target="_blank" rel="noreferrer" className="underline">Cloudflare Tunnel</a>{" "}
                    para expor o endpoint.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Verify Token */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-500" />
                  Token de Verificação <span className="text-red-500">*</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  Token secreto que a Meta usa para verificar que você é o dono do webhook.
                  Use o mesmo valor no campo "Verify token" no painel da Meta.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={webhookVerifyToken}
                    onChange={e => setWebhookVerifyToken(e.target.value)}
                    placeholder="token-secreto-min-6-chars"
                    className="font-mono text-sm flex-1"
                  />
                  <CopyButton text={webhookVerifyToken} label="Token de verificação" />
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateToken}
                    disabled={isGeneratingToken}
                    className="text-blue-700 border-blue-300"
                  >
                    {isGeneratingToken
                      ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Gerando...</>
                      : <><RefreshCw className="w-4 h-4 mr-2" />Gerar Token Seguro</>
                    }
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={isSaving || !webhookVerifyToken.trim() || webhookVerifyToken.length < 6}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {isSaving ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : "Salvar Token"}
                  </Button>
                </div>
                {webhookVerifyToken && (
                  <p className={`text-xs ${webhookVerifyToken.length >= 6 ? "text-green-700" : "text-red-600"}`}>
                    {webhookVerifyToken.length} caracteres {webhookVerifyToken.length < 6 ? "— mínimo 6 caracteres" : "— OK"}
                  </p>
                )}
              </div>

              <Separator />

              {/* Step-by-step guide */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-500" /> Como configurar no painel da Meta
                </h3>
                <div className="space-y-3">
                  {[
                    {
                      step: "1",
                      title: "Acesse o painel de desenvolvedores",
                      desc: "Vá em developers.facebook.com → Seus Apps → selecione o app do WhatsApp",
                      link: "https://developers.facebook.com",
                      linkLabel: "Abrir painel",
                    },
                    {
                      step: "2",
                      title: "Navegue até Webhook",
                      desc: "No menu lateral, clique em WhatsApp → Configuration → Webhook",
                      link: null,
                    },
                    {
                      step: "3",
                      title: "Configure a URL e o Token",
                      desc: "Cole a URL do webhook acima e o token de verificação nos campos correspondentes",
                      link: null,
                    },
                    {
                      step: "4",
                      title: "Verifique o webhook",
                      desc: "Clique em 'Verify and Save'. A Meta enviará uma requisição GET para confirmar o token",
                      link: null,
                    },
                    {
                      step: "5",
                      title: "Ative os campos (fields)",
                      desc: "Em 'Webhook fields', ative: messages, message_deliveries, message_reads",
                      link: null,
                    },
                  ].map(item => (
                    <div key={item.step} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border">
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">
                        {item.step}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{item.desc}</p>
                        {item.link && (
                          <a href={item.link} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-1">
                            {item.linkLabel} <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Technical details */}
              <div className="bg-slate-50 dark:bg-slate-900 border rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Detalhes técnicos do endpoint</h3>
                <div className="grid sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <p className="font-semibold text-green-700">GET /api/webhook/whatsapp</p>
                    <p className="text-gray-600">Verificação pela Meta. Compara hub.verify_token com o token salvo e retorna hub.challenge.</p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-blue-700">POST /api/webhook/whatsapp</p>
                    <p className="text-gray-600">Recebe eventos. Valida assinatura X-Hub-Signature-256 (quando APP_SECRET configurado). Deduplica por waba_message_id. Responde 200 imediatamente.</p>
                  </div>
                </div>
              </div>

              {/* Alert about public URL requirement */}
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs space-y-1">
                  <p><strong>URL pública obrigatória:</strong> A Meta exige que o endpoint seja acessível pela internet via HTTPS.</p>
                  <p>Se o app ainda não estiver publicado em produção, a URL <code>{window.location.origin}</code> não será acessível externamente. Publique o app ou use um serviço de tunelamento para testes.</p>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== TAB: QUICK CONNECT (QR Code / Embedded Signup) ===== */}
        <TabsContent value="signup" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                Conexão Rápida com WhatsApp
              </CardTitle>
              <CardDescription>
                Situação real das opções de conexão simplificada com a API oficial da Meta.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* Honest assessment of QR Code */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm space-y-2">
                  <p><strong>Sobre QR Code com a API oficial:</strong></p>
                  <p>A API oficial do WhatsApp Business (Cloud API da Meta) <strong>não oferece fluxo de conexão por QR Code</strong>. O QR Code é exclusivo do WhatsApp Web e de bibliotecas não-oficiais (como Baileys, WA-JS, etc.) que simulam um cliente web — estas estão sujeitas a banimento de conta.</p>
                </AlertDescription>
              </Alert>

              {/* Available official options */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Opções Oficiais Disponíveis</h3>

                {/* Option 1: Manual (current) */}
                <div className="p-4 border-2 border-green-200 bg-green-50/30 rounded-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge className="bg-green-600 text-white">Disponível Agora</Badge>
                    <span className="font-semibold text-gray-800">Token Manual (Cloud API)</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Configuração via token de acesso obtido no painel Meta for Developers. Método atual já implementado nesta aba.
                    Requer criação de app no painel da Meta e obtenção do token de sistema.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => window.open("https://developers.facebook.com/docs/whatsapp/cloud-api/get-started", "_blank")}>
                    <ExternalLink className="w-4 h-4 mr-2" />Ver guia oficial
                  </Button>
                </div>

                {/* Option 2: Embedded Signup */}
                <div className="p-4 border-2 border-blue-200 bg-blue-50/30 rounded-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge className="bg-blue-600 text-white">Requer Aprovação Meta</Badge>
                    <span className="font-semibold text-gray-800">Embedded Signup</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Permite que clientes conectem sua conta WhatsApp Business pelo seu app sem sair da página.
                    O usuário autoriza via popup do Facebook/Meta. Requer que seu app esteja aprovado pela Meta
                    e seja um <strong>Solution Provider</strong> ou tenha permissões de Business Management.
                  </p>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 mb-3">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    <strong>Requisitos:</strong> App Meta aprovado com permissão <code>whatsapp_business_management</code>,
                    domínio verificado, revisão de app pela Meta. Processo pode levar dias/semanas.
                  </div>
                  <Button variant="outline" size="sm" onClick={() => window.open("https://developers.facebook.com/docs/whatsapp/embedded-signup", "_blank")}>
                    <ExternalLink className="w-4 h-4 mr-2" />Documentação Embedded Signup
                  </Button>
                </div>

                {/* Option 3: Coexistence */}
                <div className="p-4 border-2 border-purple-200 bg-purple-50/30 rounded-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge className="bg-purple-600 text-white">Restrição: Parceiros Meta</Badge>
                    <span className="font-semibold text-gray-800">WhatsApp Business App Coexistence</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Permite usar o mesmo número tanto pelo app WhatsApp Business quanto pela Cloud API simultaneamente.
                    Requer confirmação no próprio dispositivo pelo app WhatsApp Business.
                    Disponível apenas para parceiros tecnológicos (BSPs) aprovados pela Meta.
                  </p>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800 mb-3">
                    <XCircle className="w-3 h-3 inline mr-1" />
                    <strong>Requisito crítico:</strong> Somente disponível para Business Solution Providers (BSPs) certificados pela Meta.
                    Não disponível para apps de desenvolvedor padrão.
                  </div>
                  <Button variant="outline" size="sm" onClick={() => window.open("https://developers.facebook.com/docs/whatsapp/cloud-api/overview/coexistence", "_blank")}>
                    <ExternalLink className="w-4 h-4 mr-2" />Documentação Coexistence
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Recommendation */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-indigo-900 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  Recomendação Atual
                </h3>
                <p className="text-xs text-indigo-800 space-y-1">
                  Para começar hoje sem aprovações especiais: utilize a <strong>integração manual por token</strong> na aba "WhatsApp API".
                  Configure um número no painel Meta for Developers, obtenha o token de sistema permanente e preencha os campos.
                  Esta é a forma mais rápida, estável e sem risco de banimento.
                </p>
                <div className="mt-3">
                  <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noreferrer"
                    className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1">
                    Guia completo de configuração <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
