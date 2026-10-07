/* ================================================================
   OficinaTech — VERSÃO VULNERÁVEL A XSS
   Instituto Federal de Brasília — Segurança em Aplicações 2026/1

   Esta versão contém 2 pontos de XSS INTENCIONAIS:
     1) STORED XSS  -> campos da OS renderizados com innerHTML
     2) REFLECTED XSS -> termo de busca refletido com innerHTML

   NÃO há sanitização, NÃO há CSP, usa-se innerHTML de propósito.
   ================================================================ */

const CHAVE = 'os_vuln';

/* ----------------------------------------------------------------
   COOKIE DE SESSÃO (apenas para a demonstração)
   ----------------------------------------------------------------
   Cria um cookie fake para que o payload alert(document.cookie)
   tenha o que exibir. Num sistema real seria o cookie de sessão
   que o atacante tentaria roubar.
---------------------------------------------------------------- */
if (!document.cookie.includes('sessao=')) {
  document.cookie = 'sessao=abc123-token-fake; path=/';
}

// Dados de exemplo (seed) — carregados só na primeira vez.
const SEED = [
  {
    id: 1,
    cliente: 'Maria Silva',
    equipamento: 'Notebook Dell Inspiron',
    data: '2026-09-28',
    defeito: 'Não liga',
    descricao: 'Equipamento sem sinal de vida. Suspeita de fonte queimada.'
  },
  {
    id: 2,
    cliente: 'João Santos',
    equipamento: 'Smart TV Samsung 50"',
    data: '2026-10-01',
    defeito: 'Tela com linhas verticais',
    descricao: 'Imagem distorcida com faixas coloridas verticais.'
  },
  {
    id: 3,
    cliente: 'Loja do Zé',
    equipamento: 'Impressora Epson L3250',
    data: '2026-10-03',
    defeito: 'Não puxa papel',
    descricao: 'Tracionador de papel travado; cliente relata barulho.'
  }
];

function carregar() {
  const bruto = localStorage.getItem(CHAVE);
  if (!bruto) {
    localStorage.setItem(CHAVE, JSON.stringify(SEED));
    return [...SEED];
  }
  return JSON.parse(bruto);
}

function salvar(lista) {
  localStorage.setItem(CHAVE, JSON.stringify(lista));
}

let ordens = carregar();

/* ----------------------------------------------------------------
   RENDERIZAÇÃO DOS CARDS  (STORED XSS)
   ----------------------------------------------------------------
   VULNERÁVEL: montamos a string HTML concatenando os campos da OS
   crus (cliente, equipamento, defeito) e jogamos em innerHTML.
   Se um desses campos contiver <img src=x onerror=...> ou
   <script>, o navegador interpreta como HTML e EXECUTA.
---------------------------------------------------------------- */
function renderizarCards(lista) {
  const container = document.getElementById('lista-os');
  container.innerHTML = ''; // limpa

  lista.forEach(os => {
    const card = document.createElement('div');
    card.className = 'card';

    // >>> PONTO VULNERÁVEL <<<
    // innerHTML interpreta qualquer HTML presente nos dados.
    card.innerHTML = `
      <h3>${os.cliente}</h3>
      <span class="linha">🖥️ ${os.equipamento}</span>
      <span class="linha">📅 ${os.data}</span>
      <span class="linha">⚠️ ${os.defeito}</span>
    `;

    const botao = document.createElement('button');
    botao.textContent = 'Detalhes';
    botao.addEventListener('click', () => abrirDetalhes(os.id));
    card.appendChild(botao);

    container.appendChild(card);
  });
}

/* ----------------------------------------------------------------
   MODAL DE DETALHES  (STORED XSS — segundo sink)
   ----------------------------------------------------------------
   VULNERÁVEL: a descrição completa também vai para innerHTML.
---------------------------------------------------------------- */
function abrirDetalhes(id) {
  const os = ordens.find(o => o.id === id);
  if (!os) return;

  // >>> PONTO VULNERÁVEL <<<
  document.getElementById('modal-conteudo').innerHTML = `
    <div class="modal-conteudo">
      <h3>OS #${os.id} — ${os.cliente}</h3>
      <div class="campo"><div class="rotulo">Equipamento</div>${os.equipamento}</div>
      <div class="campo"><div class="rotulo">Data</div>${os.data}</div>
      <div class="campo"><div class="rotulo">Defeito</div>${os.defeito}</div>
      <div class="campo"><div class="rotulo">Descrição</div>${os.descricao}</div>
    </div>
  `;
  document.getElementById('modal').classList.remove('oculto');
}

document.getElementById('fechar-modal').addEventListener('click', () => {
  document.getElementById('modal').classList.add('oculto');
});

/* ----------------------------------------------------------------
   BUSCA  (REFLECTED XSS)
   ----------------------------------------------------------------
   VULNERÁVEL: o termo digitado é refletido de volta na página
   via innerHTML, sem escapar. Digitar um payload no campo e
   pesquisar já dispara a execução.
---------------------------------------------------------------- */
function exibirBusca(termo) {
  // >>> PONTO VULNERÁVEL <<<
  // O termo vindo da URL (?busca=...) é refletido via innerHTML, sem
  // escapar. Um link ?busca=<img src=x onerror=...> dispara na vítima
  // que apenas ABRE o link — é o que caracteriza o REFLECTED XSS.
  document.getElementById('resultado-busca').innerHTML =
    'Exibindo resultados para: <strong>' + termo + '</strong>';

  const filtradas = ordens.filter(os =>
    (os.cliente + os.equipamento + os.defeito).toLowerCase()
      .includes(termo.toLowerCase())
  );
  renderizarCards(filtradas);
}

// Ao pesquisar, jogamos o termo na query string e recarregamos: assim
// o fluxo é idêntico ao de um link malicioso ?busca=... compartilhado.
document.getElementById('form-busca').addEventListener('submit', (e) => {
  e.preventDefault();
  const termo = document.getElementById('busca').value;
  location.search = '?busca=' + encodeURIComponent(termo);
});

// Ao carregar a página, lemos ?busca=... da URL e refletimos.
const termoURL = new URLSearchParams(location.search).get('busca');

/* ----------------------------------------------------------------
   ABERTURA DE OS  (alimenta o STORED XSS)
---------------------------------------------------------------- */
document.getElementById('form-os').addEventListener('submit', (e) => {
  e.preventDefault();
  const nova = {
    id: Date.now(),
    cliente: document.getElementById('cliente').value,
    equipamento: document.getElementById('equipamento').value,
    data: document.getElementById('data').value,
    defeito: document.getElementById('defeito').value,
    descricao: document.getElementById('descricao').value
  };
  // Armazena SEM sanitizar — o payload fica persistido.
  ordens.push(nova);
  salvar(ordens);
  e.target.reset();
  renderizarCards(ordens);
});

// Render inicial: se veio ?busca=... na URL, refletimos (REFLECTED XSS);
// senão, mostramos todas as ordens.
if (termoURL !== null) {
  document.getElementById('busca').value = termoURL;
  exibirBusca(termoURL);
} else {
  renderizarCards(ordens);
}
