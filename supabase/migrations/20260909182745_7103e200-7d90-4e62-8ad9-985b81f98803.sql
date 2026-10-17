update public.store_settings set logo_url = '/__l5e/assets-v1/a481dccb-cd81-437a-a981-88b61e9fca4a/logomarca.webp' where id;

insert into public.categories (name, slug, emoji, sort_order) values
 ('Combos & Almoços Completos','combos','🔥',1),
 ('Carnes na Brasa','carnes-na-brasa','🥩',2),
 ('Frangos Assados','frangos-assados','🍗',3),
 ('Acompanhamentos & Extras','acompanhamentos','🍚',4),
 ('Bebidas Geladas','bebidas','🥤',5);

insert into public.products (category_id, name, slug, description, price, price_from, weight, serves, quantity_label, is_featured, featured_order, sort_order) values
((select id from public.categories where slug='combos'),'Combo Costela no Bafo 8h + Acompanhamentos','combo-costela-bafo-8h','Costela no bafo assada lentamente por 8 horas, extremamente macia, suculenta e soltando do osso, acompanhada de 500g de arroz, 250g de maionese, 250g de farofa de banana e 250g de vinagrete. Uma refeição completa para quem ama costela de verdade.',120.00,true,'1,2 kg',4,null,true,1,1),
((select id from public.categories where slug='combos'),'Super Combo Família – Costela + Acompanhamentos + Coca 2L','super-combo-familia','Costela assada lentamente por 8 horas, extremamente macia, suculenta e soltando do osso + 2,5 kg de acompanhamentos: 1Kg de arroz, 500g de maionese, 500g de farofa de banana e 500g de vinagrete + Coca-Cola 2L.',174.00,true,null,5,'Bebida Gelada inclusa',false,0,2),
((select id from public.categories where slug='combos'),'Combo Capa do Contra-Filé + Acompanhamentos','combo-capa-contra-file','Capa do contra-filé assada na brasa, macia e suculenta, acompanhada de 500g de arroz, 250g de maionese, 250g de farofa de banana e 250g de vinagrete. Uma refeição completa para compartilhar.',109.50,true,'1 kg',4,null,false,0,3),
((select id from public.categories where slug='combos'),'Combo Fraldinha Premium + Acompanhamentos','combo-fraldinha-premium','Fraldinha assada na brasa, macia, suculenta e cheia de sabor, acompanhada de 500g de arroz, 250g de maionese, 250g de farofa de banana e 250g de vinagrete. Uma refeição completa para compartilhar.',129.99,true,'1 kg',4,null,false,0,4),
((select id from public.categories where slug='carnes-na-brasa'),'Costela no Bafo 8 Horas – Desmanchando','costela-no-bafo-8-horas','Costela preparada lentamente no bafo por 8 horas, até ficar extremamente macia, suculenta e soltando do osso. Preparada a partir de aproximadamente 1,5kg de carne crua, com cerca de 1,2kg após o assado. Ideal para compartilhar.',80.00,true,'1,2 kg',3,null,true,2,1),
((select id from public.categories where slug='carnes-na-brasa'),'Capa do Contra-Filé na Brasa – 1kg','capa-contra-file-brasa','Capa do contra-filé assada lentamente na brasa, com aquela camada de gordura que derrete durante o preparo e deixa a carne extremamente macia, suculenta e cheia de sabor. Porção de 1kg, ideal para compartilhar.',70.00,true,'1 kg',3,null,true,3,2),
((select id from public.categories where slug='carnes-na-brasa'),'Fraldinha Premium na Brasa','fraldinha-premium-brasa','Fraldinha assada lentamente na brasa, com exterior douradinho e interior macio e suculento. Corte saboroso, preparado no ponto para preservar a suculência e o sabor da carne.',90.00,true,'1 kg',3,null,true,4,3),
((select id from public.categories where slug='frangos-assados'),'Linguiça Assada na Brasa','linguica-assada-na-brasa','Linguiça assada na brasa, douradinha por fora, suculenta por dentro e cheia de sabor. Ideal para complementar o almoço ou acrescentar mais carne ao pedido.',3.50,false,null,null,'1 gomo',false,0,1),
((select id from public.categories where slug='acompanhamentos'),'⭐ Kit Acompanhamentos da Família – 1,25kg','kit-acompanhamentos-familia','Tudo para completar seu almoço em um único pedido: 500g de arroz branco, 250g de maionese cremosa com Hellmann’s, 250g de farofa de banana e 250g de vinagrete fresquinho. Ideal para acompanhar nossos frangos e carnes assadas. Comprando separadamente: R$ 40,00.',39.90,false,'1,25 kg',3,null,false,0,1),
((select id from public.categories where slug='acompanhamentos'),'Arroz Branco – 500g','arroz-branco-500g','Arroz branco soltinho e fresquinho, perfeito para acompanhar nossos assados. Porção de 500g.',10.00,false,'500g',2,null,false,0,2),
((select id from public.categories where slug='acompanhamentos'),'Maionese Cremosa com Hellmann''s – 250g','maionese-cremosa-250g','Maionese cremosa preparada com batata, cenoura e milho, finalizada com Hellmann''s. Geladinha e perfeita para acompanhar nossos assados.',12.00,false,'250g',2,null,false,0,3),
((select id from public.categories where slug='acompanhamentos'),'Farofa de Banana da Casa – 250g','farofa-banana-250g','Farofa crocante com banana, preparada para trazer aquele contraste levemente adocicado que combina perfeitamente com frango, costela e carnes assadas.',10.00,false,'250g',null,null,false,0,4),
((select id from public.categories where slug='acompanhamentos'),'Vinagrete Fresquinho da Casa – 250g','vinagrete-250g','Vinagrete fresco, leve e bem temperado, preparado com tomate, cebola e temperos da casa. Combina perfeitamente com frango, costela e carnes assadas.',8.00,false,'250g',2,null,false,0,5),
((select id from public.categories where slug='acompanhamentos'),'Batatinhas Bolinha Assadas – 10 un.','batatinhas-bolinha-assadas','Batatinhas bolinha temperadas com o tempero especial da Skina, pré-assadas e finalizadas até ficarem douradinhas por fora e macias por dentro. Perfeitas para acompanhar nossos frangos e carnes.',10.00,false,null,2,'10 unidades',false,0,6),
((select id from public.categories where slug='bebidas'),'Coca-Cola 2L Gelada','coca-cola-2l','Coca-Cola 2 litros geladinha, perfeita para acompanhar seu almoço em família.',14.00,false,'2 L',null,'Bebida Gelada',false,0,1),
((select id from public.categories where slug='bebidas'),'Coca-Cola Zero 2L Gelada','coca-cola-zero-2l','Coca-Cola Zero 2 litros geladinha, perfeita para acompanhar seu almoço sem açúcar.',14.00,false,'2 L',null,'Bebida Gelada',false,0,2),
((select id from public.categories where slug='bebidas'),'Fanta 2L Gelada','fanta-2l','Fanta 2 litros bem gelada, perfeita para acompanhar os assados.',14.00,false,'2 L',null,'Bebida Gelada',false,0,3),
((select id from public.categories where slug='bebidas'),'Guaraná Antarctica 2L Gelado','guarana-2l','Guaraná Antarctica 2 litros bem gelado para acompanhar seu almoço.',14.00,false,'2 L',null,'Bebida Gelada',false,0,4),
((select id from public.categories where slug='bebidas'),'Cerveja Lata Gelada','cerveja-lata','Cerveja em lata bem gelada para acompanhar seu pedido.',6.00,false,null,null,'Lata',false,0,5);

insert into public.product_images (product_id, url, sort_order, is_primary)
select p.id, x.url, x.ord, x.ord = 0
from (values
 ('combo-costela-bafo-8h','/__l5e/assets-v1/b13ab744-effa-4dc2-9c50-fd408edc0d39/a0cbed1711.webp',0),
 ('combo-costela-bafo-8h','/__l5e/assets-v1/fe225644-be58-4dc3-92bd-dd8418f02067/5ac471fa91.webp',1),
 ('combo-costela-bafo-8h','/__l5e/assets-v1/0b6225ff-fb87-4c1c-ad1e-e4b89d9d326b/8ad0c1f3ee.webp',2),
 ('combo-costela-bafo-8h','/__l5e/assets-v1/6435010d-5c45-456b-afe0-4234a2e8da6f/41a39b1e31.webp',3),
 ('costela-no-bafo-8-horas','/__l5e/assets-v1/fe225644-be58-4dc3-92bd-dd8418f02067/5ac471fa91.webp',0),
 ('costela-no-bafo-8-horas','/__l5e/assets-v1/6435010d-5c45-456b-afe0-4234a2e8da6f/41a39b1e31.webp',1),
 ('capa-contra-file-brasa','/__l5e/assets-v1/19bce665-2779-43bd-aff6-615546349102/1b34539692.webp',0),
 ('capa-contra-file-brasa','/__l5e/assets-v1/3dc1ca17-abcb-4b3c-9d28-dab9e950416d/25112412f3.webp',1),
 ('capa-contra-file-brasa','/__l5e/assets-v1/5a82122c-d428-45f8-8b70-877ac4620c7e/c5a7329c9c.webp',2),
 ('fraldinha-premium-brasa','/__l5e/assets-v1/e75d4a38-5d3a-40cc-9b5b-59ef365e8148/ac45245683.webp',0),
 ('fraldinha-premium-brasa','/__l5e/assets-v1/e2318ee7-6d38-4ab3-a0b5-f902fbce96bc/f89d9b3fa2.webp',1),
 ('fraldinha-premium-brasa','/__l5e/assets-v1/211c2b20-03ab-42dd-b142-5bd7e545c27a/32cead9746.webp',2),
 ('linguica-assada-na-brasa','/__l5e/assets-v1/2e8d2a6d-34ac-41ed-a8e4-0218ca5084c0/a6d7f8de79.webp',0),
 ('kit-acompanhamentos-familia','/__l5e/assets-v1/3256dc25-5920-4a40-aa6c-33f4945f87fa/555842978c.webp',0),
 ('farofa-banana-250g','/__l5e/assets-v1/c294385a-bf5c-4955-bc23-045bc1e7ccba/1b667ea7a8.webp',0),
 ('arroz-branco-500g','/__l5e/assets-v1/4badb7ec-64df-49ed-a4c5-29edc8a3aab5/b4e7fcafb1.webp',0),
 ('batatinhas-bolinha-assadas','/__l5e/assets-v1/c2635ca8-84b0-4bbf-aeed-f3fa29203b52/fd32cebcc8.webp',0),
 ('maionese-cremosa-250g','/__l5e/assets-v1/64129e8a-3ef0-46d6-a2f8-83839f34420c/85c2e1f578.webp',0),
 ('vinagrete-250g','/__l5e/assets-v1/960e7451-f8c7-4856-a0af-8ddb11821c95/e435dd6575.webp',0),
 ('super-combo-familia','/__l5e/assets-v1/56b0b449-18ce-4073-a40c-c86506e5d5dd/31950f3afd.webp',0),
 ('combo-capa-contra-file','/__l5e/assets-v1/c69a1dbc-fc5b-4a31-9cb8-7e62f06cdc97/e957dfbfba.webp',0),
 ('combo-capa-contra-file','/__l5e/assets-v1/e67db6d6-167c-4a25-b609-81eb2861c56f/8c75d4e97d.webp',1),
 ('combo-capa-contra-file','/__l5e/assets-v1/2adaba5f-9995-45a4-979c-be1e2bd15114/d37a9bf06f.webp',2),
 ('combo-fraldinha-premium','/__l5e/assets-v1/aeded722-7dd9-4f0c-a370-d099db762808/fe8c251402.webp',0),
 ('combo-fraldinha-premium','/__l5e/assets-v1/85902c5a-2702-4f0b-b9d3-43c3775778e6/bdf2f1d68e.webp',1),
 ('fanta-2l','/__l5e/assets-v1/0b9becb2-3545-4b8f-ab84-1cb0d0c63625/6e7565ee73.webp',0),
 ('cerveja-lata','/__l5e/assets-v1/3bf099bd-d92e-4dbe-86b5-9c22de64bc28/9100f18e00.webp',0),
 ('coca-cola-2l','/__l5e/assets-v1/38217e6c-c927-435b-9d1e-139a0cdad51e/6557c2f47a.webp',0),
 ('coca-cola-zero-2l','/__l5e/assets-v1/bbe84da0-001d-49df-b651-74324a728b00/a100643112.webp',0),
 ('guarana-2l','/__l5e/assets-v1/64431e27-ec41-4cdb-9cd8-e1a42ea05f7f/03d77cd655.webp',0)
) as x(slug, url, ord)
join public.products p on p.slug = x.slug;

do $$
declare
  s text;
  g uuid;
  slugs text[] := array['combo-costela-bafo-8h','super-combo-familia','combo-capa-contra-file','combo-fraldinha-premium','costela-no-bafo-8-horas','capa-contra-file-brasa','fraldinha-premium-brasa'];
  pid uuid;
begin
  foreach s in array slugs loop
    select id into pid from public.products where slug = s;

    insert into public.addon_groups (product_id, title, min_select, max_select, sort_order)
    values (pid, '🍚 Complete seu almoço', 0, 6, 1) returning id into g;
    insert into public.product_addons (group_id, name, description, price, sort_order) values
      (g,'🍚 Arroz 500g','Arroz branco soltinho e fresquinho, perfeito para acompanhar nossos assados. Porção de 500g.',10.00,1),
      (g,'🥔 Maionese Cremosa com Hellmann''s (250g)','Maionese cremosa preparada com batata, cenoura e milho, finalizada com Hellmann''s.',12.00,2),
      (g,'🍌 Farofa de Banana 250g','Farofa crocante com banana, com aquele contraste levemente adocicado.',10.00,3),
      (g,'🥗 Vinagrete Fresquinho da Casa – 250g','Vinagrete fresco, leve e bem temperado, com tomate, cebola e temperos da casa.',8.00,4);

    insert into public.addon_groups (product_id, title, min_select, max_select, sort_order)
    values (pid, '🥤 Bebida para acompanhar', 0, 4, 2) returning id into g;
    insert into public.product_addons (group_id, name, description, price, sort_order) values
      (g,'Coca-Cola 2L Gelada','Coca-Cola 2 litros geladinha.',14.00,1),
      (g,'🥤 Coca-Cola Zero 2L Gelada','Coca-Cola Zero 2 litros geladinha.',14.00,2),
      (g,'🥤 Fanta 2L Gelada','Fanta 2 litros bem gelada.',14.00,3),
      (g,'🥤 Guaraná Antarctica 2L Gelado','Guaraná Antarctica 2 litros bem gelado.',14.00,4),
      (g,'🍺 Cerveja Lata','Cerveja em lata bem gelada.',6.00,5);

    insert into public.addon_groups (product_id, title, min_select, max_select, sort_order)
    values (pid, '🍖 Acrescente mais carne', 0, 3, 3) returning id into g;
    insert into public.product_addons (group_id, name, description, price, sort_order) values
      (g,'🍗 Coxa/Sobrecoxa Assada','Coxa com sobrecoxa assada lentamente na brasa, com o tempero especial da casa.',10.00,1),
      (g,'Linguiça Assada','Linguiça Assada (gomo).',3.50,2);
  end loop;
end $$;