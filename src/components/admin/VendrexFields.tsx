import type { Product, StoreSettings } from "@/lib/menu";
import { UNIT_LABELS, DEFAULT_BRAND, DEFAULT_HOURS } from "@/lib/vendrex.rules";
import { toast } from "sonner";

export function SaleFields({
  product: p,
  update,
}: {
  product: Product;
  update: (p: Partial<Product>) => void;
}) {
  const options = p.sale_options || [];
  const setOption = (id: string, value: Partial<(typeof options)[number]>) =>
    update({ sale_options: options.map((o) => (o.id === id ? { ...o, ...value } : o)) });
  return (
    <section className="vendrex-editor-section">
      <h3>Unidades e embalagens</h3>
      <p>
        O preço base é por unidade de venda. Cada embalagem pode ter preço e regras próprios;
        promoções do produto se aplicam à opção base.
      </p>
      <div className="admin-form-grid">
        <label>
          SKU
          <input
            value={p.sku || ""}
            maxLength={60}
            onChange={(e) => update({ sku: e.target.value })}
          />
        </label>
        <label>
          Unidade de venda
          <select
            value={p.sale_unit || "unidade"}
            onChange={(e) => update({ sale_unit: e.target.value })}
          >
            {Object.entries(UNIT_LABELS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Quantidade mínima
          <input
            type="number"
            step="0.001"
            min="0.001"
            max="1000"
            required
            value={p.min_quantity ?? 1}
            onChange={(e) => update({ min_quantity: Number(e.target.value) })}
          />
        </label>
        <label>
          Incremento de quantidade
          <input
            type="number"
            step="0.001"
            min="0.001"
            max="1000"
            required
            value={p.quantity_step ?? 1}
            onChange={(e) => update({ quantity_step: Number(e.target.value) })}
          />
        </label>
      </div>
      {options.map((o) => (
        <div className="vendrex-option-editor" key={o.id}>
          <div className="admin-form-grid">
            <label>
              Nome da embalagem
              <input
                required
                value={o.label}
                maxLength={80}
                onChange={(e) => setOption(o.id, { label: e.target.value })}
              />
            </label>
            <label>
              Formato
              <select value={o.unit} onChange={(e) => setOption(o.id, { unit: e.target.value })}>
                {Object.entries(UNIT_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Preço da embalagem (R$)
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={o.price}
                onChange={(e) => setOption(o.id, { price: Number(e.target.value) })}
              />
            </label>
            <label>
              Mínimo de embalagens
              <input
                type="number"
                min="0.001"
                step="0.001"
                required
                value={o.min_quantity}
                onChange={(e) => setOption(o.id, { min_quantity: Number(e.target.value) })}
              />
            </label>
            <label>
              Incremento de embalagens
              <input
                type="number"
                min="0.001"
                step="0.001"
                required
                value={o.quantity_step}
                onChange={(e) => setOption(o.id, { quantity_step: Number(e.target.value) })}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={o.is_active}
                onChange={(e) => setOption(o.id, { is_active: e.target.checked })}
              />{" "}
              Disponível
            </label>
          </div>
          <button
            className="text-xs underline mt-3"
            type="button"
            onClick={() => update({ sale_options: options.filter((x) => x.id !== o.id) })}
          >
            Remover embalagem
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-sm text-primary underline mt-4"
        disabled={options.length >= 12}
        onClick={() =>
          update({
            sale_options: [
              ...options,
              {
                id: crypto.randomUUID(),
                label: "Fardo com 6 unidades",
                unit: "fardo",
                price: p.price * 6,
                min_quantity: 1,
                quantity_step: 1,
                is_active: true,
              },
            ],
          })
        }
      >
        + Adicionar embalagem
      </button>
    </section>
  );
}

export function StoreRulesFields({
  store: s,
  update,
}: {
  store: StoreSettings;
  update: (s: Partial<StoreSettings>) => void;
}) {
  const hours = s.weekly_hours || DEFAULT_HOURS;
  return (
    <>
      <section className="vendrex-editor-section">
        <h3>Identidade visual</h3>
        <div className="admin-form-grid">
          <label>
            Cor principal
            <input
              type="color"
              value={s.primary_color || DEFAULT_BRAND.primary_color}
              onChange={(e) => update({ primary_color: e.target.value })}
            />
          </label>
          <label>
            Cor de destaque
            <input
              type="color"
              value={s.accent_color || DEFAULT_BRAND.accent_color}
              onChange={(e) => update({ accent_color: e.target.value })}
            />
          </label>
          <label className="span-two">
            Título da página inicial
            <input
              required
              maxLength={100}
              value={s.hero_title || DEFAULT_BRAND.hero_title}
              onChange={(e) => update({ hero_title: e.target.value })}
            />
          </label>
          <label className="span-two">
            Texto da página inicial
            <textarea
              maxLength={300}
              value={s.hero_description || DEFAULT_BRAND.hero_description}
              onChange={(e) => update({ hero_description: e.target.value })}
            />
          </label>
          <label className="span-two">
            Imagem de destaque (PNG/JPG/WebP, até 700 KB)
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
                  toast.error("Use PNG, JPG ou WebP de até 700 KB.");
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => update({ banner_url: String(reader.result) });
                reader.readAsDataURL(file);
              }}
            />
          </label>
          {s.banner_url && (
            <div className="span-two">
              <img src={s.banner_url} className="h-32 rounded-xl" alt="Destaque da loja" />
              <button
                type="button"
                className="underline text-xs mt-2"
                onClick={() => update({ banner_url: null })}
              >
                Usar ilustração da distribuidora
              </button>
            </div>
          )}
        </div>
      </section>
      <section className="vendrex-editor-section">
        <h3>Regras de compra</h3>
        <p>
          Pedido mínimo considera produtos após descontos, sem a taxa de entrega. Os horários abaixo
          usam Brasília.
        </p>
        <div className="admin-form-grid">
          <label>
            Pedido mínimo (R$)
            <input
              type="number"
              min="0"
              max="100000"
              step="0.01"
              value={s.minimum_order ?? 0}
              onChange={(e) => update({ minimum_order: Number(e.target.value) })}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={s.delivery_enabled !== false}
              onChange={(e) => update({ delivery_enabled: e.target.checked })}
            />{" "}
            Permitir entrega
          </label>
          <label>
            <input
              type="checkbox"
              checked={s.pickup_enabled !== false}
              onChange={(e) => update({ pickup_enabled: e.target.checked })}
            />{" "}
            Permitir retirada
          </label>
          <label>
            <input
              type="checkbox"
              checked={!!s.scheduling_enabled}
              onChange={(e) => update({ scheduling_enabled: e.target.checked })}
            />{" "}
            Permitir agendamento
          </label>
          <label>
            Antecedência mínima (minutos)
            <input
              type="number"
              min="15"
              max="10080"
              value={s.schedule_lead_minutes ?? 60}
              onChange={(e) => update({ schedule_lead_minutes: Number(e.target.value) })}
            />
          </label>
          <label>
            Agendar até (dias)
            <input
              type="number"
              min="1"
              max="30"
              value={s.schedule_days ?? 7}
              onChange={(e) => update({ schedule_days: Number(e.target.value) })}
            />
          </label>
        </div>
        <label className="flex gap-2 items-center text-sm my-5">
          <input
            type="checkbox"
            checked={!!s.enforce_hours}
            onChange={(e) => update({ enforce_hours: e.target.checked })}
          />{" "}
          Validar horários automaticamente
        </label>
        <p>
          Se o fechamento for antes da abertura, o atendimento termina no dia seguinte. Fechar a
          loja manualmente bloqueia também novos agendamentos.
        </p>
        <div className="weekly-hours">
          {hours.map((h) => (
            <div key={h.day}>
              <label>
                <input
                  type="checkbox"
                  checked={h.enabled}
                  onChange={(e) =>
                    update({
                      weekly_hours: hours.map((x) =>
                        x.day === h.day ? { ...x, enabled: e.target.checked } : x,
                      ),
                    })
                  }
                />
                {["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][h.day]}
              </label>
              <input
                aria-label={`Abertura ${h.day}`}
                type="time"
                value={h.opens}
                onChange={(e) =>
                  update({
                    weekly_hours: hours.map((x) =>
                      x.day === h.day ? { ...x, opens: e.target.value } : x,
                    ),
                  })
                }
              />
              <span>até</span>
              <input
                aria-label={`Fechamento ${h.day}`}
                type="time"
                value={h.closes}
                onChange={(e) =>
                  update({
                    weekly_hours: hours.map((x) =>
                      x.day === h.day ? { ...x, closes: e.target.value } : x,
                    ),
                  })
                }
              />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
