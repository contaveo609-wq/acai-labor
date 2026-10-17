import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUpRight, Sparkles, Snowflake, Package } from "lucide-react";
import { SiteShell } from "./SiteShell";
import { AcaiIllustration } from "./AcaiIllustration";
import { MenuBrowser } from "./MenuBrowser";

export function LaborHome() {
  const [search, setSearch] = useState("");
  return (
    <SiteShell search={search} onSearchChange={setSearch}>
      <section className="labor-hero">
        <AcaiIllustration className="edge-bowl bowl-one" simple />
        <AcaiIllustration className="edge-bowl bowl-two" simple />
        <div className="hero-copy">
          <span className="eyebrow">
            <span /> A SUA PAUSA MAIS GOSTOSA
          </span>
          <h1>
            Seu dia pede
            <br />
            um pouco de <em>açaí.</em>
            <svg viewBox="0 0 200 16" aria-hidden="true">
              <path d="M3 11C60 1 130 0 196 7M16 15c69-7 122-6 167-3" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
            </svg>
          </h1>
          <p>
            Cremoso na medida. Sabor em cada colherada.
            <br className="desktop-only" /> Escolha o seu favorito e deixe o resto com a gente.
          </p>
          <a href="#cardapio" className="hero-cta">
            Encontrar meu favorito <ArrowDown size={18} />
          </a>
          <div className="hero-details">
            <span>
              <Snowflake size={16} /> Açaí, cupuaçu e sorvetes
            </span>
            <span>
              <Package size={16} /> Do copo ao tamanho família
            </span>
          </div>
        </div>
        <div className="hero-art">
          <span className="orbit-word">UMA COLHERADA DE FELICIDADE</span>
          <span className="hero-spark spark-one">✦</span>
          <span className="hero-spark spark-two">✧</span>
          <div className="hero-art-circle" />
          <AcaiIllustration className="hero-bowl" />
          <div className="hero-sticker">
            Sabor que<br /><b>abraça.</b> <Sparkles size={17} />
          </div>
          <span className="hero-art-note">ilustração da casa ↗</span>
        </div>
      </section>
      <div className="labor-marquee" aria-hidden="true">
        <span>MAIS SABOR NO SEU DIA</span>✦<span>DO SEU JEITO</span>✦
        <span>UMA PAUSA BEM MERECIDA</span>✦<span>AÇAÍ LABOR</span>✦
        <span>MAIS SABOR NO SEU DIA</span>
      </div>
      <section id="cardapio" className="labor-menu-wrap">
        <div className="menu-intro">
          <div>
            <span className="eyebrow muted-eyebrow">ESCOLHA. COMBINE. APROVEITE.</span>
            <h2>Qual é a sua vontade?</h2>
          </div>
          <p>
            Um copo só seu ou sabor para compartilhar.
            <br /> Tem um Labor para cada momento. <ArrowUpRight size={16} />
          </p>
        </div>
        <MenuBrowser search={search} />
      </section>
      <section className="labor-bottom-banner">
        <AcaiIllustration simple />
        <div>
          <span className="eyebrow">SABOR EM BOA COMPANHIA</span>
          <h2>Tem açaí para a turma toda.</h2>
          <p>Conheça nossos potes de 1, 2, 5 e 10 litros.</p>
        </div>
        <a href="#cardapio">
          Vamos compartilhar <ArrowUpRight size={17} />
        </a>
      </section>
    </SiteShell>
  );
}
