import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUpRight, Snowflake, Package, Pause, Play, Sparkles } from "lucide-react";
import { SiteShell } from "./SiteShell";
import { AcaiIllustration } from "./AcaiIllustration";
import { MenuBrowser } from "./MenuBrowser";
import { fetchStoreSettings } from "@/lib/menu";
import "./labor-home.css";

const DEFAULT_TITLE = "Seu dia pede uma pausa. E muito açaí.";
const flavors = ["AÇAÍ DE VERDADE", "DO SEU JEITO", "UMA COLHERADA DE FELICIDADE", "AÇAÍ LABOR"];

export function LaborHome() {
  const [search, setSearch] = useState("");
  const [paused, setPaused] = useState(false);
  const { data: store } = useQuery({ queryKey: ["store"], queryFn: fetchStoreSettings });
  const title = store?.hero_title || DEFAULT_TITLE;
  return (
    <SiteShell search={search} onSearchChange={setSearch}>
      <div className={`labor-home${paused ? " is-motion-paused" : ""}`}>
        <section className="acai-hero" aria-labelledby="acai-hero-title">
          <div className="acai-hero-grain" aria-hidden="true" />
          <div className="acai-hero-mini mini-top" aria-hidden="true">
            <AcaiIllustration simple />
          </div>
          <div className="acai-hero-mini mini-bottom" aria-hidden="true">
            <AcaiIllustration simple />
          </div>
          <div className="acai-hero-copy">
            <span className="acai-kicker">
              <span /> DIRETO DA LABOR. DO SEU JEITO.
            </span>
            <h1 id="acai-hero-title">
              {title === DEFAULT_TITLE ? (
                <>
                  Seu dia pede
                  <br />
                  uma pausa.
                  <br />
                  <em>E muito açaí.</em>
                </>
              ) : (
                title
              )}
            </h1>
            <p>
              {store?.hero_description ||
                "Açaí, cupuaçu, sorvetes e muito mais, direto da Labor para o seu pedido."}
            </p>
            <div className="acai-hero-actions">
              <a href="#cardapio" className="acai-primary-link">
                Quero meu açaí <ArrowUpRight size={21} />
              </a>
              <a href="#labor-banner" className="acai-secondary-link">
                Conheça a Labor <ArrowDown size={16} />
              </a>
            </div>
            <a
              href="#cardapio"
              className="acai-hero-highlight-link"
              onClick={() => setSearch("AÇAI LABOR CAIXA 2L")}
            >
              <Sparkles size={15} /> Destaque da Labor: conheça a caixa 2 L <ArrowUpRight size={16} />
            </a>
            <div className="acai-hero-perks">
              <span>
                <Snowflake size={17} /> Cremoso em cada colherada
              </span>
              <span>
                <Package size={17} /> Do copo à caixa
              </span>
            </div>
          </div>
          <div className="acai-hero-stage" aria-hidden="true">
            <div className="acai-orbit orbit-outer" />
            <div className="acai-orbit orbit-inner" />
            <span className="acai-stage-word">açaí.</span>
            <span className="acai-floating-label label-top">
              <Sparkles size={16} /> Uma colherada de felicidade
            </span>
            <span className="acai-stage-spark stage-spark-one">✦</span>
            <span className="acai-stage-spark stage-spark-two">✧</span>
            <span className="acai-berry berry-one" />
            <span className="acai-berry berry-two" />
            <span className="acai-leaf leaf-one" />
            <span className="acai-leaf leaf-two" />
            <div className="acai-hero-product-frame">
              <img
                src="/images/acai-labor-caixa-2l-promo.jpeg"
                alt="Caixa de açaí 2 L da Açaí Labor"
                width="1080"
                height="1920"
                fetchPriority="high"
              />
              <span>Destaque da Labor · Caixa 2 L</span>
            </div>
            <div className="acai-stage-seal">
              MAIS SABOR
              <br />
              <strong>mais Labor.</strong>
              <span>✦ ✦ ✦</span>
            </div>
            <span className="acai-floating-label label-bottom">
              Seu momento mais gostoso <span>↗</span>
            </span>
          </div>
          <button
            type="button"
            className="acai-motion-toggle"
            aria-pressed={paused}
            onClick={() => setPaused(!paused)}
          >
            {paused ? <Play size={13} /> : <Pause size={13} />}
            {paused ? "Retomar animações" : "Pausar animações"}
          </button>
        </section>
        <div className="acai-ribbon" aria-hidden="true">
          <div className="acai-ribbon-track">
            {[0, 1].map((copy) => (
              <div className="acai-ribbon-group" key={copy}>
                {flavors.map((flavor) => (
                  <span key={flavor}>
                    {flavor}
                    <b>✦</b>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
        <section className="acai-discover" aria-label="Encontre seu açaí favorito">
          <a href="#cat-acai-com-frutas-condimenntos" className="acai-discover-card">
            <span className="discover-art">
              <AcaiIllustration />
            </span>
            <span>
              <small>SEU MOMENTO</small>
              <strong>Um açaí só seu</strong>
              <span>Frutas, cremes e combinações</span>
            </span>
            <ArrowUpRight size={23} />
          </a>
          <a href="#cat-acai-atacado" className="acai-discover-card">
            <span className="discover-art">
              <Package size={44} strokeWidth={1.4} />
            </span>
            <span>
              <small>PARA COMPARTILHAR</small>
              <strong>Sabor em tamanho família</strong>
              <span>Conheça nossas caixas e potes</span>
            </span>
            <ArrowUpRight size={23} />
          </a>
          <a href="#cat-picoles-sabores" className="acai-discover-card">
            <span className="discover-art">
              <Snowflake size={44} strokeWidth={1.4} />
            </span>
            <span>
              <small>REFRESQUE SEU DIA</small>
              <strong>Deu vontade de picolé?</strong>
              <span>Encontre seu sabor favorito</span>
            </span>
            <ArrowUpRight size={23} />
          </a>
        </section>
        <section
          id="labor-banner"
          className="acai-official-banner"
          aria-label="Banner da Açaí Labor"
        >
          <a href="#cardapio" aria-label="Ver o cardápio da Açaí Labor">
            <img
              src="/images/acai-labor-banner.webp"
              alt="Açaí Labor: funcionamos todos os dias, das 10h às 23h45"
              width="800"
              height="300"
              loading="lazy"
            />
          </a>
          <div className="acai-banner-copy">
            <span className="acai-section-kicker">A SUA PAUSA TEM ENDEREÇO</span>
            <h2>
              Abriu o apetite?
              <br />
              <em>A Labor resolve.</em>
            </h2>
            <p>Escolha o seu favorito no cardápio e deixe o resto com a gente.</p>
            <a href="#cardapio">
              Explorar o cardápio <ArrowDown size={17} />
            </a>
          </div>
        </section>
        <section id="cardapio" className="labor-menu-wrap acai-menu">
          <div className="acai-menu-decoration" aria-hidden="true">
            <AcaiIllustration simple />
          </div>
          <div className="menu-intro">
            <div>
              <span className="acai-section-kicker">ESCOLHA. COMBINE. SE APAIXONE.</span>
              <h2>
                Qual é a sua <em>vontade?</em>
              </h2>
            </div>
            <p>
              Do primeiro desejo à última colherada.
              <br /> Encontre seu próximo favorito. <ArrowUpRight size={18} />
            </p>
          </div>
          <MenuBrowser search={search} />
        </section>
        <section className="acai-sharing">
          <div className="sharing-bowls" aria-hidden="true">
            <AcaiIllustration />
            <AcaiIllustration simple />
            <span>✦</span>
          </div>
          <div>
            <span className="acai-kicker">COISA BOA A GENTE COMPARTILHA</span>
            <h2>
              Chama a turma.
              <br />
              <em>O açaí é Labor.</em>
            </h2>
            <p>Do seu copo favorito aos potes para todo mundo.</p>
            <a href="#cat-acai-atacado" className="acai-primary-link">
              Escolher para compartilhar <ArrowUpRight size={20} />
            </a>
          </div>
          <div className="sharing-mini" aria-hidden="true">
            <AcaiIllustration simple />
          </div>
        </section>
      </div>
    </SiteShell>
  );
}
