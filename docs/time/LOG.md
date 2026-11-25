# Diário

Cada ciclo: o que foi pedido, o que foi feito, como foi verificado, o que ficou pendente. Mais recente em cima.

## Ciclo atual
- App Android (TWA) removido a pedido do usuário: só o modo PWA continua. Apagados `android/` (Gradle), `.github/workflows/android.yml` e `site/.well-known/assetlinks.json`; `.gitignore` sem as entradas de keystore/Gradle; README, PRODUCT.md e os docs de time (CONTEXTO, DECISOES D32, PLANO, SPEC) atualizados. Pendente: remover manualmente os segredos `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` em Settings > Secrets do GitHub (o agente não tem acesso para isso). `npm test` (69 testes) continua passando.
- Botão "Copiar detalhamento" dentro de "Composição do preço" (visão interna): copia para a área de transferência os custos, taxas, preço sugerido e lucro que aparecem na tela, com a marca "USO INTERNO (não enviar ao cliente)". Não entra no que é enviado. Teste de navegador novo; o teste de layout agora abre a seção interna.
- Detalhamento removido do envio: o texto, a imagem e o PDF mostram só itens, desconto e total; a escolha "Resumido/Composição do preço" saiu da tela e `sharedCosts` foi apagada. A visão interna "Composição do preço" continua. Guardas: teste de estrutura (app.js sem `sharedCosts`/`detailed`/`DETALHAMENTO`/`COMPOSIÇÃO DO VALOR`, validado quebrando de propósito) e testes de navegador (texto copiado sem custos nem lucro; visão interna intacta). PDF e pré-visualização conferidos em captura.
- (anterior) Lucro fora do orçamento detalhado: `sharedCosts()` (texto copiado, imagem e PDF) não traz mais "Lucro estimado após taxas"; custos e taxas continuam. O lucro segue só na visão interna "Composição do preço". Guardas: teste de estrutura (sharedCosts sem "lucro", validado quebrando de propósito) e teste de navegador (texto copiado no modo detalhado).
- Botão dividido "Enviar" (Material 3 split button): a ação principal faz o último envio usado (padrão WhatsApp, guardado no aparelho); a seta abre o menu com WhatsApp, E-mail com PDF, Copiar texto, Baixar PDF e Pré-visualizar (esta não muda o principal). Teclado: setas, Home, End, Esc. Novo `js/envio.js`; os handlers de envio continuam em `app.js` nos botões do menu. Testes: estrutura (menu com aria-controls) e navegador (teclado, memória, pré-visualizar).
- Enviar por e-mail (opção A): botão "Enviar por e-mail" no resultado. No celular abre o compartilhamento do Android com o PDF anexado, assunto e texto; no computador baixa o PDF e abre o e-mail (mailto) com o cliente, assunto e resumo preenchidos. Sem servidor. Teste de navegador novo cobre os dois caminhos.
- Testes automáticos: 17 testes de estrutura (`tests/estrutura.test.cjs`, no `npm test`) e suíte de navegador com Playwright (`tests/e2e/`, 14 testes por tamanho de tela, 6 tamanhos). Os testes de estrutura foram validados quebrando de propósito (id removido, cor solta, raio solto, módulo sem página, ícone inexistente, site alterado sem subir o cache): todos falharam como esperado. Achados reais corrigidos: diálogo "Instale no Android" sem título acessível; botões da pré-visualização a 360 px.
- Auditoria de alinhamento no celular: percorridas 13 telas (5 etapas, resultado, salvar no histórico, pré-visualização, clientes, diálogo de cliente, impressões, detalhes, salvos) em 320, 360, 390 e 412 px, medindo itens fora da tela, rolagem horizontal e grupos de botões desalinhados. Corrigido: controle de desconto (3 opções em colunas iguais), botões do resultado (grade), rodapé, detalhes da impressão (botões do arquivo em grade, fatos em 2 colunas), botões do diálogo de pré-visualização (saíam da tela a 360 px). Resultado final: sem problemas nas 13 telas nos 4 tamanhos.
- Avaliação e endurecimento do banco: migrações `20261117000000_harden_inventta3d_schema.sql` e `20261117000100_index_inventta3d_composite_fks.sql` aplicadas no Supabase. Verificado com transação desfeita (nada ficou gravado): usuário B não vê nem referencia dados de A; gatilho de `updated_at`; apagar cliente zera `customer_id` e mantém o pedido; apagar peça remove os pedidos. Alertas de desempenho das políticas resolvidos; sobram só índices "não usados" (tabelas vazias).
- Histórico de impressões: migração `20261116000000_create_inventta3d_prints.sql`, módulo `impressoes.js`, botão "Salvar no histórico" no fim do orçamento. Testado no navegador com banco e armazenamento simulados (salvar com e sem arquivo, mesma peça em novo pedido, aviso de duplicado, trocar, remover e baixar arquivo, extensão inválida, exclusão em cascata). Ainda sem teste com Supabase real.
- Organização do projeto: criados `SPEC`, `PLANO`, `DECISOES`, `CONTEXTO` e este `LOG` em `docs/time/`. Pendências levantadas no PLANO (P1 a P8).

## Ciclos anteriores (resumo)
| Pedido | Resultado | Verificação |
|---|---|---|
| Sair da conta com erro | Causa: constante reatribuída no callback de sessão (`app.js`). Corrigido | Reproduzido com sessão simulada; depois, sem erro |
| Login: tema à direita, espaçamento | Publicado (`v33`) | Medido no navegador, 1440×900 e 390×844 |
| Login: tema, logo, textos | Publicado | Navegador, claro e escuro |
| Módulo Clientes | Tabela criada no Supabase, tela e integração publicadas (`v31`) | Banco simulado no navegador; RLS conferida no banco; sem teste com login real |
| "Gerar orçamento" quebrado, frase "Quase pronto" | Corrigido (era bug do Valor final) | Fluxo completo no navegador |
| Etapas cabendo numa tela | Publicado (`v29`) | Alturas 961 e 860 px, 5 etapas |
| Campos em pílula; stepper; bordas; Valor final | Publicados | Navegador; "Valor final" só com cálculo, sem login real |
| Horas decimais | Publicado | Teste automático novo |
| APK não abre | Cores do TWA corrigidas, v1.0.1 publicada | Não verificado em aparelho (P1) |
| Layouts de orçamento (imagem e PDF), QR codes | Publicados | Render com dados de exemplo; QR não escaneado |
| Publicação no GitHub Pages e APK | Site no ar, APK assinado v1.0.0 | Assinatura conferida com `openssl`; instalação não testada |
| Calculadora nos campos de valor | Pronta, não publicada (`v55`) | 7 testes do núcleo, 5 de navegador e auditoria de layout em 320, 360, 390, 412 e 1440 px; não testada em aparelho |
| Importar do fatiador (G-code e 3MF) | Pronto, não publicado (`v56`) | 8 testes do leitor (inclui 3MF montado no teste), 2 de navegador; não testado com arquivos reais de cada fatiador |
| Fatiamento automático (Kiri + modo rápido) | Pronto, não publicado (`v58`) | 14 testes de unidade do leitor/estimador, 3 de navegador (um fatia de verdade com o Kiri); comparação com o Bambu Studio no projeto real; não testado em celular real |
| Visualizador 3D (etapa 1 e histórico) | Pronto, não publicado | 2 testes de navegador (canvas na etapa 1; "Ver em 3D" no histórico, com o simulador de armazenamento devolvendo o arquivo real) |
| Painel do mês | Pronto, não publicado | 3 testes de unidade (resumo, pedidos, série com virada de ano) e 1 de navegador; auditoria de layout em 360 e 1280 |
| Preço para marketplace | Pronto, não publicado | 3 testes de unidade (conta inversa, faixas da Shopee, taxas impossíveis) e 1 de navegador |
| Biblioteca: "Orçar de novo" no histórico | Pronto, não publicado | 1 teste de navegador |
| Estoque de filamento | Pronto, não publicado; migração escrita, não aplicada | 3 testes de unidade, 2 de navegador (cadastro, validação, desconto ao salvar, aviso na etapa 2) |
| Pedidos com status, entrega, lembrete e etiqueta | Pronto, não publicado; migração escrita, não aplicada | 4 testes de unidade, 3 de navegador; Painel com valor fechado |
| Impressoras e manutenção | Pronto, não publicado; migração escrita, não aplicada | 3 testes de unidade, 1 de navegador |
| Link de aprovação (aprovar.html) | Pronto, não publicado; migração com funções públicas escrita, não aplicada; SQL das funções não executado em banco real | 1 teste de unidade, 2 de navegador (dono gera link, cliente aprova; cliente pede ajuste; link inválido) com simulador das funções; corrigida sobreposição de botões nos pedidos em 360 px e uma condição de corrida na lista |
| Vitrine pública (vitrine.html) | Pronto, não publicado; migração com bucket público e função escrita, não aplicada | 3 testes de unidade, 2 de navegador (configurar loja, publicar peça com foto, visitante vê e pede pelo WhatsApp; vitrine fechada) |
| Status ao vivo da impressora | Não feito (D30) | — |
## 2026-11-15 — migrações das features aplicadas no Supabase (com "sim" do usuário)
- Aplicadas 20261118000000…0400 (spools, status em quotes, printers, aprovação, vitrine).
- Acrescentada antes de aplicar: política `inventta3d_vitrine_select_own` (Storage exige select para remover a foto antiga).
- Verificado no banco real (bloco com rollback, papel anon): link de aprovação devolve só campos públicos, token errado = nulo, anon não lê tabelas, ajuste/aprovação/repetição/decisão inválida corretos; vitrine ativa lista itens sem custo, desativada = nulo. Nada ficou gravado.
- Advisors: 3 avisos esperados (funções públicas por desenho, D17), índices novos ainda sem uso, proteção de senha vazada desligada (pré-existente).
- Site ainda NÃO publicado.

- 2026-11-15: site publicado (commit d6a873d, CACHE v66); arquivos novos servindo 200, módulos carregam sem erro no console.

## 2026-11-15 — ajustes pós-publicação (ainda não publicados, CACHE v67)
- Etapa 1: botões "Salvar cliente" (esquerda) e "Continuar" (direita) alinhados às bordas dos campos no computador (clientes.css; o "Voltar" desabilitado não ocupa espaço).
- Etapas: com o preço na tela, clicar nos números do topo reabria só o número, não a tela. Agora reabre o formulário na etapa clicada (edita o último item, sem duplicar). Teste novo tests/e2e/etapas.spec.cjs; confirmado por mutação que falha sem a correção.

## 2026-11-15 — fatiamento removido; cores no 3D (local, CACHE v69, não publicado)
- Removidos da tela: estimativa rápida, fatiamento preciso (Kiri), Preenchimento, Suporte e "Calcular com precisão". Motivo: lento em aparelhos fracos e a rápida erra o tempo em 33–49% em peças orgânicas (medido em 4 arquivos do usuário).
- Mantido: ler peso/tempo de G-code e 3MF já fatiado; STL e 3MF agora só mostram a peça em 3D.
- Novo: paleta de 15 cores sobre o 3D (etapa 1 e histórico); na etapa 1, trocar a cor preenche "Cor do filamento".
- Funções puras do fatiador (estimarRapido, processoKiri, tempoGcode) e site/lib/kiri ficaram no repositório, sem uso, para voltar depois.
- Novo (CACHE v70, não publicado): botão "Compartilhar imagem" no 3D (etapa 1 e histórico). PNG 1200×900 com fundo claro na cor escolhida; no celular abre o compartilhamento do sistema (WhatsApp), no computador baixa o arquivo. Vídeo giratório e link interativo ficam para depois.
- Novo (CACHE v71, não publicado): botão "Compartilhar GIF" — peça girando uma volta (48 quadros 400×300, ~3 s, ~240 KB), gerada no navegador sem biblioteca (paleta única + LZW). Conferido decodificando os 48 quadros com ImageDecoder (erro médio 0,16/pixel). Mesmo caminho do PNG: celular compartilha, computador baixa.

## 2026-11-15 — login só com Google (local, CACHE v73, não publicado)
- Removidos da tela e do código: e-mail, senha, "Criar conta", "Esqueci minha senha", confirmação de senha, fluxo de recuperação (PASSWORD_RECOVERY) e o olho de senha (password-toggle.js apagado). Sobra "Continuar com Google".
- Motivo: e-mail de confirmação do Supabase (SMTP padrão) só entrega à equipe do projeto e tem limite baixo; clientes novos não receberiam.
- PENDENTE no painel do Supabase (Authentication → Sign In / Providers → Email): desligar "Enable email signups", senão a API ainda aceita cadastro por e-mail.
- Quem já tinha conta por senha deve entrar com o Google do mesmo e-mail (o Supabase costuma vincular pela mesma conta; não verificado).
- GIF mais lento (local, CACHE v74, não publicado): de 48 quadros a 6 cs (~3 s por volta) para 72 quadros a 10 cs (~7 s por volta).

- 3MF fatiado também mostra a peça em 3D (além de peso, tempo e material). Teste e2e novo. CACHE v75.

- Visualizador 3D com ícones sobre a peça: tela cheia (topo), cores (base esquerda, abre painel) e compartilhar (base direita, abre imagem/GIF). Altura 300 px. CACHE v76.

- WhatsApp do orçamento envia também o PNG da peça em 3D (peca-3d.png) quando há 3D na tela; sem 3D, só o orçamento. CACHE v78.

- Auditoria de UI: rótulos do passo a passo e do menu inferior cabiam mal em 320 px (corrigido); 3D enquadra a peça inteira (câmera por esfera); viewport das etapas com overflow:clip e rolagem zerada (falha só no CI); testes em 10 telas incl. 1366, 1920 e A56 (411). CACHE v79.

- Cliente salvo (seletor) alinhado com o campo Telefone: rótulo com a mesma altura dos campos com balão. Teste de alinhamento. CACHE v80.

- Botões do resultado padronizados (principal + 3 secundários com contorno + Limpar pedido à direita); rótulos das etapas cabem em 360–399 px. Testes novos. CACHE v81.

- Desktop: botões do resultado em duas linhas (salvar / editar + Limpar à direita); Composição e Marketplace como cartões iguais, arredondados também no hover (summary não herda raio do details). Testes novos. CACHE v82.

- Resultado: Limpar pedido virou lixeira no canto do cartão "Itens do pedido"; 4 botões iguais (contorno), 2 por linha: Adicionar item, Ajustar preços, Salvar orçamento, Salvar no histórico. Teste novo de balões de ajuda (mouse e toque). CACHE v83.

- Confirmação (window.confirm) antes de: salvar orçamento, salvar cliente (2 lugares), salvar rolo, salvar impressora, salvar no histórico, salvar vitrine e peça da vitrine, excluir orçamento salvo (mantém o desfazer) e sair da conta (o clearDraft solto no clique foi removido). Já existiam nos demais excluir. Testes: apoio.entrar responde OK por padrão; page.responder=false cancela. CACHE v84.

- 3D usa as cores originais do projeto (3MF Bambu/Orca: filament_colour + extruder por objeto/parte), sem fatiar; botão "Cores do projeto" no painel de cores. PrusaSlicer/STL ficam sem. Testes unitários e e2e. CACHE v85.

- GIF: pixels lidos direto do WebGL (render target + readPixels) em vez de drawImage em canvas 2D (saiu em branco num celular); recusa quadro vazio; teste confere pixels da peça nos quadros. WhatsApp pergunta se envia o GIF junto (peca-3d.gif). Tela de preço mostra o mesmo quadro 3D acima dos itens (o elemento muda de lugar, sem 2º WebGL). CACHE v86.

- 3MF pintado por triângulo (paint_color de Bambu/Orca, slic3rpe:mmu_segmentation do Prusa): árvore de subdivisão decodificada, filamento dominante por face. Testado com Santa++keychain.3mf (1 mi de triângulos, 99 MB): ~10 s para abrir no notebook, ~145 MB retidos, pico ~660 MB durante a leitura; GIF 808 KB em 9 s. CACHE v87.

- Orçamento salvo: "Adicionar item" não esquece mais o orçamento já salvo (antes o 2º Salvar criava um orçamento novo duplicado) e "Limpar pedido"/novo pedido esquece (antes sobrescrevia o anterior). Testes de regressão. 3D redesenha só sob demanda (parado: 0 quadros; fora da tela não desenha). Barra de progresso ao ler 3MF grande, com leitura em blocos que cedem a vez ao navegador. CACHE v88.

- SITE DE APRESENTAÇÃO + APP EM /app/: o app (antes na raiz) foi movido para site/app/ (git mv); a raiz agora é o site novo (site/index.html, site/assets/). Site: conversa animada de orçamento (mesmo cálculo do app), calculadora ao vivo, peça 3D de demonstração, bento, etapas, FAQ, botões "Acessar o app" (/app/) e "Entrar em contato" (WhatsApp 11 94664-1992), Instagram @3d.inventta. site/sw.js na raiz só desregistra o service worker antigo. TWA_PATH padrão virou /app/. Testes: tests/e2e/site.spec.cjs; testes do app passaram a usar /app/. PRODUCT.md e .impeccable/ (design). CACHE do app v89.

- Site: celular do topo com telas REAIS do app (capturas com dados fictícios geradas por scripts/capturar-site.cjs; ver site/assets/img/ORIGEM.md), paleta mais leve (vermelho só como acento; rosé, azul claro, grafite), seção "O aplicativo por dentro", fecho com tela real, barra fixa some sobre o celular. ACHADO NO APP (a corrigir): em ~960 px de largura o rótulo "Desconto do pedido" estoura o cartão. CACHE do app v89 (sem mudança no app).

- Logos atualizadas (pacote do usuário, 2026-11-16): as 4 logo-3d-*.svg ficaram mais altas (viewBox 1412x1600) para o MEIO DO "3D" ser o centro (o bico não entra mais na conta). Ícones regenerados com scripts/gerar-icones.cjs (site, PWA, apple-touch, Android mipmaps, projeto-trid-mark.png, icon.svg); tamanhos no CSS/PDF/template ajustados; teste tests/e2e/identidade.spec.cjs mede o centro do 3D. As logos com nome não mudaram. CACHE do app v90.

- SITE DA RAIZ RECONSTRUÍDO no sistema do taste-skill 2.5.1 (2026-11-16; /app/ não mudou): hero centrado (a janela real do app no computador subindo de um quadro, h1 "Orçamento de impressão 3D", efeito líquido do cursor no título), "O aplicativo no celular" (três telas reais de linha a linha), "Recursos" (calculadora ao vivo, peça 3D, orçamento do WhatsApp, o resto do negócio), "Do pedido ao preço" (barra real de etapas do app + cinco colunas, faixa escura), perguntas e fecho. Cada seção é 1 ou 2 telas, hero sozinho na primeira tela, bordas iguais, kit em site/assets/ (system.css/js, ui, motion, layout, diagrams, moments; só o que a página usa). Fonte Outfit (DM Mono no kit) com as cores do app; tema claro/escuro pelo sistema (sem o botão de tema; a peça 3D viva e a conversa animada saíram). Testes tests/e2e/site.spec.cjs reescritos (estrutura: telas por seção, bordas, hero, imagens, calculadora, temas). Gate da skill: 1 FAIL aberto (botão do menu 2 px além da borda a 320 px, do próprio kit) e 3 waivers (rótulo em português; número do WhatsApp do cliente).

- Site da raiz, revisão (2026-11-16): a janela do hero deixou de ser imagem recortada e virou o app em HTML (etapas, peça 3D girando, preço); a peça 3D viva voltou também no bloco de recursos, com arrastar, setas e troca de cor (Natal, Oceano, Grafite); as telas do celular aparecem inteiras, em moldura, com o texto de contexto ao lado (Pedido, Preço, Envio). Teste novo da peça 3D e da troca de cor.

- Site (2026-11-16): blocos "Envia o orçamento" e "Guarda o resto do negócio" refeitos com telas reais e inteiras. "Envia" mostra o orçamento sem corte; "Acompanha cada pedido" mostra Orçamentos salvos; nova seção #negocio (Gestão) com Clientes, Painel e Impressões no celular. Capturas por scripts/capturar-negocio.cjs (banco falso, dados fictícios).

- ACESSO POR APROVAÇÃO (2026-11-16): quem entra pelo Google fica pendente até ser aprovado. Migração 20261119000000_inventta3d_access_approval (aplicada no Supabase de produção): tabela inventta3d_access (email, user_id, status pending|approved|blocked), funções inventta3d_is_approved() e inventta3d_request_access(), gatilho que registra toda conta nova como pendente e políticas restritivas "_approved_only" em todas as tabelas de dados. Contas existentes 3d.inventta@ e lucaslacerda.ti@ aprovadas; ramos.cinthia@ (sem dados) ficou pendente. No app: js/acesso.js mostra "Aguardando aprovação" / "Acesso não liberado" (Verificar de novo, Sair). Os orçamentos enviados ao cliente (link de aprovação) e a vitrine continuam abertos. Para aprovar: update public.inventta3d_access set status = 'approved' where email = '...'; (ou editar a coluna status na tabela, no painel do Supabase). CACHE v95.

- AUDITORIA DE UI (2026-11-16), pacotes 1 e 2: etapas futuras com contraste AA e 12 px no celular; alvos de toque de 44 px em tela de toque; "(opcional)" 13 px; algarismos proporcionais nos campos. Salvos: status como selo colorido (Orçado, Aprovado, Imprimindo, Pronto, Entregue, Recusado), filtro vira seletor "Status: ..." no celular e ações secundárias no menu "Mais". Painel: lucro em destaque, variação contra o mês anterior e valor de cada mês no gráfico. Login: quadro com a peça 3D girando e o preço. Site: botão de tema claro/escuro (mesma chave do app). CACHE v96.

- Orçamento (imagem e PDF), auditoria 2026-11-16: QR do Pix e do Instagram gerados pelo mesmo código (só os módulos escuros, fundo transparente, sem margem), então a parte preta dos dois tem o mesmo tamanho e não há mais quadro branco sobre o cartão cor de papel; o PNG antigo do Instagram (com legenda) deixou de ser usado. Fonte dos documentos passou a Outfit (a DM Sans não é mais carregada pelo app e a imagem caía numa fonte de reserva, com espaços tortos entre as palavras). Telefone, e-mail e cor vazios não aparecem mais como "—". Instagram e rodapé do PDF nas cores da marca (sem o azul de link). QR do Pix centralizado no cartão do PDF. CACHE v98.

- Peça 3D do site e do login trocada pelo símbolo da logo como chaveiro impresso (site/assets/logo3d.js): geometria lida do SVG da logo (caminhos M/L/H/V/Q/Z e o polígono do bico), placa com furo, símbolo em relevo com uma cor por parte e linhas de camada nas paredes. Cores: Da marca, Vermelho, Grafite. Preço do hero e do login recalculado para 50 chaveiros (R$ 289,00, mesmo cálculo do app). site/assets/peca.js (vaso) continua no projeto mas não é mais usado. CACHE v99.

- HERO do site refeito (2026-11-17): duas colunas (texto à esquerda, palco à direita) no lugar do quadro-janela centralizado. Palco: chaveiro 3D grande girando, as cinco etapas acendendo em sequência, cartão de preço flutuando e selo "Orçamento enviado pelo WhatsApp" aparecendo (tudo parado com "reduzir movimento"); preço conta de zero ao abrir. Ações: o cabeçalho ficou só com "Acessar o app" (e o botão de tema); o hero tem o botão principal e o link do WhatsApp; o rodapé deixou de repetir o link do app. Imagens vizinhas: as duas telas da segunda linha de recursos com a mesma altura. Celular de tela baixa: hero numa tela só.

- Página do site melhorada com a skill impeccable (2026-11-17): "Do pedido ao preço" virou interativa (cinco etapas em botões e, ao lado, o preço se formando: material, energia, desgaste, mão de obra e embalagem, falhas e margem, com os números do mesmo cálculo do app para 50 chaveiros = R$ 289,00; percorre as etapas uma vez ao entrar na tela e descansa na última; tocar numa etapa interrompe); perguntas ganharam o contato da equipe (WhatsApp e Instagram); hero sem a linha de apoio acima do título (a regra da skill proíbe) e com o público dito na frase; telas do celular mais próximas do título e maiores. Teste novo da seção "como funciona". Aviso: PRODUCT.md ainda cita DM Sans e "Entrar em contato" nos botões obrigatórios (desatualizado: fonte é só Outfit; o cabeçalho tem só "Acessar o app" e o WhatsApp está no hero, nas perguntas e no rodapé).
