# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projeto

Simulador de salários para Portugal — aplicação web estática (HTML + CSS + JS vanilla, sem frameworks nem dependências externas).

## Execução

Necessita de um servidor HTTP (o `fetch()` de JSON não funciona com `file://`):

```bash
npx serve .
# ou
python -m http.server 8080
```

## Estrutura de ficheiros

```
index.html               — markup completo; formulário e relatório
styles.css               — todos os estilos
app.js                   — toda a lógica (cálculo + DOM)
tabelas/
  manifest.json          — lista de anos disponíveis  { anos: [], anoAtivo: N }
  2026/
    Continente.xlsx      — fonte oficial AT (não editado)
    Madeira.xlsx
    Açores.xlsx
    continente.json      — gerado por Python a partir do xlsx
    madeira.json
    acores.json
```

## Adicionar um novo ano fiscal

1. Criar pasta `tabelas/<ano>/`
2. Colocar os 3 xlsx oficiais da AT dentro
3. Correr o script de extração (ver abaixo) para gerar os 3 JSON
4. Adicionar `<ano>` ao array `"anos"` em `tabelas/manifest.json`

Script de extração (requer `openpyxl`):
```bash
pip install openpyxl
python tabelas/parsear.py <ano>   # a criar quando necessário
```
A lógica de parsing está documentada no próprio `app.js` e na secção "Fórmula AT".

## Convenções de código

- **Língua**: Português europeu em todo o UI, comentários e nomes.
- **JS**: ES2020+ (const/let, arrow functions, template literals, optional chaining). Sem `var`. Funções puras; sem classes desnecessárias.
- **Nomes**: camelCase para variáveis/funções (`calcularIRS`, `salarioBruto`); kebab-case para IDs e classes HTML (`campo-grupo`, `btn-calcular`).
- **CSS**: variáveis CSS no `:root` — nunca inventar valores soltos. Sem inline styles.
- **Sem comentários óbvios** — apenas onde a lógica fiscal não é imediatamente clara.

## Estrutura do `app.js`

| Secção | Conteúdo |
|---|---|
| 1 | Constantes (`TAXAS`, `SA_LIMITES`, `MESES_SAL`) |
| 2 | Estado global de tabelas (`_anoAtivo`, `_tabelasAtivas`) |
| 3 | `carregarManifest()`, `carregarTabelasAno(ano)` — fetch assíncrono |
| 4 | `selecionarLetraTabela()` — mapeamento situação → tabela I–VII |
| 5 | `calcularRetencaoIRS()` — fórmula AT normalizada |
| 6 | `calcularSSTrabalhador()` |
| 7 | `calcularSubsidioAlimentacao()` |
| 8 | `calcularAjudasCusto()` |
| 9 | `calcularSimulacao()` — orquestrador; devolve `{ t, e, ratios }` |
| 10 | `guardarSimulacao()`, `carregarUltimaSimulacao()`, `carregarTaxaSeguroAT()` |
| 11 | (a criar) Ligação ao DOM — event listeners, render do relatório |

## Fórmula AT de retenção na fonte

Os JSON das tabelas têm os campos já **normalizados** para a forma linear:

```
Retenção = R × taxa − parcela − parcelaDep × nDepEfetivos
```

As linhas com fórmula variável do Excel (`taxa × coef × (K − R)`) foram
convertidas durante a extração Python para:
- `taxaN = taxa × (1 + coef2)`
- `parcelaN = taxa × coef2 × const`

## Mapeamento de situação → tabela AT

| Situação | Incap. titular | Dep. | Tabela |
|---|---|---|---|
| solteiro | não | 0 | I |
| solteiro | não | 1+ | II |
| casado 1 titular | não | qualquer | III |
| casado 2 titulares | não | qualquer | I |
| solteiro / casado2 | sim | 0 | IV |
| solteiro | sim | 1+ | V |
| casado 2 titulares | sim | 1+ | VI |
| casado 1 titular | sim | qualquer | VII |

Dependentes com deficiência ≥ 60 %: contam em dobro para `parcelaDep`
(`nDepEfetivos = numDep × 2` quando checkbox ativo).

## Tokens CSS

| Token | Uso |
|---|---|
| `--azul-escuro/medio/claro` | Hierarquia de cor primária |
| `--azul-suave/borda` | Fundos e bordas suaves |
| `--verde/verde-suave` | Valores positivos, botão exportar |
| `--vermelho/vermelho-suave` | Deduções, erros |
| `--gap-xs…2xl` | Espaçamentos (0.25 → 3 rem) |
| `--radius-sm/md/lg` | Raios de borda |
| `--sombra-sm/md/lg` | Box-shadows |
| `--trans` | Transição padrão (160 ms ease) |

## Layout

- Desktop (> 900 px): grid 2 colunas — formulário (420 px fixo) | relatório.
- Mobile (≤ 900 px): coluna única.
- `@media print`: oculta formulário e footer; força cores com `print-color-adjust`.

## Referências legais

| Rubrica | Referência |
|---|---|
| Tabelas retenção IRS 2026 (Continente) | Despacho n.º — de 2026 |
| Tabelas retenção IRS 2026 (Açores/Madeira) | Despachos regionais 2026 |
| TSU trabalhador | 11 % (Código Contributivo, art. 53.º) |
| TSU entidade patronal | 23,75 % (Código Contributivo, art. 53.º) |
| SA isento — numerário | €6,00/dia (Portaria n.º 107-A/2023) |
| SA isento — cartão refeição | €9,60/dia (majoração 60 %) |
| SA — meses | 11 meses (exclui mês de férias) |
| SA — dias úteis/mês | 21 dias |
| Seguro AT | 1,85 % sobre salário anual (taxa de referência; editável) |
| Dep. com deficiência | Equivalem ao dobro (art. 86.º-A CIRS) |

## localStorage

| Chave | Conteúdo |
|---|---|
| `sim_ultima_simulacao` | JSON com todos os inputs da última simulação |
| `sim_taxa_seguro_at` | Taxa do seguro AT editada pelo utilizador |
