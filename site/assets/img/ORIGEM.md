# Origem das imagens

Todas as imagens desta pasta são **capturas reais do aplicativo** (e dos arquivos que ele mesmo gera), feitas com **dados fictícios**.

- **Como foram feitas:** `node scripts/capturar-site.cjs` roda o aplicativo local com um banco de mentira (nenhum dado real, nenhuma conta real) e faz o orçamento de uma peça de demonstração: um vaso decorativo (STL gerado pelo próprio script), 12 unidades, para a cliente fictícia "Marina Souza" (marina@exemplo.com, telefone 90000-0000).
- **Arquivos:**
  - `app-pedido.jpg`, `app-preco.jpg`, `app-envio.jpg`: telas do celular (390 × 844, tela 2×).
  - `app-computador.jpg`: tela do computador (janela de 960 px, cortada antes do campo de desconto).
  - `orcamento-whatsapp.png`: a imagem do orçamento que o aplicativo gera para o cliente.
  - `peca-3d.png`: a imagem da peça em 3D que o aplicativo gera.
- **Privacidade:** a imagem do orçamento é **recortada** (total, cliente e itens) para não publicar a chave Pix nem o e-mail do negócio, que o aplicativo imprime no rodapé do orçamento completo. As demais capturas não mostram dado real do negócio.
- **Data da geração:** 16/11/2026 (a data impressa no orçamento é a do dia da captura).
- Para atualizar as imagens depois de mudar o aplicativo, rode o script de novo.

- `app-etapas.jpg`: recorte da barra de etapas de `app-computador.jpg`.
- `peca-3d-800.png`: `peca-3d.png` em 800 px de largura (celular).
- `compartilhar.jpg`: captura da primeira tela do site (imagem de compartilhamento).

- `app-salvos.jpg`, `app-clientes.jpg`, `app-painel.jpg`, `app-impressoes.jpg` (computador) e `app-cel-clientes.jpg`, `app-cel-painel.jpg`, `app-cel-impressoes.jpg` (celular): telas de gestão do aplicativo com dados fictícios (clientes, orçamentos e impressões inventados), geradas por `node scripts/capturar-negocio.cjs`.

- O quadro de demonstração do login mostra o símbolo de cubos da logo (`site/app/img/logo-trid-simbolo.png`).
