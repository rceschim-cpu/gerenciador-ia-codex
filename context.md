# Gerenciador de Iniciativas IA — Contexto do Projeto

## O que é esta aplicação

Dashboard web interno da **Positivo Tecnologia S.A. (Positec)** para gestão do portfólio de iniciativas de Inteligência Artificial da VP de Pricing & Costs. Desenvolvido por Rafael Ceschim (Pricing & Costs Coordinator).

**Problema que resolve:** ferramentas de gestão morrem por depender de disciplina humana para atualizar status. Esta ferramenta inverte a lógica — o sistema observa atividade em vez de esperar input diário.

**Stack:** React + Vite, CSS-in-JS (string de estilos inline), sem biblioteca de UI externa.

---

## Identidade Visual

Segue rigorosamente o brand guide da **+Positivo TecnologIA** (skill em `/skills/positivo-brand-grid/SKILL.md`).

**Regras críticas de CSS:**
- Nunca usar Inter, Roboto ou Arial — fonte exclusiva: **Montserrat** (Google Fonts)
- Paleta oficial:
  - `#2C2A29` — Positivo Black (fundo principal)
  - `#53565A` — Cool Gray 11 (superfícies)
  - `#3CDBC0` — Ciano Positivo (accent, glow no `+`, chip IA)
  - `#A7A8AA` — Cool Gray 6 (textos secundários)
- Status RAG: verde `#3CDBC0`, amarelo `#F5A623`, vermelho `#E05252`
- Logo oficial: `https://www.positivotecnologia.com.br/wp-content/themes/positivo/images/positivo_logo_IA_2025.png`
- Elemento `[IA]` em chip ciano sobre fundo escuro em títulos relevantes
- Frames em L (cantos decorativos) em cards de destaque

**Regra absoluta de refatoração:** redesigns visuais devem ser **CSS-only**. Nunca reestruturar o JSX para mudar aparência.

---

## Funcionalidades Atuais (v1)

- **Header:** logo oficial Positivo TecnologIA + subtítulo "Gerenciador de Iniciativas IA"
- **Métricas:** 5 cards (total, no prazo, atenção, em risco, ROI total estimado) com barra de saúde do portfólio (score 0–100)
- **Grid de cards:** iniciativas com status RAG, fase, progresso, ROI, responsável e alerta de staleness (borda amarela >7 dias, vermelha >14 dias sem update)
- **Painel lateral:** 3 abas — Detalhes, Check-in, IA
- **Check-in semanal:** 3 campos (RAG, progresso em slider, nota de texto) — menos de 2 minutos
- **Briefing Executivo IA:** chama `claude-sonnet-4-20250514` via Anthropic API e gera análise executiva do portfólio completo (Visão Geral, Alertas Críticos, Próximas Ações)
- **Adicionar iniciativa:** modal com campos básicos
- **Filtros:** por fase (Ideação/PoC/Piloto/Escala) e por RAG

---

## Dados e Contexto de Negócio

**Plantas:** MAO (Manaus), IOS (Ilhéus), CWB (Curitiba)

**Iniciativas atuais no portfólio (dados de exemplo/reais):**
1. Precificação Inteligente com IA — Piloto — Verde — R$ 3,2M/ano
2. PriceRadar – Inteligência Competitiva — Escala — Verde — R$ 1,8M/ano
3. SAP Natural Language Interface — PoC — Amarelo — R$ 800K/ano
4. Automação de Relatórios Fiscais — Ideação — Amarelo — R$ 500K/ano
5. Detecção de Anomalias em Custos — PoC — Vermelho — R$ 1,2M/ano

**Fases do ciclo de vida:** Ideação → PoC → Piloto → Escala

---

## Arquitetura Técnica

```
gerenciador-ia/
├── src/
│   └── App.jsx          # Toda a aplicação (componente único)
├── skills/
│   └── positivo-brand-grid/
│       └── SKILL.md     # Brand guide completo da Positivo TecnologIA
├── CONTEXT.md           # Este arquivo
├── index.html
├── package.json
└── vite.config.js
```

**Estado atual:** dados em memória (useState). Sem backend, sem autenticação, sem banco de dados.

---

## Backlog Priorizado (próximas evoluções)

### Alta prioridade
- [ ] **Persistência local** — salvar estado em `localStorage` para não perder dados ao recarregar
- [ ] **Integração SharePoint/Excel** — puxar dados via Microsoft Graph API (n8n já disponível)
- [ ] **Check-in por link direto** — n8n dispara webhook semanal, dono abre URL com formulário pré-preenchido

### Média prioridade
- [ ] **Deploy Vercel** — mesmo fluxo do PriceRadar (`rceschim-cpu/benchmarkprecos`)
- [ ] **Exportar briefing como PDF** — botão no painel do briefing executivo
- [ ] **Histórico de saúde** — gráfico de evolução do score ao longo do tempo
- [ ] **Notificações de staleness** — alert automático quando iniciativa passa 14 dias sem update

### Baixa prioridade
- [ ] **Integração SAP** — consultar status de projetos via OData/RFC (épico EP-09)
- [ ] **Autenticação** — login com conta corporativa Positivo (Azure AD / SSO)
- [ ] **Multi-VP** — expandir para outras Vice-Presidências

---

## Integrações Disponíveis

| Ferramenta | Status | Uso previsto |
|---|---|---|
| **n8n** (`ceschimml.app.n8n.cloud`) | ✅ Ativo | Webhooks, automações, conectores |
| **Anthropic API** | ✅ Ativo | Briefing executivo, análise de risco |
| **Microsoft Graph API** | 🔜 Pendente | Leitura de SharePoint/Excel |
| **SAP OData** | 🔜 Pendente TI | Consulta de projetos e custos |
| **Vercel** | ✅ Usado no PriceRadar | Deploy do app |

---

## Convenções de Código

- Componente único em `App.jsx` — não quebrar em múltiplos arquivos sem necessidade clara
- CSS como string template literal (`const CSS = \`...\``) injetado via `<style>`
- Classes CSS curtas (`.mc`, `.ic`, `.hd`) para manter o arquivo conciso
- Nomes de variáveis em inglês, comentários e commits em português
- Nenhuma dependência externa além do React — manter bundle mínimo

---

## Contexto do Desenvolvedor

**Rafael Ceschim** — Pricing & Costs Coordinator, Positivo Tecnologia, Curitiba/PR.  
+15 anos em Engenharia de Custos, Pricing e Consultoria (Renault, Nissan, EY, PwC).  
Familiaridade com React/JSX, APIs REST, n8n, Vite, Vercel e tributação brasileira complexa (ICMS, PIS/COFINS, IPI, ZFM, PPB).

---

*Última atualização: Março 2026*
