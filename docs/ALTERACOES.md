# Inventário de alterações

Base: skinadofrango.zip. 141 arquivos existentes preservados byte a byte.

A arquitetura existente foi mantida. Alterações principais: instalação reproduzível; autenticação administrativa sem senha no cliente; adaptador demonstrativo no servidor; tema Açaí Labor; importação do catálogo; checkout, carrinho e painel funcionais.

## Arquivos modificados

- `.gitignore`
- `package-lock.json`
- `package.json`
- `README.md`
- `src/components/MenuBrowser.tsx`
- `src/components/ProductCard.tsx`
- `src/components/ProductDialog.tsx`
- `src/components/SiteFooter.tsx`
- `src/components/SiteHeader.tsx`
- `src/components/SiteShell.tsx`
- `src/integrations/supabase/auth-attacher.ts`
- `src/lib/admin-auth.tsx`
- `src/lib/auth.tsx`
- `src/lib/cart.tsx`
- `src/lib/menu.ts`
- `src/routes/__root.tsx`
- `src/routes/admin.login.tsx`
- `src/routes/admin.tsx`
- `src/routes/cardapio.tsx`
- `src/routes/carrinho.tsx`
- `src/routes/checkout.tsx`
- `src/routes/index.tsx`
- `src/routes/pedido.$id.tsx`
- `vite.config.ts`

## Arquivos criados

- `.env.example`
- `docs/PRODUCAO.md`
- `docs/REFERENCIA-SKINA.md`
- `docs/TESTES.md`
- `INICIAR.bat`
- `LEIA-ME.md`
- `public/catalog/10-caixas-acai-labor-10-litros-155592bf240abc29c2f78ab7eece56d5.webp`
- `public/catalog/acai-labor-2l-18db40e0b2ab7250e633df574268e62a.webp`
- `public/catalog/acai-labor-2l-f83967f9a3f9c68c614b18e009780048.webp`
- `public/catalog/acai-labor-5l-91e2ab7948d5f2a90d9129c6d960ad0b.webp`
- `public/catalog/acai-labor-caixa-1l-130df4070628362d2b6ce55621e87f21.webp`
- `public/catalog/acai-labor-de-10-l-8e5670f530613cd4fe848cd03308ae3c.webp`
- `public/catalog/acai-no-copo-300ml-d0c9cc146d77d3eb8092ca4d6a5f9d55.webp`
- `public/catalog/acai-no-copo-500ml-096aa6e77bf4fb001f8b70825c18bfb1.webp`
- `public/catalog/cupuacu-5-l-368cf9339a5226783a1d45e3c912044a.webp`
- `public/catalog/cupuacu-de-10-l-ad59e0f800d1fbee59dad9324c110063.webp`
- `public/catalog/cupuacu-labor-2-litros-6e682e6e58f49b00dd01a99ffeef926d.webp`
- `public/catalog/picole-atacado-01-pacote-com-10-unidades-72e3982519162ca5b6efcc18894d2dbc.webp`
- `public/catalog/picole-atacado-01-pacote-com-10-unidades-7a0c43419d321cd324f0229ee5ebf1c4.webp`
- `public/catalog/picole-atacado-01-pacote-com-10-unidades-9b2a684deb3fc55a38a4471f22642a73.webp`
- `public/catalog/picole-atacado-01-pacote-com-10-unidades-a1c3334e1c98c771d3c3731cb22a2e6d.webp`
- `public/favicon-labor.svg`
- `scripts/import-catalog.mjs`
- `scripts/start-local.mjs`
- `src/components/AcaiIllustration.tsx`
- `src/components/admin/LaborAdmin.tsx`
- `src/components/LaborAssistant.tsx`
- `src/components/LaborCheckout.tsx`
- `src/components/LaborHeader.tsx`
- `src/components/LaborHome.tsx`
- `src/data/catalog-provenance.json`
- `src/data/labor-catalog.json`
- `src/labor.css`
- `src/lib/demo.ts`
- `src/lib/labor.functions.ts`
- `src/lib/labor.schema.ts`
- `src/lib/labor.service.ts`
- `src/lib/labor.types.ts`
- `supabase/migrations/20261016010000_delivery_multistore.sql`
- `tests/labor.test.ts`
- `docs/ALTERACOES.md` (este inventário)

## Não distribuído no ZIP

`.env`, `.local/`, dependências instaladas, caches e builds não entram no pacote. `.env.example` está incluído. O README original foi preservado como docs/REFERENCIA-SKINA.md. Os ZIPs em Downloads não foram modificados.

## Limites

Consulte docs/PRODUCAO.md para integrações pendentes e docs/TESTES.md para a validação executada.
