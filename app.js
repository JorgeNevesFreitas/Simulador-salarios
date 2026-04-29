/* ═══════════════════════════════════════════════════════════════
   SIMULADOR DE SALÁRIOS — PORTUGAL
   app.js — lógica de cálculo (sem ligação ao DOM neste módulo)

   Estrutura:
     1.  Constantes fiscais e contributivas
     2.  Estado global de tabelas (carregadas por fetch assíncrono)
     3.  Carregamento de tabelas (manifest + JSON por ano)
     4.  Seleção da tabela de retenção (I a VII)
     5.  Cálculo da retenção de IRS
     6.  Segurança Social do trabalhador
     7.  Subsídio de Alimentação
     8.  Ajudas de Custo
     9.  Orquestrador — calcularSimulacao()
    10.  Persistência — localStorage
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ───────────────────────────────────────────────────────────────
   1. CONSTANTES FISCAIS E CONTRIBUTIVAS
   ─────────────────────────────────────────────────────────────── */

const TAXAS = {
  ssTrabalhador: 0.11,     // Código Contributivo, art. 53.º
  ssPatronal:    0.2375,   // Código Contributivo, art. 53.º
  seguroAT:      0.0185,   // Taxa de referência; editável pelo utilizador
};

// Subsídio de Alimentação — limites de isenção vigentes
// (atualizáveis sem alterar a lógica de cálculo)
const SA_LIMITES = {
  normal:  6.00,   // Pagamento em numerário  (Portaria n.º 107-A/2023)
  cartao:  9.60,   // Pagamento por cartão/vales (majoração 60 %)
};

const SA_DIAS_MES = 21;   // dias úteis médios por mês
const SA_MESES    = 11;   // meses com SA (exclui o mês de férias)
const MESES_SAL   = 14;   // meses de salário (12 + sub. férias + sub. natal)

/* ───────────────────────────────────────────────────────────────
   2. DADOS EMBUTIDOS — tabelas e manifest
   (funcionam sem servidor, com protocolo file://)

   Para adicionar um novo ano fiscal:
     a) Com servidor HTTP: criar tabelas/<ano>/{continente,acores,madeira}.json
        e adicionar o ano ao manifest embutido abaixo.
     b) Sem servidor: adicionar a entrada TABELAS_EMBED[<ano>] com os dados
        gerados pelo script Python (ver CLAUDE.md).
   ─────────────────────────────────────────────────────────────── */

const MANIFEST_EMBED = {
  anos:     [2026],
  anoAtivo: 2026,
};

// Dados extraídos dos ficheiros Excel oficiais AT (tabelas/2026/*.xlsx)
// Fórmula normalizada: Retenção = R × taxa − parcela − parcelaDep × nDep
const TABELAS_EMBED = {
  2026: {"continente":{"ano":2026,"regiao":"continente","label":"Portugal Continental","fonte":"Despacho n.º xxx/2026 — 1 de janeiro a 31 de dezembro de 2026","tabelas":{"I":{"descricao":"Não casado sem dependentes / Casado 2 titulares","escaloes":[{"ate":920.0,"taxa":0.0,"parcela":0.0,"parcelaDep":0.0},{"ate":1042.0,"taxa":0.45,"parcela":414.0012,"parcelaDep":21.43},{"ate":1108.0,"taxa":0.36895,"parcela":329.5462,"parcelaDep":21.43},{"ate":1154.0,"taxa":0.157,"parcela":94.71,"parcelaDep":21.43},{"ate":1212.0,"taxa":0.212,"parcela":158.18,"parcelaDep":21.43},{"ate":1819.0,"taxa":0.241,"parcela":193.33,"parcelaDep":21.43},{"ate":2119.0,"taxa":0.311,"parcela":320.66,"parcelaDep":21.43},{"ate":2499.0,"taxa":0.349,"parcela":401.19,"parcelaDep":21.43},{"ate":3305.0,"taxa":0.3836,"parcela":487.66,"parcelaDep":21.43},{"ate":5547.0,"taxa":0.3969,"parcela":531.62,"parcelaDep":21.43},{"ate":20221.0,"taxa":0.4495,"parcela":823.4,"parcelaDep":21.43},{"ate":null,"taxa":0.4717,"parcela":1272.31,"parcelaDep":21.43}]},"II":{"descricao":"Não casado com 1 ou mais dependentes","escaloes":[{"ate":920.0,"taxa":0.0,"parcela":0.0,"parcelaDep":0.0},{"ate":1042.0,"taxa":0.45,"parcela":414.0012,"parcelaDep":34.29},{"ate":1108.0,"taxa":0.36895,"parcela":329.5462,"parcelaDep":34.29},{"ate":1154.0,"taxa":0.157,"parcela":94.71,"parcelaDep":34.29},{"ate":1212.0,"taxa":0.212,"parcela":158.18,"parcelaDep":34.29},{"ate":1819.0,"taxa":0.241,"parcela":193.33,"parcelaDep":34.29},{"ate":2119.0,"taxa":0.311,"parcela":320.66,"parcelaDep":34.29},{"ate":2499.0,"taxa":0.349,"parcela":401.19,"parcelaDep":34.29},{"ate":3305.0,"taxa":0.3836,"parcela":487.66,"parcelaDep":34.29},{"ate":5547.0,"taxa":0.3969,"parcela":531.62,"parcelaDep":34.29},{"ate":20221.0,"taxa":0.4495,"parcela":823.4,"parcelaDep":34.29},{"ate":null,"taxa":0.4717,"parcela":1272.31,"parcelaDep":34.29}]},"III":{"descricao":"Casado único titular","escaloes":[{"ate":991.0,"taxa":0.0,"parcela":0.0,"parcelaDep":0.0},{"ate":1042.0,"taxa":0.45,"parcela":445.9488,"parcelaDep":42.86},{"ate":1108.0,"taxa":0.29375,"parcela":283.1372,"parcelaDep":42.86},{"ate":1119.0,"taxa":0.125,"parcela":96.17,"parcelaDep":42.86},{"ate":1432.0,"taxa":0.1272,"parcela":98.64,"parcelaDep":42.86},{"ate":1962.0,"taxa":0.157,"parcela":141.32,"parcelaDep":42.86},{"ate":2240.0,"taxa":0.1938,"parcela":213.53,"parcelaDep":42.86},{"ate":2773.0,"taxa":0.2277,"parcela":289.47,"parcelaDep":42.86},{"ate":3389.0,"taxa":0.257,"parcela":370.72,"parcelaDep":42.86},{"ate":5965.0,"taxa":0.2881,"parcela":476.12,"parcelaDep":42.86},{"ate":20265.0,"taxa":0.3843,"parcela":1049.96,"parcelaDep":42.86},{"ate":null,"taxa":0.4717,"parcela":2821.13,"parcelaDep":42.86}]},"IV":{"descricao":"Não casado ou casado 2 titulares sem dependentes — titular com incapacidade ≥ 60%","escaloes":[{"ate":1694.0,"taxa":0.0,"parcela":0.0,"parcelaDep":0.0},{"ate":2063.0,"taxa":0.212,"parcela":359.13,"parcelaDep":0.0},{"ate":2492.0,"taxa":0.311,"parcela":563.37,"parcelaDep":0.0},{"ate":4487.0,"taxa":0.349,"parcela":658.07,"parcelaDep":0.0},{"ate":4753.0,"taxa":0.3836,"parcela":813.33,"parcelaDep":0.0},{"ate":6687.0,"taxa":0.3969,"parcela":876.55,"parcelaDep":0.0},{"ate":20468.0,"taxa":0.4495,"parcela":1228.29,"parcelaDep":0.0},{"ate":null,"taxa":0.4717,"parcela":1682.68,"parcelaDep":0.0}]},"V":{"descricao":"Não casado com 1 ou mais dependentes — titular com incapacidade ≥ 60%","escaloes":[{"ate":1938.0,"taxa":0.0,"parcela":0.0,"parcelaDep":0.0},{"ate":2063.0,"taxa":0.2132,"parcela":413.19,"parcelaDep":42.86},{"ate":2854.0,"taxa":0.311,"parcela":614.96,"parcelaDep":42.86},{"ate":4504.0,"taxa":0.349,"parcela":723.42,"parcelaDep":42.86},{"ate":6826.0,"taxa":0.3836,"parcela":879.26,"parcelaDep":42.86},{"ate":7048.0,"taxa":0.3969,"parcela":970.05,"parcelaDep":42.86},{"ate":20468.0,"taxa":0.4495,"parcela":1340.78,"parcelaDep":42.86},{"ate":null,"taxa":0.4717,"parcela":1795.17,"parcelaDep":42.86}]},"VI":{"descricao":"Casado 2 titulares com 1 ou mais dependentes — titular com incapacidade ≥ 60%","escaloes":[{"ate":1668.0,"taxa":0.0,"parcela":0.0,"parcelaDep":0.0},{"ate":2068.0,"taxa":0.2049,"parcela":341.78,"parcelaDep":21.43},{"ate":2497.0,"taxa":0.241,"parcela":416.44,"parcelaDep":21.43},{"ate":3107.0,"taxa":0.311,"parcela":591.23,"parcelaDep":21.43},{"ate":4504.0,"taxa":0.349,"parcela":709.3,"parcelaDep":21.43},{"ate":6826.0,"taxa":0.3836,"parcela":865.14,"parcelaDep":21.43},{"ate":7048.0,"taxa":0.3969,"parcela":955.93,"parcelaDep":21.43},{"ate":20468.0,"taxa":0.4495,"parcela":1326.66,"parcelaDep":21.43},{"ate":null,"taxa":0.4717,"parcela":1781.05,"parcelaDep":21.43}]},"VII":{"descricao":"Casado único titular — titular com incapacidade ≥ 60%","escaloes":[{"ate":2325.0,"taxa":0.0,"parcela":0.0,"parcelaDep":0.0},{"ate":3494.0,"taxa":0.2277,"parcela":529.41,"parcelaDep":42.86},{"ate":3761.0,"taxa":0.257,"parcela":631.79,"parcelaDep":42.86},{"ate":6687.0,"taxa":0.2881,"parcela":748.76,"parcelaDep":42.86},{"ate":20468.0,"taxa":0.4244,"parcela":1660.2,"parcelaDep":42.86},{"ate":null,"taxa":0.4717,"parcela":2628.34,"parcelaDep":42.86}]}}},"acores":{"ano":2026,"regiao":"acores","label":"Região Autónoma dos Açores","fonte":"Despacho regional — a partir de 1 de janeiro de 2026","tabelas":{"I":{"descricao":"Não casado sem dependentes / Casado 2 titulares","escaloes":[{"ate":966.0,"taxa":0.0,"parcela":0.0,"parcelaDep":0.0},{"ate":1042.0,"taxa":0.315,"parcela":304.2903,"parcelaDep":21.43},{"ate":1108.0,"taxa":0.258265,"parcela":245.1717,"parcelaDep":21.43},{"ate":1154.0,"taxa":0.1099,"parcela":80.79,"parcelaDep":21.43},{"ate":1212.0,"taxa":0.1484,"parcela":125.22,"parcelaDep":21.43},{"ate":1819.0,"taxa":0.1687,"parcela":149.83,"parcelaDep":21.43},{"ate":2119.0,"taxa":0.2177,"parcela":238.97,"parcelaDep":21.43},{"ate":2499.0,"taxa":0.2443,"parcela":295.34,"parcelaDep":21.43},{"ate":3305.0,"taxa":0.2685,"parcela":355.82,"parcelaDep":21.43},{"ate":5547.0,"taxa":0.2779,"parcela":386.89,"parcelaDep":21.43},{"ate":20221.0,"taxa":0.3146,"parcela":590.47,"parcelaDep":21.43},{"ate":null,"taxa":0.3302,"parcela":905.92,"parcelaDep":21.43}]},"II":{"descricao":"Não casado com 1 ou mais dependentes","escaloes":[{"ate":966.0,"taxa":0.0,"parcela":0.0,"parcelaDep":0.0},{"ate":1042.0,"taxa":0.315,"parcela":304.2903,"parcelaDep":34.29},{"ate":1108.0,"taxa":0.258265,"parcela":245.1717,"parcelaDep":34.29},{"ate":1154.0,"taxa":0.1099,"parcela":80.79,"parcelaDep":34.29},{"ate":1212.0,"taxa":0.1484,"parcela":125.22,"parcelaDep":34.29},{"ate":1819.0,"taxa":0.1687,"parcela":149.83,"parcelaDep":34.29},{"ate":2119.0,"taxa":0.2177,"parcela":238.97,"parcelaDep":34.29},{"ate":2499.0,"taxa":0.2443,"parcela":295.34,"parcelaDep":34.29},{"ate":3305.0,"taxa":0.2685,"parcela":355.82,"parcelaDep":34.29},{"ate":5547.0,"taxa":0.2779,"parcela":386.89,"parcelaDep":34.29},{"ate":20221.0,"taxa":0.3146,"parcela":590.47,"parcelaDep":34.29},{"ate":null,"taxa":0.3302,"parcela":905.92,"parcelaDep":34.29}]},"III":{"descricao":"Casado único titular","escaloes":[{"ate":1226.0,"taxa":0.0,"parcela":0.0,"parcelaDep":0.0},{"ate":1267.0,"taxa":0.0728,"parcela":89.26,"parcelaDep":42.86},{"ate":1602.0,"taxa":0.0964,"parcela":119.17,"parcelaDep":42.86},{"ate":1962.0,"taxa":0.1099,"parcela":140.8,"parcelaDep":42.86},{"ate":2240.0,"taxa":0.1357,"parcela":191.42,"parcelaDep":42.86},{"ate":2900.0,"taxa":0.1594,"parcela":244.51,"parcelaDep":42.86},{"ate":3389.0,"taxa":0.1799,"parcela":303.96,"parcelaDep":42.86},{"ate":5965.0,"taxa":0.2017,"parcela":377.85,"parcelaDep":42.86},{"ate":20265.0,"taxa":0.271,"parcela":791.23,"parcelaDep":42.86},{"ate":null,"taxa":0.3302,"parcela":1990.92,"parcelaDep":42.86}]},"IV":{"descricao":"Não casado ou casado 2 titulares sem dependentes — titular com incapacidade ≥ 60%","escaloes":[{"ate":2119.0,"taxa":0.0,"parcela":0.0,"parcelaDep":0.0},{"ate":2492.0,"taxa":0.2177,"parcela":464.51,"parcelaDep":0.0},{"ate":2748.0,"taxa":0.2443,"parcela":530.8,"parcelaDep":0.0},{"ate":3012.0,"taxa":0.2685,"parcela":597.31,"parcelaDep":0.0},{"ate":4883.0,"taxa":0.2779,"parcela":625.63,"parcelaDep":0.0},{"ate":20468.0,"taxa":0.3102,"parcela":783.36,"parcelaDep":0.0},{"ate":null,"taxa":0.3255,"parcela":1096.53,"parcelaDep":0.0}]},"V":{"descricao":"Não casado com 1 ou mais dependentes — titular com incapacidade ≥ 60%","escaloes":[{"ate":2339.0,"taxa":0.0,"parcela":0.0,"parcelaDep":0.0},{"ate":2488.0,"taxa":0.2177,"parcela":511.64,"parcelaDep":42.86},{"ate":3479.0,"taxa":0.2443,"parcela":577.83,"parcelaDep":42.86},{"ate":3728.0,"taxa":0.2685,"parcela":662.03,"parcelaDep":42.86},{"ate":6687.0,"taxa":0.2779,"parcela":697.08,"parcelaDep":42.86},{"ate":20468.0,"taxa":0.3102,"parcela":913.08,"parcelaDep":42.86},{"ate":null,"taxa":0.3255,"parcela":1226.25,"parcelaDep":42.86}]},"VI":{"descricao":"Casado 2 titulares com 1 ou mais dependentes — titular com incapacidade ≥ 60%","escaloes":[{"ate":2143.0,"taxa":0.0,"parcela":0.0,"parcelaDep":0.0},{"ate":2790.0,"taxa":0.1687,"parcela":363.67,"parcelaDep":21.43},{"ate":3215.0,"taxa":0.2177,"parcela":500.38,"parcelaDep":21.43},{"ate":3479.0,"taxa":0.2443,"parcela":585.9,"parcelaDep":21.43},{"ate":5915.0,"taxa":0.2685,"parcela":670.1,"parcelaDep":21.43},{"ate":6687.0,"taxa":0.2779,"parcela":725.71,"parcelaDep":21.43},{"ate":20468.0,"taxa":0.3102,"parcela":941.71,"parcelaDep":21.43},{"ate":null,"taxa":0.3255,"parcela":1254.88,"parcelaDep":21.43}]},"VII":{"descricao":"Casado único titular — titular com incapacidade ≥ 60%","escaloes":[{"ate":2897.0,"taxa":0.0,"parcela":0.0,"parcelaDep":0.0},{"ate":4503.0,"taxa":0.1594,"parcela":461.79,"parcelaDep":42.86},{"ate":6818.0,"taxa":0.1799,"parcela":554.11,"parcelaDep":42.86},{"ate":6916.0,"taxa":0.2017,"parcela":702.75,"parcelaDep":42.86},{"ate":20468.0,"taxa":0.2926,"parcela":1331.42,"parcelaDep":42.86},{"ate":null,"taxa":0.3255,"parcela":2004.82,"parcelaDep":42.86}]}}},"madeira":{"ano":2026,"regiao":"madeira","label":"Região Autónoma da Madeira","fonte":"Despacho regional — a partir de 1 de janeiro de 2026","tabelas":{"I":{"descricao":"Não casado sem dependentes / Casado 2 titulares","escaloes":[{"ate":980.0,"taxa":0.0,"parcela":0.0,"parcelaDep":0.0},{"ate":1028.0,"taxa":0.31392,"parcela":307.6409,"parcelaDep":21.43},{"ate":1099.0,"taxa":0.28294,"parcela":275.7946,"parcelaDep":21.43},{"ate":1201.0,"taxa":0.1204,"parcela":97.17,"parcelaDep":21.43},{"ate":1623.0,"taxa":0.1763,"parcela":164.31,"parcelaDep":21.43},{"ate":2332.0,"taxa":0.223,"parcela":240.11,"parcelaDep":21.43},{"ate":3203.0,"taxa":0.2242,"parcela":242.91,"parcelaDep":21.43},{"ate":3614.0,"taxa":0.2727,"parcela":398.26,"parcelaDep":21.43},{"ate":6585.0,"taxa":0.2778,"parcela":416.7,"parcelaDep":21.43},{"ate":6954.0,"taxa":0.2802,"parcela":432.51,"parcelaDep":21.43},{"ate":21411.0,"taxa":0.2924,"parcela":517.35,"parcelaDep":21.43},{"ate":null,"taxa":0.3278,"parcela":1275.3,"parcelaDep":21.43}]},"II":{"descricao":"Não casado com 1 ou mais dependentes","escaloes":[{"ate":980.0,"taxa":0.0,"parcela":0.0,"parcelaDep":0.0},{"ate":1028.0,"taxa":0.31392,"parcela":307.6409,"parcelaDep":34.29},{"ate":1099.0,"taxa":0.28294,"parcela":275.7946,"parcelaDep":34.29},{"ate":1201.0,"taxa":0.1204,"parcela":97.17,"parcelaDep":34.29},{"ate":1623.0,"taxa":0.1763,"parcela":164.31,"parcelaDep":34.29},{"ate":2332.0,"taxa":0.223,"parcela":240.11,"parcelaDep":34.29},{"ate":3203.0,"taxa":0.2242,"parcela":242.91,"parcelaDep":34.29},{"ate":3614.0,"taxa":0.2727,"parcela":398.26,"parcelaDep":34.29},{"ate":6585.0,"taxa":0.2778,"parcela":416.7,"parcelaDep":34.29},{"ate":6954.0,"taxa":0.2802,"parcela":432.51,"parcelaDep":34.29},{"ate":21411.0,"taxa":0.2924,"parcela":517.35,"parcelaDep":34.29},{"ate":null,"taxa":0.3278,"parcela":1275.3,"parcelaDep":34.29}]},"III":{"descricao":"Casado único titular","escaloes":[{"ate":997.0,"taxa":0.0,"parcela":0.0,"parcelaDep":0.0},{"ate":1099.0,"taxa":0.20492,"parcela":214.208,"parcelaDep":42.86},{"ate":1141.0,"taxa":0.0872,"parcela":84.84,"parcelaDep":42.86},{"ate":1857.0,"taxa":0.1033,"parcela":103.22,"parcelaDep":42.86},{"ate":2485.0,"taxa":0.1091,"parcela":114.0,"parcelaDep":42.86},{"ate":3331.0,"taxa":0.1236,"parcela":150.04,"parcelaDep":42.86},{"ate":3895.0,"taxa":0.1404,"parcela":206.01,"parcelaDep":42.86},{"ate":6673.0,"taxa":0.1595,"parcela":280.41,"parcelaDep":42.86},{"ate":6878.0,"taxa":0.2213,"parcela":692.81,"parcelaDep":42.86},{"ate":21411.0,"taxa":0.2493,"parcela":885.4,"parcelaDep":42.86},{"ate":null,"taxa":0.3278,"parcela":2566.17,"parcelaDep":42.86}]},"IV":{"descricao":"Não casado ou casado 2 titulares sem dependentes — titular com incapacidade ≥ 60%","escaloes":[{"ate":2053.0,"taxa":0.0,"parcela":0.0,"parcelaDep":0.0},{"ate":2591.0,"taxa":0.149,"parcela":305.9,"parcelaDep":0.0},{"ate":3622.0,"taxa":0.1863,"parcela":402.55,"parcelaDep":0.0},{"ate":4668.0,"taxa":0.2289,"parcela":556.85,"parcelaDep":0.0},{"ate":7066.0,"taxa":0.2616,"parcela":709.5,"parcelaDep":0.0},{"ate":7168.0,"taxa":0.2752,"parcela":805.6,"parcelaDep":0.0},{"ate":21625.0,"taxa":0.3058,"parcela":1024.95,"parcelaDep":0.0},{"ate":null,"taxa":0.3278,"parcela":1500.7,"parcelaDep":0.0}]},"V":{"descricao":"Não casado com 1 ou mais dependentes — titular com incapacidade ≥ 60%","escaloes":[{"ate":2345.0,"taxa":0.0,"parcela":0.0,"parcelaDep":0.0},{"ate":2591.0,"taxa":0.1382,"parcela":324.08,"parcelaDep":42.86},{"ate":3622.0,"taxa":0.1863,"parcela":448.71,"parcelaDep":42.86},{"ate":4668.0,"taxa":0.2289,"parcela":603.01,"parcelaDep":42.86},{"ate":7066.0,"taxa":0.2616,"parcela":755.66,"parcelaDep":42.86},{"ate":7168.0,"taxa":0.2752,"parcela":851.76,"parcelaDep":42.86},{"ate":21625.0,"taxa":0.3058,"parcela":1071.11,"parcelaDep":42.86},{"ate":null,"taxa":0.3278,"parcela":1546.86,"parcelaDep":42.86}]},"VI":{"descricao":"Casado 2 titulares com 1 ou mais dependentes — titular com incapacidade ≥ 60%","escaloes":[{"ate":2019.0,"taxa":0.0,"parcela":0.0,"parcelaDep":0.0},{"ate":2528.0,"taxa":0.1566,"parcela":316.18,"parcelaDep":21.43},{"ate":3049.0,"taxa":0.1768,"parcela":367.25,"parcelaDep":21.43},{"ate":4272.0,"taxa":0.1781,"parcela":371.22,"parcelaDep":21.43},{"ate":5734.0,"taxa":0.228,"parcela":584.4,"parcelaDep":21.43},{"ate":7066.0,"taxa":0.2595,"parcela":765.03,"parcelaDep":21.43},{"ate":7550.0,"taxa":0.2752,"parcela":875.97,"parcelaDep":21.43},{"ate":21625.0,"taxa":0.3058,"parcela":1107.0,"parcelaDep":21.43},{"ate":null,"taxa":0.3278,"parcela":1582.75,"parcelaDep":21.43}]},"VII":{"descricao":"Casado único titular — titular com incapacidade ≥ 60%","escaloes":[{"ate":3061.0,"taxa":0.0,"parcela":0.0,"parcelaDep":0.0},{"ate":4668.0,"taxa":0.0883,"parcela":270.29,"parcelaDep":42.86},{"ate":7066.0,"taxa":0.1334,"parcela":480.82,"parcelaDep":42.86},{"ate":7168.0,"taxa":0.2503,"parcela":1306.84,"parcelaDep":42.86},{"ate":21625.0,"taxa":0.281,"parcela":1526.9,"parcelaDep":42.86},{"ate":null,"taxa":0.3278,"parcela":2538.95,"parcelaDep":42.86}]}}}},
};

/* ───────────────────────────────────────────────────────────────
   3. ESTADO GLOBAL E CARREGAMENTO DE TABELAS

   Estratégia: dados embutidos têm prioridade (funcionam com
   file://); fetch é usado apenas para anos não embutidos (requer
   servidor HTTP).
   ─────────────────────────────────────────────────────────────── */

let _anoAtivo      = null;
let _tabelasAtivas = null;   // { continente, acores, madeira }

/**
 * Devolve o manifest (sempre a partir dos dados embutidos).
 * @returns {Promise<{ anos: number[], anoAtivo: number }>}
 */
async function carregarManifest() {
  return MANIFEST_EMBED;
}

/**
 * Carrega tabelas para um ano.
 * — Se o ano estiver embutido em TABELAS_EMBED, usa-o directamente.
 * — Caso contrário tenta fetch (requer servidor HTTP).
 *
 * Para adicionar um novo ano sem servidor:
 *   Gerar os JSON com o script Python e copiar o objecto para
 *   TABELAS_EMBED[<ano>] acima. Adicionar o ano a MANIFEST_EMBED.
 *
 * @param {number} ano
 * @returns {Promise<{ continente, acores, madeira }>}
 */
async function carregarTabelasAno(ano) {
  if (_anoAtivo === ano && _tabelasAtivas) return _tabelasAtivas;

  if (TABELAS_EMBED[ano]) {
    _anoAtivo      = ano;
    _tabelasAtivas = TABELAS_EMBED[ano];
    return _tabelasAtivas;
  }

  // Fallback: fetch (requer servidor HTTP)
  const carregar = async (regiao) => {
    const url = `tabelas/${ano}/${regiao}.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Tabela não encontrada: ${url}`);
    return res.json();
  };
  const [continente, acores, madeira] = await Promise.all([
    carregar('continente'), carregar('acores'), carregar('madeira'),
  ]);
  _anoAtivo      = ano;
  _tabelasAtivas = { continente, acores, madeira };
  return _tabelasAtivas;
}

/* ───────────────────────────────────────────────────────────────
   4. SELEÇÃO DA TABELA DE RETENÇÃO (letras I a VII)

   As tabelas AT para trabalho dependente (Categoria A) dividem-se
   em 7 variantes por situação familiar e incapacidade do titular:

   Tabela I   — Não casado sem dep. / Casado 2 titulares (qualquer nº dep.)
   Tabela II  — Não casado com 1 ou mais dependentes
   Tabela III — Casado único titular (qualquer nº dep.)
   Tabela IV  — Não casado ou casado 2 titulares, sem dep., incapaz ≥ 60 %
   Tabela V   — Não casado, 1+ dep., titular incapaz ≥ 60 %
   Tabela VI  — Casado 2 titulares, 1+ dep., titular incapaz ≥ 60 %
   Tabela VII — Casado único titular, incapaz ≥ 60 %

   Nota: "casado 2 titulares" usa sempre a Tabela I (sem incap.) porque
   cada cônjuge é tributado sobre o seu próprio rendimento.
   ─────────────────────────────────────────────────────────────── */

/**
 * @param {'solteiro'|'casado1'|'casado2'} situacao
 * @param {boolean} incapacidadeTitular
 * @param {number}  numDependentes
 * @returns {'I'|'II'|'III'|'IV'|'V'|'VI'|'VII'}
 */
function selecionarLetraTabela(situacao, incapacidadeTitular, numDependentes) {
  if (!incapacidadeTitular) {
    if (situacao === 'casado1') return 'III';
    if (situacao === 'casado2') return 'I';
    // solteiro
    return numDependentes > 0 ? 'II' : 'I';
  }

  // Titular com incapacidade ≥ 60 %
  if (situacao === 'casado1') return 'VII';
  if (situacao === 'casado2') return numDependentes > 0 ? 'VI' : 'IV';
  // solteiro
  return numDependentes > 0 ? 'V' : 'IV';
}

/* ───────────────────────────────────────────────────────────────
   5. CÁLCULO DA RETENÇÃO DE IRS

   Fórmula oficial AT (Categoria A):
     Retenção = R × taxa − parcela − parcelaDep × nDepEfetivos

   Os campos "taxa" e "parcela" nos JSON já estão normalizados:
   as linhas com fórmula variável do Excel ( taxa × coef × (K−R) )
   foram convertidas pela extração Python para a forma linear
   equivalente  R × taxaN − parcelaN  (ver tabelas/parsear.py).

   Dependentes com deficiência ≥ 60 %:
     Equivalem ao dobro para efeitos da parcela adicional
     (art. 86.º-A CIRS e notas de rodapé das tabelas AT).
   ─────────────────────────────────────────────────────────────── */

/**
 * Calcula a retenção mensal de IRS sobre um salário.
 *
 * @param {number}  salarioMensal
 * @param {object}  tabelaRegiao      — JSON da região (continente/acores/madeira)
 * @param {string}  letraTabela       — 'I' … 'VII'
 * @param {number}  numDependentes
 * @param {boolean} dependentesComDef — dep. com deficiência contam em dobro
 * @returns {number}  retenção mensal (≥ 0)
 */
function calcularRetencaoIRS(salarioMensal, tabelaRegiao, letraTabela, numDependentes, dependentesComDef) {
  const bloco = tabelaRegiao.tabelas[letraTabela];
  if (!bloco) throw new Error(`Tabela ${letraTabela} ausente na região ${tabelaRegiao.regiao}`);

  // Escalão: primeiro cujo limite superior ≥ salário (ou sem limite = último)
  const escalao = bloco.escaloes.find(e => e.ate === null || salarioMensal <= e.ate);
  if (!escalao || escalao.taxa === 0) return 0;

  // Cada dep. com deficiência equivale a 2 para a parcela adicional
  const nDepEfetivos = dependentesComDef ? numDependentes * 2 : numDependentes;

  const retencao = salarioMensal * escalao.taxa
                 - escalao.parcela
                 - escalao.parcelaDep * nDepEfetivos;

  return Math.max(0, retencao);
}

/* ───────────────────────────────────────────────────────────────
   6. SEGURANÇA SOCIAL DO TRABALHADOR
   ─────────────────────────────────────────────────────────────── */

/** @param {number} base — valor sobre o qual incide a contribuição */
function calcularSSTrabalhador(base) {
  return base * TAXAS.ssTrabalhador;
}

/* ───────────────────────────────────────────────────────────────
   7. SUBSÍDIO DE ALIMENTAÇÃO

   Regime de isenção (Portaria n.º 107-A/2023 e atualizações):
   • Até ao limite diário: isento de IRS e SS
   • Parte que excede o limite: sujeita a IRS (retenção) e SS

   Cálculo anual: valorDiario × 21 dias × 11 meses
   ─────────────────────────────────────────────────────────────── */

/**
 * @param {number}  valorDiario
 * @param {boolean} cartaoRefeicao        — true → limite €9,60; false → €6,00
 * @param {number}  [limiteCustomNormal]  — sobrepõe SA_LIMITES.normal se fornecido
 * @param {number}  [limiteCustomCartao]  — sobrepõe SA_LIMITES.cartao se fornecido
 * @returns {{
 *   valorDiario, limite,
 *   totalMensal, totalAnual,
 *   isentoMensal, isentoAnual,
 *   sujeitoMensal, sujeitoAnual
 * }}
 */
function calcularSubsidioAlimentacao(valorDiario, cartaoRefeicao, limiteCustomNormal, limiteCustomCartao) {
  const limite = cartaoRefeicao
    ? (limiteCustomCartao  ?? SA_LIMITES.cartao)
    : (limiteCustomNormal  ?? SA_LIMITES.normal);

  const diarioIsento  = Math.min(valorDiario, limite);
  const diarioSujeito = Math.max(0, valorDiario - limite);

  const isentoMensal  = diarioIsento  * SA_DIAS_MES;
  const sujeitoMensal = diarioSujeito * SA_DIAS_MES;

  return {
    valorDiario,
    limite,
    totalMensal:   isentoMensal + sujeitoMensal,
    totalAnual:   (isentoMensal + sujeitoMensal) * SA_MESES,
    isentoMensal,
    isentoAnual:   isentoMensal  * SA_MESES,
    sujeitoMensal,
    sujeitoAnual:  sujeitoMensal * SA_MESES,
  };
}

/* ───────────────────────────────────────────────────────────────
   8. AJUDAS DE CUSTO

   Totalmente isentas de IRS e SS (art. 2.º-A e art. 24.º CIRS).
   Incluídas no custo da empresa sem quaisquer encargos sociais.
   ─────────────────────────────────────────────────────────────── */

/**
 * @param {number} valorMensal
 * @returns {{ mensal: number, anual: number }}
 */
function calcularAjudasCusto(valorMensal) {
  return { mensal: valorMensal, anual: valorMensal * 12 };
}

/* ───────────────────────────────────────────────────────────────
   9. ORQUESTRADOR — calcularSimulacao()

   Recebe todos os inputs do formulário e devolve um único objeto
   com todas as grandezas necessárias para o relatório.
   ─────────────────────────────────────────────────────────────── */

/**
 * @typedef {object} InputsSimulacao
 * @property {'continente'|'acores'|'madeira'} localizacao
 * @property {'solteiro'|'casado1'|'casado2'}  situacaoFamiliar
 * @property {number}  numDependentes
 * @property {boolean} incapacidadeTitular
 * @property {boolean} dependentesDeficiencia
 * @property {number}  salarioMensal
 * @property {number}  saDiario
 * @property {boolean} saCartaoRefeicao
 * @property {number}  [saLimiteCustomNormal]
 * @property {number}  [saLimiteCustomCartao]
 * @property {boolean} temAjudasCusto
 * @property {number}  [acMensal]
 * @property {boolean} temSeguroSaude
 * @property {number}  [seguroSaudeMensal]
 * @property {number}  [taxaSeguroAT]
 */

/**
 * Calcula a simulação completa.
 *
 * Convenções de grandezas anuais:
 *   • Salário:  × 14 meses (12 + sub. férias + sub. natal)
 *   • SA:       × 11 meses (exclui mês de férias)
 *   • AC:       × 12 meses
 *   • Retenção IRS sobre salário: × 14 (aplica-se em cada pagamento)
 *   • SS sobre salário: × 14
 *   • Retenção e SS sobre SA sujeito: × 11
 *
 * @param {InputsSimulacao} inp
 * @param {{ continente, acores, madeira }} tabelasAno
 * @returns {object}
 */
function calcularSimulacao(inp, tabelasAno) {
  const tabRegiao = tabelasAno[inp.localizacao];
  if (!tabRegiao) throw new Error(`Região desconhecida: ${inp.localizacao}`);

  /* ── 1. Selecionar tabela ─────────────────────────────────── */
  const letraTabela = selecionarLetraTabela(
    inp.situacaoFamiliar,
    inp.incapacidadeTitular,
    inp.numDependentes,
  );

  /* ── 2. Salário base ──────────────────────────────────────── */
  const salMensal = inp.salarioMensal;
  const salAnual  = salMensal * MESES_SAL;

  // Retenção mensal sobre o salário
  const retSalMensal = calcularRetencaoIRS(
    salMensal, tabRegiao, letraTabela,
    inp.numDependentes, inp.dependentesDeficiencia,
  );
  const retSalAnual = retSalMensal * MESES_SAL;

  // SS trabalhador sobre salário
  const ssTrabSalMensal = calcularSSTrabalhador(salMensal);
  const ssTrabSalAnual  = ssTrabSalMensal * MESES_SAL;

  /* ── 3. Subsídio de Alimentação ───────────────────────────── */
  const sa = calcularSubsidioAlimentacao(
    inp.saDiario,
    inp.saCartaoRefeicao,
    inp.saLimiteCustomNormal,
    inp.saLimiteCustomCartao,
  );

  // Retenção IRS sobre SA sujeito: aplica a taxa efetiva do salário base
  // (simplificação válida quando SA sujeito não altera escalão de forma relevante)
  const taxaEfetiva      = salMensal > 0 ? retSalMensal / salMensal : 0;
  const retSAMensal      = sa.sujeitoMensal * taxaEfetiva;
  const retSAAnual       = retSAMensal * SA_MESES;

  // SS trabalhador sobre SA sujeito
  const ssTrabSAMensal   = calcularSSTrabalhador(sa.sujeitoMensal);
  const ssTrabSAAnual    = ssTrabSAMensal * SA_MESES;

  /* ── 4. Ajudas de Custo ───────────────────────────────────── */
  const ac = inp.temAjudasCusto
    ? calcularAjudasCusto(inp.acMensal ?? 0)
    : { mensal: 0, anual: 0 };

  /* ── 5. Totais anuais — perspetiva trabalhador ────────────── */
  const totalBrutoAnual = salAnual + sa.totalAnual + ac.anual;
  const totalRetAnual   = retSalAnual + retSAAnual;
  const totalSSAnual    = ssTrabSalAnual + ssTrabSAAnual;
  const liquidoAnual    = totalBrutoAnual - totalRetAnual - totalSSAnual;

  // Versões mensais — mês típico (não média anual ÷ 12)
  const totalBrutoMensal = salMensal + sa.totalMensal + ac.mensal;
  const totalRetMensal   = retSalMensal    + retSAMensal;
  const totalSSMensal    = ssTrabSalMensal + ssTrabSAMensal;
  const liquidoMensal    = totalBrutoMensal - totalRetMensal - totalSSMensal;

  /* ── 6. Perspetiva da empresa ─────────────────────────────── */
  const taxaAT = inp.taxaSeguroAT ?? carregarTaxaSeguroAT();

  // TSU patronal sobre salário
  const ssPatronalSalAnual = salAnual * TAXAS.ssPatronal;

  // TSU patronal sobre SA não isento
  const ssPatronalSAAnual  = sa.sujeitoAnual * TAXAS.ssPatronal;

  // Seguro de saúde (custo direto, sem encargos adicionais)
  const seguroSaudeAnual   = inp.temSeguroSaude
    ? (inp.seguroSaudeMensal ?? 0)
    : 0;

  // Seguro de acidentes de trabalho (calculado sobre salário anual)
  const seguroATAnual      = salAnual * taxaAT;

  const custoEmpresaAnual  = salAnual
    + ssPatronalSalAnual
    + sa.totalAnual
    + ssPatronalSAAnual
    + ac.anual
    + seguroSaudeAnual
    + seguroATAnual;

  const custoEmpresaMensal = custoEmpresaAnual / 12;

  const remuneracoesTotaisAnual = salAnual + sa.totalAnual + ac.anual;
  const ssEmpresaAnual          = ssPatronalSalAnual + ssPatronalSAAnual;
  const subtotalCustoAnual      = remuneracoesTotaisAnual + ssEmpresaAnual;

  /* ── 7. Rácios ────────────────────────────────────────────── */
  // Líquido / Bruto: percentagem do salário mensal recebida a líquido
  const ratioLiquidoBruto = salMensal > 0
    ? (salMensal - retSalMensal - ssTrabSalMensal) / salMensal
    : 0;

  // Custo empresa / Líquido: quantos euros a empresa gasta por cada euro líquido
  const ratioCustoLiquido = liquidoAnual > 0
    ? custoEmpresaAnual / liquidoAnual
    : 0;

  /* ── Resultado estruturado ────────────────────────────────── */
  return {
    /* Metadados */
    ano:        _anoAtivo,
    letraTabela,
    descTabela: tabRegiao.tabelas[letraTabela]?.descricao ?? '',
    fonte:      tabRegiao.fonte,
    regiao:     tabRegiao.label,

    /* Trabalhador — mensal (médias) */
    t: {
      salarioMensal:       salMensal,
      saTotalMensal:       sa.totalMensal,
      saIsentoMensal:      sa.isentoMensal,
      saSujeitoMensal:     sa.sujeitoMensal,
      acMensal:            ac.mensal,
      totalBrutoMensal,
      retencaoIRSMensal:   totalRetMensal,
      ssTrabalhadorMensal: totalSSMensal,
      liquidoMensal,

      /* Anual */
      salarioAnual:        salAnual,
      saTotalAnual:        sa.totalAnual,
      saIsentoAnual:       sa.isentoAnual,
      saSujeitoAnual:      sa.sujeitoAnual,
      acAnual:             ac.anual,
      totalBrutoAnual,
      totalBrutoMediaMensal: totalBrutoAnual / 12,
      retencaoIRSAnual:    totalRetAnual,
      ssTrabalhadorAnual:  totalSSAnual,
      liquidoAnual,
      liquidoMediaMensal:  liquidoAnual / 12,
    },

    /* Empresa — anual e mensal médio */
    e: {
      salarioAnual:              salAnual,
      salarioMensal:             salAnual                 / 12,
      saTotalAnual:              sa.totalAnual,
      saTotalMensal:             sa.totalAnual            / 12,
      acAnual:                   ac.anual,
      acMensal:                  ac.anual                 / 12,
      remuneracoesTotaisAnual,
      remuneracoesTotaisMensal:  remuneracoesTotaisAnual  / 12,
      ssEmpresaAnual,
      ssEmpresaMensal:           ssEmpresaAnual           / 12,
      subtotalCustoAnual,
      subtotalCustoMensal:       subtotalCustoAnual       / 12,
      seguroSaudeAnual,
      seguroSaudeMensal:         seguroSaudeAnual         / 12,
      seguroATAnual,
      seguroATMensal:            seguroATAnual            / 12,
      custoEmpresaAnual,
      custoEmpresaMensal,
    },

    /* Rácios */
    ratioLiquidoBruto,
    ratioCustoLiquido,

    /* SA detalhado (para notas de rodapé) */
    saLimite:       sa.limite,
    saCartao:       inp.saCartaoRefeicao,
  };
}

/* ───────────────────────────────────────────────────────────────
   10. PERSISTÊNCIA — localStorage
   ─────────────────────────────────────────────────────────────── */

const LS = {
  ultimaSimulacao: 'sim_ultima_simulacao',
  taxaSeguroAT:    'sim_taxa_seguro_at',
};

function guardarSimulacao(inputs) {
  try { localStorage.setItem(LS.ultimaSimulacao, JSON.stringify(inputs)); } catch (_) {}
}

function carregarUltimaSimulacao() {
  try { return JSON.parse(localStorage.getItem(LS.ultimaSimulacao)); } catch (_) { return null; }
}

function guardarTaxaSeguroAT(taxa) {
  try { localStorage.setItem(LS.taxaSeguroAT, String(taxa)); } catch (_) {}
}

function carregarTaxaSeguroAT() {
  const v = parseFloat(localStorage.getItem(LS.taxaSeguroAT));
  return isNaN(v) ? TAXAS.seguroAT : v;
}

/* ───────────────────────────────────────────────────────────────
   11. CAMADA DOM — ligação ao HTML
   ─────────────────────────────────────────────────────────────── */

/* ── Formatação ─────────────────────────────────────────────── */

const fmt = v =>
  Number(v).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });

const pct = v =>
  (v * 100).toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %';

function cel(id, valor) {
  const el = document.getElementById(id);
  if (el) el.textContent = fmt(valor);
}

/* ── Ler inputs do formulário ───────────────────────────────── */

function lerInputs() {
  const cartao    = document.getElementById('sa-cartao').checked;
  const limiteUI  = parseFloat(document.getElementById('sa-limite').value)
                  || (cartao ? SA_LIMITES.cartao : SA_LIMITES.normal);
  const taxaATpct = parseFloat(document.getElementById('taxa-seguro-at').value);

  return {
    localizacao:             document.getElementById('localizacao').value,
    situacaoFamiliar:        document.getElementById('situacao-familiar').value,
    numDependentes:          Math.max(0, parseInt(document.getElementById('num-dependentes').value, 10) || 0),
    incapacidadeTitular:     document.getElementById('incapacidade-titular').checked,
    dependentesDeficiencia:  document.getElementById('dependentes-deficiencia').checked,
    salarioMensal:           parseFloat(document.getElementById('salario-mensal').value) || 0,
    saDiario:                parseFloat(document.getElementById('sa-diario').value) || 0,
    saCartaoRefeicao:        cartao,
    saLimiteCustomNormal:    cartao ? undefined : limiteUI,
    saLimiteCustomCartao:    cartao ? limiteUI  : undefined,
    temAjudasCusto:          document.getElementById('tem-ac').checked,
    acMensal:                parseFloat(document.getElementById('ac-mensal').value) || 0,
    temSeguroSaude:          document.getElementById('tem-seguro-saude').checked,
    seguroSaudeMensal:       parseFloat(document.getElementById('seguro-saude-mensal').value) || 0,
    taxaSeguroAT:            (isNaN(taxaATpct) ? 1.85 : taxaATpct) / 100,
  };
}

/* ── Preencher formulário a partir de inputs guardados ───────── */

function preencherFormulario(inp) {
  if (!inp) return;
  const set = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.value = v; };
  const chk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };

  set('localizacao',          inp.localizacao);
  set('situacao-familiar',    inp.situacaoFamiliar);
  set('num-dependentes',      inp.numDependentes ?? 0);
  chk('incapacidade-titular', inp.incapacidadeTitular);
  chk('dependentes-deficiencia', inp.dependentesDeficiencia);
  set('salario-mensal',       inp.salarioMensal);
  set('sa-diario',            inp.saDiario ?? 6);
  chk('sa-cartao',            inp.saCartaoRefeicao);

  const limiteCustom = inp.saCartaoRefeicao ? inp.saLimiteCustomCartao : inp.saLimiteCustomNormal;
  set('sa-limite', limiteCustom ?? (inp.saCartaoRefeicao ? SA_LIMITES.cartao : SA_LIMITES.normal));

  chk('tem-ac',               inp.temAjudasCusto);
  set('ac-mensal',            inp.acMensal ?? 0);
  chk('tem-seguro-saude',     inp.temSeguroSaude);
  set('seguro-saude-mensal',  inp.seguroSaudeMensal ?? 0);
  if (inp.taxaSeguroAT !== undefined) {
    set('taxa-seguro-at', (inp.taxaSeguroAT * 100).toFixed(2));
  }

  atualizarPainelAC();
  atualizarPainelSeguroSaude();
  atualizarLimiteSA();
}

/* ── Painel condicional AC ──────────────────────────────────── */

function atualizarPainelAC() {
  document.getElementById('painel-ac').hidden = !document.getElementById('tem-ac').checked;
}

/* ── Painel condicional Seguro Saúde ────────────────────────── */

function atualizarPainelSeguroSaude() {
  document.getElementById('painel-seguro-saude').hidden =
    !document.getElementById('tem-seguro-saude').checked;
}

/* ── Atualizar limite SA e label quando muda o toggle cartão ── */

function atualizarLimiteSA() {
  const cartao     = document.getElementById('sa-cartao').checked;
  const limiteEl   = document.getElementById('sa-limite');
  const ajudaEl    = document.getElementById('sa-limite-ajuda');
  const defaultNov = SA_LIMITES.normal;
  const defaultCart= SA_LIMITES.cartao;

  // Atualiza o valor apenas se ainda estiver no default oposto
  const atual = parseFloat(limiteEl.value);
  if (cartao && Math.abs(atual - defaultNov) < 0.005) limiteEl.value = defaultCart.toFixed(2);
  if (!cartao && Math.abs(atual - defaultCart) < 0.005) limiteEl.value = defaultNov.toFixed(2);

  ajudaEl.textContent = cartao
    ? `Cartão refeição — limite padrão ${fmt(defaultCart)}/dia`
    : `Numerário — limite padrão ${fmt(defaultNov)}/dia`;
}

/* ── Validar passo 1 e atualizar estado de passo 2 / botão ─── */

function validarPasso1() {
  const loc = document.getElementById('localizacao').value;
  const sit = document.getElementById('situacao-familiar').value;
  const dep = document.getElementById('num-dependentes').value;
  return !!(loc && sit && dep !== '' && parseInt(dep, 10) >= 0);
}

function atualizarEstadoFormulario() {
  const valido = validarPasso1();
  document.getElementById('secao-rubricas').classList.toggle('secao-desativada', !valido);
  document.getElementById('btn-calcular').disabled = !valido;

  if (valido) atualizarBadgeTabela();
  document.getElementById('info-tabela').hidden = !valido;
}

/* ── Badge com a tabela AT em uso ───────────────────────────── */

function atualizarBadgeTabela() {
  const situacao = document.getElementById('situacao-familiar').value;
  if (!situacao) return;

  const incap  = document.getElementById('incapacidade-titular').checked;
  const ndep   = parseInt(document.getElementById('num-dependentes').value, 10) || 0;
  const letra  = selecionarLetraTabela(situacao, incap, ndep);

  document.getElementById('tag-tabela-ativa').textContent = `Tabela ${letra}`;
  document.getElementById('tag-tabela-ativa').hidden = false;
  document.getElementById('tabela-letra').textContent = `Tabela ${letra}`;

  const loc = document.getElementById('localizacao').value || 'continente';
  const desc = _tabelasAtivas?.[loc]?.tabelas?.[letra]?.descricao ?? '';
  document.getElementById('tabela-desc').textContent = desc ? `— ${desc}` : '';
}

/* ── Renderizar o relatório ─────────────────────────────────── */

function renderRelatorio(res) {
  /* KPIs */
  document.getElementById('kpi-bruto-anual').textContent  = fmt(res.t.totalBrutoAnual)    + ' /ano';
  document.getElementById('kpi-bruto-mensal').textContent = fmt(res.t.totalBrutoMensal)   + ' /mês';
  document.getElementById('kpi-custo-anual').textContent  = fmt(res.e.custoEmpresaAnual)  + ' /ano';
  document.getElementById('kpi-custo-mensal').textContent = fmt(res.e.custoEmpresaMensal) + ' /mês';
  document.getElementById('kpi-ratio-lb').textContent     = pct(res.ratioLiquidoBruto);
  document.getElementById('kpi-ratio-cl').textContent     =
    res.ratioCustoLiquido.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '×';
  document.getElementById('kpi-liq-anual').textContent    = fmt(res.t.liquidoAnual)       + ' /ano';
  document.getElementById('kpi-liq-mensal').textContent   = fmt(res.t.liquidoMediaMensal) + ' /mês';

  /* Tabela trabalhador */
  cel('t-sal-mensal',       res.t.salarioMensal);
  cel('t-sal-anual',        res.t.salarioAnual);
  cel('t-sa-total-mensal',  res.t.saTotalMensal);
  cel('t-sa-total-anual',   res.t.saTotalAnual);
  cel('t-sa-isento-mensal', res.t.saIsentoMensal);
  cel('t-sa-isento-anual',  res.t.saIsentoAnual);
  cel('t-sa-sujeito-mensal',res.t.saSujeitoMensal);
  cel('t-sa-sujeito-anual', res.t.saSujeitoAnual);
  cel('t-ac-mensal',        res.t.acMensal);
  cel('t-ac-anual',         res.t.acAnual);
  cel('t-bruto-mensal',     res.t.totalBrutoMensal);
  cel('t-bruto-anual',      res.t.totalBrutoAnual);
  cel('t-ret-mensal',       res.t.retencaoIRSMensal);
  cel('t-ret-anual',        res.t.retencaoIRSAnual);
  cel('t-ss-mensal',        res.t.ssTrabalhadorMensal);
  cel('t-ss-anual',         res.t.ssTrabalhadorAnual);
  cel('t-liq-mensal',           res.t.liquidoMensal);
  cel('t-liq-anual',            res.t.liquidoAnual);
  cel('t-bruto-media-mensal',   res.t.totalBrutoMediaMensal);
  cel('t-liq-media-mensal',     res.t.liquidoMediaMensal);

  document.getElementById('linha-ac-trab').hidden = res.t.acMensal === 0;

  /* Tabela empresa */
  cel('e-rem-mensal',        res.e.remuneracoesTotaisMensal);
  cel('e-rem-anual',         res.e.remuneracoesTotaisAnual);
  cel('e-sal-mensal',        res.e.salarioMensal);
  cel('e-sal-anual',         res.e.salarioAnual);
  cel('e-sa-mensal',         res.e.saTotalMensal);
  cel('e-sa-anual',          res.e.saTotalAnual);
  cel('e-ac-mensal',         res.e.acMensal);
  cel('e-ac-anual',          res.e.acAnual);
  cel('e-ss-emp-mensal',     res.e.ssEmpresaMensal);
  cel('e-ss-emp-anual',      res.e.ssEmpresaAnual);
  cel('e-subtotal-mensal',   res.e.subtotalCustoMensal);
  cel('e-subtotal-anual',    res.e.subtotalCustoAnual);
  cel('e-seg-saude-mensal',  res.e.seguroSaudeMensal);
  cel('e-seg-saude-anual',   res.e.seguroSaudeAnual);
  cel('e-seg-at-mensal',     res.e.seguroATMensal);
  cel('e-seg-at-anual',      res.e.seguroATAnual);
  cel('e-custo-mensal',      res.e.custoEmpresaMensal);
  cel('e-custo-anual',       res.e.custoEmpresaAnual);

  document.getElementById('linha-ac-emp').hidden     = res.e.acAnual === 0;
  document.getElementById('linha-seg-saude').hidden  = res.e.seguroSaudeAnual === 0;

  /* Label dinâmico com taxa real do seguro AT */
  const taxaATpct = res.e.salarioAnual > 0
    ? ((res.e.seguroATAnual / res.e.salarioAnual) * 100)
        .toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '1,85';
  document.getElementById('e-seg-at-label').textContent =
    `(+) Seguro Acid. Trabalho (${taxaATpct}%)`;

  /* Nota de rodapé do relatório */
  const modoSA = res.saCartao ? 'cartão refeição' : 'numerário';
  document.getElementById('relatorio-nota').innerHTML =
    `<strong>Tabela AT em uso:</strong> ${res.ano} · Tabela ${res.letraTabela} — ${res.descTabela}<br>`
    + `<strong>Região:</strong> ${res.regiao}<br>`
    + `<strong>Subsídio de Alimentação:</strong> limite de isenção ${fmt(res.saLimite)}/dia (${modoSA}) · 21 dias × 11 meses<br>`
    + `<strong>Nota metodológica:</strong> Os valores mensais são médias (anual ÷ 12). `
    + `A retenção IRS e a SS sobre salário incidem nos 14 meses; `
    + `sobre a parte sujeita do SA incidem nos 11 meses.`;

  /* Rodapé da página */
  document.getElementById('rodape-tabelas').textContent =
    `Tabelas de retenção na fonte: ano ${res.ano} · Tabela ${res.letraTabela} · ${res.regiao}`;
}

/* ── Limpar formulário ──────────────────────────────────────── */

function limparFormulario() {
  document.getElementById('form-simulador').reset();

  /* Repor defaults que o reset não cobre */
  document.getElementById('sa-diario').value        = SA_LIMITES.normal.toFixed(2);
  document.getElementById('sa-limite').value        = SA_LIMITES.normal.toFixed(2);
  document.getElementById('sa-limite-ajuda').textContent = 'Numerário — limite padrão 6,00 €/dia';
  document.getElementById('taxa-seguro-at').value   = (carregarTaxaSeguroAT() * 100).toFixed(2);

  /* Esconder painéis condicionais */
  document.getElementById('painel-ac').hidden           = true;
  document.getElementById('painel-seguro-saude').hidden = true;

  /* Repor estado do formulário */
  document.getElementById('secao-rubricas').classList.add('secao-desativada');
  document.getElementById('btn-calcular').disabled = true;
  document.getElementById('info-tabela').hidden    = true;
  document.getElementById('tag-tabela-ativa').hidden = true;

  /* Esconder relatório */
  document.getElementById('secao-relatorio').hidden = true;

  /* Repor rodapé */
  document.getElementById('rodape-tabelas').textContent =
    `Tabelas de retenção na fonte: ano ${_anoAtivo ?? '—'}`;
}

/* ── Inicialização ──────────────────────────────────────────── */

async function init() {
  /* Carregar manifest e tabelas do ano ativo */
  let manifest;
  try {
    manifest = await carregarManifest();
  } catch (err) {
    document.getElementById('rodape-tabelas').textContent =
      'Erro: serve a app com um servidor HTTP — npx serve .';
    console.error(err);
    return;
  }

  /* Preencher seletor de anos */
  const anoSelect = document.getElementById('ano-fiscal');
  manifest.anos.slice().sort((a, b) => b - a).forEach(ano => {
    const opt = document.createElement('option');
    opt.value   = ano;
    opt.textContent = ano;
    if (ano === manifest.anoAtivo) opt.selected = true;
    anoSelect.appendChild(opt);
  });

  /* Carregar tabelas */
  await carregarTabelasAno(manifest.anoAtivo);

  /* Pré-preencher taxa AT da localStorage */
  document.getElementById('taxa-seguro-at').value = (carregarTaxaSeguroAT() * 100).toFixed(2);

  /* Atualizar rodapé com ano ativo */
  document.getElementById('rodape-tabelas').textContent =
    `Tabelas de retenção na fonte: ano ${manifest.anoAtivo}`;

  /* Restaurar última simulação */
  const saved = carregarUltimaSimulacao();
  if (saved) {
    preencherFormulario(saved);
    atualizarEstadoFormulario();

    /* Auto-calcular se a simulação anterior estava completa */
    if (validarPasso1() && (saved.salarioMensal ?? 0) > 0) {
      try {
        const res = calcularSimulacao(saved, _tabelasAtivas);
        renderRelatorio(res);
        document.getElementById('secao-relatorio').hidden = false;
      } catch (_) { /* ignorar se falhar */ }
    }
  }

  /* ── Event listeners ──────────────────────────────────────── */

  /* Mudar ano fiscal → recarregar tabelas */
  anoSelect.addEventListener('change', async () => {
    const ano = Number(anoSelect.value);
    try {
      await carregarTabelasAno(ano);
      atualizarBadgeTabela();
    } catch (err) {
      console.error('Erro ao carregar tabelas do ano', ano, err);
    }
  });

  /* Passo 1 — qualquer alteração valida e atualiza badge */
  ['localizacao', 'situacao-familiar', 'num-dependentes',
   'incapacidade-titular', 'dependentes-deficiencia'].forEach(id => {
    document.getElementById(id).addEventListener('change', atualizarEstadoFormulario);
  });

  /* Toggle cartão refeição → atualizar limite SA */
  document.getElementById('sa-cartao').addEventListener('change', atualizarLimiteSA);

  /* Painéis condicionais */
  document.getElementById('tem-ac').addEventListener('change', atualizarPainelAC);
  document.getElementById('tem-seguro-saude').addEventListener('change', atualizarPainelSeguroSaude);

  /* Toggle genérico para linhas de detalhe expansíveis */
  function toggleDetalhe(seletor, idChevron) {
    const linhas = [...document.querySelectorAll(seletor)];
    const chevron = document.getElementById(idChevron);
    if (linhas[0].classList.contains('oculto')) {
      linhas.forEach(tr => { tr.classList.remove('oculto'); tr.classList.add('a-fechar'); });
      requestAnimationFrame(() => requestAnimationFrame(() => {
        linhas.forEach(tr => tr.classList.remove('a-fechar'));
      }));
      chevron.classList.add('expandido');
    } else {
      linhas.forEach(tr => tr.classList.add('a-fechar'));
      linhas[0].addEventListener('transitionend', () => {
        linhas.forEach(tr => { tr.classList.remove('a-fechar'); tr.classList.add('oculto'); });
      }, { once: true });
      chevron.classList.remove('expandido');
    }
  }
  document.getElementById('linha-sa-toggle').addEventListener('click',    () => toggleDetalhe('.linha-sa-detalhe',  'sa-chevron'));
  document.getElementById('linha-bruto-toggle').addEventListener('click', () => toggleDetalhe('.linha-media-bruto', 'bruto-chevron'));
  document.getElementById('linha-liq-toggle').addEventListener('click',   () => toggleDetalhe('.linha-media-liq',   'liq-chevron'));
  document.getElementById('linha-rem-toggle').addEventListener('click',   () => toggleDetalhe('.linha-rem-detalhe', 'rem-chevron'));

  /* Toggle visibilidade card Remuneração Líquida */
  document.getElementById('toggle-mostrar-liq').addEventListener('change', e => {
    document.getElementById('kpi-card-liq').hidden = !e.target.checked;
  });

  /* Taxa seguro AT → guardar em localStorage */
  document.getElementById('taxa-seguro-at').addEventListener('change', () => {
    const v = parseFloat(document.getElementById('taxa-seguro-at').value);
    if (!isNaN(v)) guardarTaxaSeguroAT(v / 100);
  });

  /* Submit → calcular */
  document.getElementById('form-simulador').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validarPasso1()) return;

    const inp = lerInputs();
    guardarSimulacao(inp);

    let tabelasAno = _tabelasAtivas;
    if (!tabelasAno) {
      const ano = Number(document.getElementById('ano-fiscal').value);
      tabelasAno = await carregarTabelasAno(ano);
    }

    const res = calcularSimulacao(inp, tabelasAno);
    renderRelatorio(res);
    document.getElementById('secao-relatorio').hidden = false;

    /* Scroll suave para o relatório em mobile */
    if (window.innerWidth <= 900) {
      document.getElementById('secao-relatorio').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  /* Limpar */
  document.getElementById('btn-limpar').addEventListener('click', () => {
    localStorage.removeItem(LS.ultimaSimulacao);
    limparFormulario();
  });

  /* Exportar PDF */
  document.getElementById('btn-exportar').addEventListener('click', () => window.print());
}

/* Arrancar quando o DOM estiver pronto */
document.addEventListener('DOMContentLoaded', init);
