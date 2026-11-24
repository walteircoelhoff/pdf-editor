# Folha — Editor de PDF

Editor web em português, executado no navegador. Projeto independente do ERP e da API tributária deste workspace: não usa banco, credenciais ou serviços deles.

## Executar

Requisitos: Node.js 22.13 ou superior e npm.

```bash
npm ci
npm run dev
```

Abra o endereço mostrado pelo Vite, normalmente `http://127.0.0.1:5173`. Não abra `index.html` diretamente pelo explorador de arquivos: módulos e workers precisam de HTTP.

## Funcionalidades

- Abrir PDFs por seleção de arquivos ou arrastando para a tela; selecionar vários para unir.
- Acrescentar outros PDFs ao documento atual.
- Adicionar texto com acentos, cor, tamanho e várias linhas.
- Destacar áreas, desenhar à mão livre e criar retângulos.
- Inserir imagens PNG/JPEG e ajustar sua largura com proporção preservada.
- Selecionar, mover, alterar a cor e excluir as anotações criadas na sessão.
- Selecionar, reordenar, girar, duplicar e excluir páginas; inserir folhas A4 em branco.
- Desfazer/refazer as últimas 40 operações, zoom e ajuste à largura da área de edição.
- Renomear e baixar uma nova cópia em PDF.
- Experimentar com documento sintético de duas páginas, sem arquivo externo.
- Interface adaptada para desktop e celular.

## Como editar

1. Abra um PDF ou escolha o exemplo da tela inicial.
2. Em **Texto**, escreva no painel **Ajustes** e clique na folha para inserir. Selecione um texto já inserido ou dê dois cliques nele para alterar seu conteúdo no painel.
3. Em **Marca-texto**, **Retângulo** ou **Desenhar**, arraste sobre a folha.
4. Em **Imagem**, escolha um PNG/JPEG e clique na folha. Com a imagem selecionada, ajuste a largura no painel.
5. Em **Selecionar**, arraste uma anotação para movê-la. Use **Excluir anotação** ou a tecla Delete.
6. Escolha uma miniatura e use os controles de **Página atual** para organizar o documento. **Anterior** e **Próxima** movem a página na ordem do arquivo.
7. Clique em **Baixar PDF** antes de fechar ou recarregar a aba.

Atalhos: Ctrl/Cmd+Z desfaz; Ctrl/Cmd+Shift+Z refaz; Escape seleciona a ferramenta de seleção. Enquanto você escreve num campo, os atalhos de texto ficam com o navegador.

## Publicar no GitHub

Publique **somente o conteúdo desta pasta `pdf-editor/`** como raiz de um repositório próprio. A pasta superior contém outros projetos e não é necessária para executar este editor.

1. Crie um repositório vazio no GitHub, por exemplo `folha-pdf-editor`.
2. Execute dentro de `pdf-editor/`:

```bash
git init -b main
git add .
git commit -m "Cria editor web de PDF"
git remote add origin https://github.com/SEU_USUARIO/folha-pdf-editor.git
git push -u origin main
```

Se o repositório local já estiver inicializado, pule `git init`. Substitua `SEU_USUARIO` pelo proprietário correto. A autenticação é feita pelo Git/GitHub; o aplicativo não precisa de tokens.

3. Em **Settings → Pages → Build and deployment → Source**, escolha **GitHub Actions**.
4. O workflow [pages.yml](.github/workflows/pages.yml) instala pelo lockfile, gera `dist/` e publica. Se já tiver ocorrido um push antes de ativar Pages, execute manualmente **Actions → Publicar no GitHub Pages → Run workflow**.
5. A URL fica disponível no ambiente `github-pages` após o workflow concluir. O projeto usa caminhos relativos e suporta publicação em `https://SEU_USUARIO.github.io/folha-pdf-editor/`.

Não há repositório remoto ou publicação criados automaticamente nesta entrega. `node_modules/`, `dist/`, resultados de testes e arquivos `.env` são ignorados pelo Git.

## Build e verificação

```bash
npm run build
npm run preview
```

O resultado em `dist/` pode ser servido em qualquer hospedagem estática. Fontes, código, worker, mapas de caracteres e decodificadores de imagem são locais ao site; não há dependência de CDN em runtime. Os scripts `predev` e `prebuild` copiam os recursos e avisos de licença das dependências para `public/`. Essas cópias são geradas a partir do lockfile e ignoradas pelo Git.

Os testes usam Chrome instalado na máquina. Para instalar o navegador de teste:

```bash
npx playwright install chrome
npm test
npm audit
```

A suíte verifica upload, textos com acentos, destaque, desenho, imagem, histórico, movimento/edição de anotações, organização e união de páginas, exportação reaberta por um leitor PDF, coordenadas nas quatro rotações com CropBox deslocado, arquivo inválido, caracteres sem suporte e layout de celular. Screenshots ficam em `test-results/`, ignorado pelo Git.

## Privacidade e limites

- Os documentos e imagens são processados em memória no navegador, sem envio a servidor e sem persistência em localStorage/IndexedDB. A página não inclui analytics. O servidor de hospedagem recebe as requisições normais dos arquivos do site.
- Não existe salvamento automático ou recuperação de sessão. Fechar/recarregar perde o trabalho ainda não baixado; o navegador pode mostrar o aviso de alterações pendentes.
- A edição é por sobreposição: **não substitui nem remove o texto original**, não tem OCR, conversão para Word, compressão ou edição de formulários.
- Retângulos e marcações **não são tarja segura nem removem informações do PDF**. Não os use para ocultar dados confidenciais.
- A exportação gera um novo arquivo. **Assinaturas digitais não são preservadas como válidas.** Formulários, anexos, índices, scripts, links internos e outros recursos de documento não têm garantia de preservação. Guarde o original.
- Girar uma página incorpora suas anotações ao conteúdo dela. Depois disso, essas anotações deixam de ser objetos editáveis individualmente. Desfazer restaura a página anterior e seus objetos.
- PDFs criptografados/com senha não são aceitos. Limite de entrada de 50 MB por PDF e 10 MB por imagem; a capacidade total depende da memória do dispositivo. Documentos extensos ou com páginas muito grandes podem ser lentos.
- A fonte Noto Sans cobre português e vários alfabetos, mas não todos os símbolos e emojis. A exportação informa um erro quando o texto contém um caractere sem suporte.
- Miniaturas mostram o conteúdo original da página e um indicador “editada”. As novas anotações são visualizadas na folha central e no PDF exportado.
- Navegadores modernos com suporte a módulos, workers, canvas e SVG são necessários. A validação automatizada desta entrega usa Chrome; outros navegadores ainda precisam de homologação própria.

## Estrutura e bibliotecas

```text
src/main.js                   Interface, sessão e interações
src/pdf.js                    Cópia das páginas e exportação de anotações
src/style.css                 Layout e estilos responsivos
scripts/prepare-assets.mjs    Recursos locais do leitor PDF e licenças
public/fonts/                 Fonte Noto Sans e licença OFL
tests/editor.spec.js          Verificações reais no navegador
.github/workflows/pages.yml   Publicação estática
```

[PDF.js](https://github.com/mozilla/pdf.js) renderiza as páginas, e [pdf-lib](https://pdf-lib.js.org/docs/api/classes/pdfdocument) copia páginas e grava as alterações. As coordenadas visuais são convertidas pelo viewport do PDF.js para respeitar rotação e recorte da folha. [fontkit](https://github.com/Hopding/fontkit) incorpora a fonte; [Lucide](https://lucide.dev/) fornece os ícones; [Vite](https://vite.dev/) prepara o site. As licenças dessas dependências continuam pertencendo aos respectivos autores.
