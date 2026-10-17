import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  waConfig,
  waSave,
  waSecrets,
  waTest,
  waTemplates,
  securityStatus,
  securityBegin,
  securityConfirm,
} from "@/lib/whatsapp.functions";
import { DEFAULT_WHATSAPP } from "@/lib/whatsapp.types";
import "@/styles/support.css";
const errorText = (e: unknown) => (e instanceof Error ? e.message : "Falha na operação.");
export function LaborSecurity() {
  const { data, refetch } = useQuery({
    queryKey: ["labor-security"],
    queryFn: () => securityStatus(),
    refetchInterval: 15000,
  });
  const [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [secret, setSecret] = useState(""),
    [recovery, setRecovery] = useState<string[]>([]),
    [busy, setBusy] = useState(false);
  return (
    <section className="support-settings">
      <h2>Segurança · autenticação em duas etapas</h2>
      <p>Credenciais e campanhas exigem confirmação MFA, válida por cinco minutos.</p>
      <p>
        {data?.enabled
          ? "Autenticador cadastrado"
          : "Cadastre um autenticador para liberar ações sensíveis"}
        {data && data.verifiedUntil > Date.now() ? " · ações sensíveis liberadas" : ""}
      </p>
      {!data?.enabled && !secret && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const result = await securityBegin({ data: { password } });
              setSecret(result.secret);
              setPassword("");
            } catch (e) {
              toast.error(errorText(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Confirme sua senha
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button disabled={busy}>Cadastrar autenticador</button>
        </form>
      )}
      {secret && (
        <p>
          Adicione esta chave ao Google Authenticator ou aplicativo compatível:{" "}
          <code className="break-all">{secret}</code>. Guarde em local seguro.
        </p>
      )}
      {(data?.enabled || secret) && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const result = await securityConfirm({ data: { code, enrollment: !!secret } });
              setRecovery(result.recoveryCodes);
              setSecret("");
              setCode("");
              await refetch();
              toast.success("MFA confirmado.");
            } catch (e) {
              toast.error(errorText(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Código do autenticador ou recuperação
            <input
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <button disabled={busy}>Confirmar código</button>
        </form>
      )}
      {!!recovery.length && (
        <div role="status">
          <p>Guarde estes códigos de recuperação. Cada código funciona uma vez.</p>
          <pre>{recovery.join("\n")}</pre>
          <button onClick={() => setRecovery([])}>Já guardei</button>
        </div>
      )}
    </section>
  );
}
export function LaborWhatsApp() {
  const { data, error, refetch } = useQuery({
    queryKey: ["labor-whatsapp"],
    queryFn: () => waConfig(),
    refetchInterval: 10000,
    retry: false,
  });
  const [config, setConfig] = useState(DEFAULT_WHATSAPP),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false);
  const [token, setToken] = useState(""),
    [appSecret, setAppSecret] = useState(""),
    [verifyToken, setVerifyToken] = useState("");
  useEffect(() => {
    if (data && !loaded) {
      setConfig(data.config);
      setLoaded(true);
    }
  }, [data, loaded]);
  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await refetch();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="support-settings">
      <p>
        API oficial da Meta ·{" "}
        {data?.lastTest?.ok
          ? `Conta validada: ${data.lastTest.displayPhone}`
          : "Conexão ainda não validada"}
      </p>
      {error && <p role="alert">{errorText(error)}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void action(async () => {
            await waSave({ data: config });
            toast.success("Configuração salva.");
          });
        }}
      >
        {(
          [
            ["wabaId", "WhatsApp Business Account ID"],
            ["phoneId", "Phone Number ID"],
            ["apiVersion", "Versão Graph API (ex.: v24.0)"],
            ["webhookUrl", "URL HTTPS pública deste webhook"],
            ["catalogUrl", "URL pública do cardápio"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              value={config[key]}
              onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
            />
          </label>
        ))}
        <p>
          Rota: <code>/api/webhook/whatsapp</code>. A URL pública precisa encaminhar para este
          servidor. Um endereço de outra aplicação não recebe este código.
        </p>
        <label>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
          />{" "}
          Ativar integração após teste
        </label>
        <label>
          <input
            type="checkbox"
            checked={config.autoReply}
            onChange={(e) => setConfig({ ...config, autoReply: e.target.checked })}
          />{" "}
          Responder automaticamente a mensagens recebidas
        </label>
        <label>
          <input
            type="checkbox"
            checked={config.mediaEnabled}
            onChange={(e) => setConfig({ ...config, mediaEnabled: e.target.checked })}
          />{" "}
          Processar imagens, áudios e PDF com Gemini (até 8 MB; depende do modelo)
        </label>
        <button disabled={busy}>Salvar configuração</button>
      </form>
      <details>
        <summary>Substituir credenciais protegidas</summary>
        <p>Campos vazios preservam segredos atuais. O painel nunca recupera o conteúdo salvo.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action(async () => {
              await waSecrets({
                data: {
                  ...(token ? { token } : {}),
                  ...(appSecret ? { appSecret } : {}),
                  ...(verifyToken ? { verifyToken } : {}),
                },
              });
              setToken("");
              setAppSecret("");
              setVerifyToken("");
              setConfig((c) => ({ ...c, enabled: false }));
              toast.success("Credenciais cifradas. Teste novamente antes de ativar.");
            });
          }}
        >
          <label>
            Access Token {data?.hasToken ? "· armazenado" : "· ausente"}
            <input
              type="password"
              autoComplete="new-password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
          <label>
            App Secret {data?.hasAppSecret ? "· armazenado" : "· ausente"}
            <input
              type="password"
              autoComplete="new-password"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
            />
          </label>
          <label>
            Verify Token {data?.hasVerifyToken ? "· armazenado" : "· ausente"}
            <input
              type="password"
              autoComplete="new-password"
              value={verifyToken}
              onChange={(e) => setVerifyToken(e.target.value)}
            />
          </label>
          <button disabled={busy || (!token && !appSecret && !verifyToken)}>
            Substituir credenciais
          </button>
        </form>
      </details>
      <div className="flex gap-3 flex-wrap">
        <button
          disabled={busy}
          onClick={() =>
            action(async () => {
              const r = await waTest();
              if (!r.ok) throw new Error(r.error);
              toast.success("Conta e telefone confirmados pela Meta.");
            })
          }
        >
          Testar conexão
        </button>
        <button
          disabled={busy}
          onClick={() =>
            action(async () => {
              await waTemplates();
              toast.success("Templates sincronizados.");
            })
          }
        >
          Sincronizar templates
        </button>
      </div>
      {data?.lastTest && (
        <p>
          Último teste: {new Date(data.lastTest.at).toLocaleString("pt-BR")} ·{" "}
          {data.lastTest.ok ? "Sucesso" : data.lastTest.error}
        </p>
      )}
      <p>
        Desafio webhook:{" "}
        {data?.webhookVerifiedAt
          ? new Date(data.webhookVerifiedAt).toLocaleString("pt-BR")
          : "pendente"}
        . Último evento validado:{" "}
        {data?.lastWebhookAt ? new Date(data.lastWebhookAt).toLocaleString("pt-BR") : "nenhum"}.
      </p>
      <h3>Templates</h3>
      {!data?.templates.length && <p>Nenhum template sincronizado.</p>}
      {data?.templates.map((t) => (
        <article key={t.id}>
          <strong>
            {t.name} · {t.language} · {t.status}
          </strong>
          <p>{t.body}</p>
          {!t.usable && <small>Componentes deste template não suportados pelo editor atual.</small>}
        </article>
      ))}
      <h3>Fila de envio</h3>
      {!data?.queue.length && <p>Nenhum envio solicitado.</p>}
      {data?.queue
        .slice()
        .reverse()
        .map((j) => (
          <p key={j.id}>
            {new Date(j.at).toLocaleString("pt-BR")} · {j.origin} · {j.state}
            {j.error && ` · ${j.error}`}
          </p>
        ))}
      <LaborSecurity />
    </div>
  );
}
