/* ================================================================
   OficinaTech — VERSÃO CORRIGIDA (SEGURA)
   Instituto Federal de Brasília — Segurança em Aplicações 2026/1

   Mesmas funcionalidades da versão vulnerável, mas:
     - Dados do usuário NUNCA entram em innerHTML diretamente.
     - Renderização via createElement + textContent.
     - escaparHTML() disponível para quando é preciso montar markup.
     - CSP declarada no HTML como camada extra.
     - Controle PRÓPRIO com paginação, com storage e estado
       independentes da versão vulnerável (desacoplado).
   ================================================================ */

// Chave de storage DIFERENTE da versão vulnerável => desacoplado.
const CHAVE = 'os_seguro';
const POR_PAGINA = 4;

const SEED = [
  { id: 1, cliente: 'Maria Silva', equipamento: 'Notebook Dell Inspiron', data: '2026-09-28', defeito: 'Não liga', descricao: 'Equipamento sem sinal de vida. Suspeita de fonte queimada.' },
  { id: 2, cliente: 'João Santos', equipamento: 'Smart TV Samsung 50"', data: '2026-10-01', defeito: 'Tela com linhas verticais', descricao: 'Imagem distorcida com faixas coloridas verticais.' },
  { id: 3, cliente: 'Loja do Zé', equipamento: 'Impressora Epson L3250', data: '2026-10-03', defeito: 'Não puxa papel', descricao: 'Tracionador de papel travado; cliente relata barulho.' },
  { id: 4, cliente: 'Ana Costa', equipamento: 'iPhone 12', data: '2026-10-04', defeito: 'Tela trincada', descricao: 'Troca de módulo de display agendada.' },
  { id: 5, cliente: 'Pedro Lima', equipamento: 'PC Gamer', data: '2026-10-05', defeito: 'Superaquecimento', descricao: 'Limpeza e troca de pasta térmica.' },
  { id: 6, cliente: 'Bruna Alves', equipamento: 'Roteador TP-Link', data: '2026-10-06', defeito: 'Sem Wi-Fi', descricao: 'Não emite sinal; possível defeito de hardware.' }
];

function carregar() {
  const bruto = localStorage.getItem(CHAVE);
  if (!bruto) {
    localStorage.setItem(CHAVE, JSON.stringify(SEED));
    return [...SEED];
  }
  return JSON.parse(bruto);
}
function salvar(lista) { localStorage.setItem(CHAVE, JSON.stringify(lista)); }

/* ----------------------------------------------------------------
   DEFESA 1 — escape de HTML.
   Converte os caracteres perigosos ( < > & " ' ) em entidades.
   É o equivalente em JS ao htmlspecialchars() do PHP.
   Usada só quando REALMENTE precisamos montar markup como string.
---------------------------------------------------------------- */
function escaparHTML(valor) {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Estado próprio do módulo seguro.
let ordens = carregar();
let paginaAtual = 1;
let termoAtivo = '';

function filtrar() {
  const t = termoAtivo.toLowerCase();
  if (!t) return ordens;
  return ordens.filter(os =>
    (os.cliente + os.equipamento + os.defeito).toLowerCase().includes(t)
  );
}

/* ----------------------------------------------------------------
   DEFESA 2 — renderização sem innerHTML.
   Criamos cada nó com createElement e preenchemos com textContent.
   textContent trata o conteúdo como TEXTO LITERAL: um <script>
   aparece escrito na tela, nunca é executado.
---------------------------------------------------------------- */
function criarLinha(icone, texto) {
  const span = document.createElement('span');
  span.className = 'linha';
  span.textContent = `${icone} ${texto}`;   // texto literal => seguro
  return span;
}

function renderizarCards() {
  const container = document.getElementById('lista-os');
  container.textContent = ''; // limpa sem innerHTML

  const filtradas = filtrar();
  const inicio = (paginaAtual - 1) * POR_PAGINA;
  const pagina = filtradas.slice(inicio, inicio + POR_PAGINA);

  pagina.forEach(os => {
    const card = document.createElement('div');
    card.className = 'card';

    const h3 = document.createElement('h3');
    h3.textContent = os.cliente;      // seguro
    card.appendChild(h3);

    card.appendChild(criarLinha('🖥️', os.equipamento));
    card.appendChild(criarLinha('📅', os.data));
    card.appendChild(criarLinha('⚠️', os.defeito));

    const botao = document.createElement('button');
    botao.textContent = 'Detalhes';
    botao.addEventListener('click', () => abrirDetalhes(os.id));
    card.appendChild(botao);

    container.appendChild(card);
  });

  renderizarPaginacao(filtradas.length);
}

/* ----------------------------------------------------------------
   Controle próprio de paginação (desacoplado).
---------------------------------------------------------------- */
function renderizarPaginacao(total) {
  const nav = document.getElementById('paginacao');
  nav.textContent = '';
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;

  const anterior = document.createElement('button');
  anterior.textContent = '‹ Anterior';
  anterior.disabled = paginaAtual <= 1;
  anterior.addEventListener('click', () => { paginaAtual--; renderizarCards(); });

  const info = document.createElement('span');
  info.className = 'pagina-info';
  info.textContent = `Página ${paginaAtual} de ${totalPaginas}`;

  const proxima = document.createElement('button');
  proxima.textContent = 'Próxima ›';
  proxima.disabled = paginaAtual >= totalPaginas;
  proxima.addEventListener('click', () => { paginaAtual++; renderizarCards(); });

  nav.append(anterior, info, proxima);
}

/* ----------------------------------------------------------------
   Modal de detalhes — seguro.
   Aqui usamos uma string de markup (para manter rótulos), mas
   TODO valor vindo do usuário passa por escaparHTML() antes.
---------------------------------------------------------------- */
function abrirDetalhes(id) {
  const os = ordens.find(o => o.id === id);
  if (!os) return;

  document.getElementById('modal-conteudo').innerHTML = `
    <div class="modal-conteudo">
      <h3>OS #${escaparHTML(os.id)} — ${escaparHTML(os.cliente)}</h3>
      <div class="campo"><div class="rotulo">Equipamento</div>${escaparHTML(os.equipamento)}</div>
      <div class="campo"><div class="rotulo">Data</div>${escaparHTML(os.data)}</div>
      <div class="campo"><div class="rotulo">Defeito</div>${escaparHTML(os.defeito)}</div>
      <div class="campo"><div class="rotulo">Descrição</div>${escaparHTML(os.descricao)}</div>
    </div>
  `;
  document.getElementById('modal').classList.remove('oculto');
}

document.getElementById('fechar-modal').addEventListener('click', () => {
  document.getElementById('modal').classList.add('oculto');
});

/* ----------------------------------------------------------------
   Busca — segura.
   O termo vai para textContent; o navegador o trata como texto.
---------------------------------------------------------------- */
function exibirBusca(termo) {
  termoAtivo = termo;
  paginaAtual = 1;

  const alvo = document.getElementById('resultado-busca');
  alvo.textContent = '';                         // limpa
  alvo.append('Exibindo resultados para: ');
  const forte = document.createElement('strong');
  forte.textContent = termo;                     // seguro: tratado como texto
  alvo.append(forte);

  renderizarCards();
}

// Mesmo fluxo da versão vulnerável (query string ?busca=...), mas o
// termo é escrito com textContent: um payload aparece como texto literal.
document.getElementById('form-busca').addEventListener('submit', (e) => {
  e.preventDefault();
  const termo = document.getElementById('busca').value;
  location.search = '?busca=' + encodeURIComponent(termo);
});

const termoURL = new URLSearchParams(location.search).get('busca');

/* ----------------------------------------------------------------
   Abertura de OS — mesma lógica, armazenamento próprio.
---------------------------------------------------------------- */
document.getElementById('form-os').addEventListener('submit', (e) => {
  e.preventDefault();
  ordens.push({
    id: Date.now(),
    cliente: document.getElementById('cliente').value,
    equipamento: document.getElementById('equipamento').value,
    data: document.getElementById('data').value,
    defeito: document.getElementById('defeito').value,
    descricao: document.getElementById('descricao').value
  });
  salvar(ordens);
  e.target.reset();
  paginaAtual = 1;
  renderizarCards();
});

// Render inicial: se veio ?busca=... na URL, aplicamos o termo (mas de
// forma segura, via textContent); senão, mostramos todas as ordens.
if (termoURL !== null) {
  document.getElementById('busca').value = termoURL;
  exibirBusca(termoURL);
} else {
  renderizarCards();
}
