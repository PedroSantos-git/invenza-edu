/**
 * MANUAL DO UTILIZADOR - INVENZA EDU
 * 
 * Este ficheiro contém o conteúdo detalhado da ajuda do utilizador.
 * INSTRUÇÃO PARA IA: Sempre que houver alterações nas funcionalidades, fluxos ou regras de negócio
 * nas páginas da aplicação, esta ajuda DEVE ser atualizada obrigatoriamente para refletir essas mudanças.
 */

export const MANUAL_CONTENT = {
  '/': {
    title: 'Dashboard (Visão Geral)',
    content: `
      O Dashboard é o centro de comando da aplicação, oferecendo uma visão analítica e em tempo real de todo o parque informático escolar.
      
      ### O que pode encontrar:
      - **Indicadores de Desempenho (KPIs)**:
        - **Disponíveis**: Equipamentos prontos para entrega imediata.
        - **Atribuídos**: Material que está atualmente com Alunos, Docentes ou na Escola.
        - **Em Manutenção**: Equipamentos com avarias ativas ou em processo de reparação.
        - **Outros**: Equipamentos que foram retirados de circulação (Inutilizados, Extraviados ou Substituídos).
      - **Gráficos Dinâmicos**:
        - **Histórico de Movimentação**: Comparação mensal entre empréstimos realizados e devoluções recebidas.
        - **Tendência de Avarias**: Visualização de picos de problemas técnicos ao longo do ano letivo.
        - **Distribuição de Avarias por Componente**: Gráfico circular que ajuda a identificar problemas crónicos em modelos específicos (ex: baterias viciadas ou ecrãs partidos).

      ### Como interpretar os dados:
      - Use o Dashboard para planear compras de material se o indicador "Disponíveis" estiver baixo.
      - Identifique falhas recorrentes em componentes para acionar garantias com fornecedores.
    `
  },
  '/equipamentos': {
    title: 'Gestão de Inventário (Equipamentos)',
    content: `
      Esta página é onde regista e controla cada unidade física de hardware.
      
      ### Gestão de Conjuntos (Kits) por Imobilizado (Novo):
      O sistema agora agrupa automaticamente equipamentos que partilham o mesmo **Número de Imobilizado**.
      - **Equipamento Principal**: Se um conjunto tiver um item do tipo "PC...", este será considerado o item principal (líder) do kit.
      - **Agrupamento Visual**: Na listagem, verá apenas o equipamento principal. Um indicador azul (ex: \`+ 2 item(ns)\`) mostra que existem acessórios (como Hotspots ou Malas) associados a esse imobilizado.
      - **Pesquisa Inteligente**: Se pesquisar pelo Número de Série de um acessório, o sistema encontrará o conjunto correspondente.

      ### Regras de Negócio e Estados:
      - **Sincronização de Conjuntos**: Qualquer alteração de estado (Empréstimo, Devolução, Avaria) num item do kit reflete-se automaticamente em todos os outros itens com o mesmo imobilizado.
      - **Gestão Automática de Estados**: Por questões de integridade, não pode alterar manualmente o estado de um equipamento para **Aluno**, **Docente** ou **Manutenção**.
        - O estado muda para **Aluno/Docente** quando formaliza um Empréstimo.
        - O estado muda para **Manutenção** quando regista uma Avaria ou recebe uma Devolução com problemas.
      - **Recondicionamento**: Quando uma avaria é marcada como "Arranjada", o equipamento entra automaticamente em **Recondicionamento** para indicar que deve ser limpo/preparado antes de novo empréstimo.
      - **Controlo de Armazém**: Além do estado operacional, cada equipamento tem uma situação de armazém: **Desconhecido**, **Em armazém** ou **Fora de armazém**. Isto permite saber fisicamente onde está o material, independentemente de estar atribuído ou não.

      ### Procedimentos Passo-a-Passo:
      1. **Registar Novo Material**: Clique em "Novo Equipamento", preencha a Marca, Modelo e, crucialmente, o Número de Série (S/N).
      2. **Criar via Foto AI (Novo)**: Clique em "Criar via Foto AI" para tirar ou carregar uma foto da etiqueta do equipamento. A IA extrairá automaticamente o **Número de Série**, a **Designação** e detalhes técnicos (CPU, RAM, etc.) para as Notas. A foto será anexada automaticamente aos documentos do equipamento e o estado será definido como **Rececionado** e o tipo como **NP**.
      3. **Importação em Massa**: Se tiver uma lista Excel, use o botão "Importar". O sistema deteta duplicados pelo Número de Série.
      4. **Uso do Smart Scanner**: Em qualquer campo (especialmente S/N), clique no ícone da câmara para ler o texto diretamente de uma etiqueta física.
      4. **Anexar Documentos**: Na edição de um equipamento, pode carregar faturas, termos de garantia ou fotos do estado físico.
      5. **Filtrar por Armazém**: Utilize o novo filtro de armazém para listar rapidamente apenas o material que está fisicamente na escola.
    `
  },
  '/pessoas': {
    title: 'Gestão de Utilizadores (Pessoas)',
    content: `
      Base de dados de todos os potenciais beneficiários de equipamentos (Alunos e Professores).
      
      ### Controlo de Atividade (Novo):
      - **Pessoas Ativas**: Apenas pessoas ativas devem ter equipamentos atribuídos.
      - **Pessoas Inativas**: Quando um aluno sai da escola ou um professor termina contrato, deve ser marcado como inativo.
      - **Filtro de Atividade**: Na edição de cada pessoa, pode agora alternar manualmente o campo "Ativa".

      ### Verificação de Pessoas Ativas (Ferramenta Avançada):
      Esta ferramenta serve para limpar a sua base de dados no início de cada ano ou período:
      1. Clique em **Verificar Ativas**.
      2. Carregue um ficheiro Excel oficial (ex: do Inovar ou JNE).
      3. O sistema compara os NIFs:
         - Se a pessoa está no ficheiro, mantém-se **Ativa**.
         - Se a pessoa NÃO está no ficheiro, é movida para a lista de **Pendentes**.
      4. No final, as pessoas que restarem na lista pendente podem ser marcadas em massa como **Inativas**.

      ### Comunicação e Histórico (Novo):
      - **Envio de Emails**: Pode enviar emails diretamente da plataforma clicando no ícone da carta. Se for um Aluno, o sistema pode enviar CC para o Encarregado de Educação se o email deste estiver registado.
      - **Histórico de Emails**: Ao clicar numa pessoa para ver os seus detalhes, existe agora um separador **Emails** que mostra todos os emails enviados a essa pessoa através do sistema.
      - **Conteúdo e Estado**: No histórico, pode ver se o email foi enviado com sucesso ou se houve erro, e clicar no ícone do olho para visualizar o conteúdo exato que foi enviado, incluindo a data e hora.
    `
  },
  '/emprestimos': {
    title: 'Realização de Empréstimos',
    content: `
      Módulo para atribuir equipamentos a pessoas.
      
      ### Empréstimo de Conjuntos (Novo):
      Ao selecionar um PC para empréstimo, o sistema deteta automaticamente todos os acessórios associados ao mesmo **Número de Imobilizado** (ex: Hotspot, Mala).
      - **Pesquisa por Imobilizado**: Pode agora pesquisar diretamente pelo Número de Imobilizado na lista de empréstimos.
      - **Agrupamento Visual**: A lista de empréstimos agrupa agora os itens por conjunto, mostrando o PC como item principal.
      - **Detalhe do Conjunto**: Ao clicar num empréstimo, existe um novo separador **"Conjunto"** que lista detalhadamente todos os equipamentos (S/N, Estado, Armazém) que fazem parte desse imobilizado.
      - Todos os itens do conjunto mudam automaticamente para o estado do beneficiário (**Aluno** ou **Docente**).
      - O Auto de Entrega gerado incluirá a menção ao conjunto detetado.

      ### Como realizar um empréstimo:
      1. **Identificar a Pessoa**: Pesquise pelo Nome ou NIF. O sistema impede empréstimos a pessoas inativas.
      2. **Selecionar Equipamento**: O sistema apenas mostrará equipamentos que estejam "Disponíveis" (Rececionado ou Recondicionamento). No caso de conjuntos, selecione o PC correspondente.
      3. **Formalizar**: Clique em "Concluir Empréstimo".
    `
  },
  '/notificacoes-devolucao': {
    title: 'Notificações de Devolução',
    content: `
      Esta ferramenta permite gerir o envio em massa de solicitações de devolução de equipamentos.
      
      ### Filtros Disponíveis:
      - **Estado da Pessoa**: Filtrar por pessoas Ativas, Inativas ou Todas.
      - **Email**: 
        - **Com Email**: Pessoas que têm pelo menos um email registado.
        - **Com Email Externo**: Pessoas que têm um email que não termina em @djoaoii.com.
        - **Sem Email**: Pessoas sem qualquer contacto eletrónico.
      - **Turma**: Selecionar uma turma específica de alunos com equipamentos.
      - **Tipo**: Filtrar entre Alunos ou Docentes.
      - **Pesquisa Livre**: Pesquisar por Nome, NIF, Processo ou dados do Equipamento.

      ### Como enviar notificações:
      1. Aplique os filtros desejados para obter a lista de pessoas.
      2. Selecione os empréstimos utilizando as caixas de seleção (ou selecione todos no cabeçalho).
      3. Defina o **Motivo da Solicitação** (ex: Fim do ano letivo).
      4. Clique em **Enviar Notificações**. O sistema enviará um email individual para cada pessoa (e CC para o EE no caso de alunos).
    `
  },
  '/devolucoes': {
    title: 'Receção de Equipamentos (Devoluções)',
    content: `
      Processo crítico de retorno de material ao stock.
      
      ### Devolução de Conjuntos (Novo):
      Ao ler o Número de Série ou Imobilizado de qualquer item de um conjunto, o sistema identifica automaticamente o kit completo.
      - **Ação em Bloco**: Ao processar a devolução, todos os itens do imobilizado são devolvidos em simultâneo.
      - **Sincronização de Estado**: O novo estado operacional (Recondicionamento ou Manutenção) é aplicado a todos os componentes do kit.
      - **Registo de Avarias**: Se selecionar "Com Problemas", o sistema abre uma avaria para cada item do conjunto para permitir um rastreio técnico individual, mas vinculadas ao mesmo processo de devolução.

      ### Passos para Devolução:
      1. **Pesquisa**: Introduza o Número de Série do equipamento ou o NIF da pessoa.
      2. **Verificação de Estado**:
         - **OK**: Utilize quando o conjunto é devolvido em perfeitas condições. O sistema marca os equipamentos como **Recondicionamento** (disponível para novo empréstimo) e **não abre avaria**.
         - **Com Problemas / Danos**: Utilize para danos visíveis. Abre automaticamente Avarias e coloca o conjunto em Manutenção.
      
      ### Regras Importantes:
      - Uma devolução com problemas marca o empréstimo original como "Entregue com Danos" no histórico da pessoa.
    `
  },
  '/avarias': {
    title: 'Gestão Técnica (Avarias)',
    content: `
      Fluxo de trabalho para reparação de equipamentos.
      
      ### Visualização Agrupada por Conjunto (Novo):
      No ecrã de listagem, as avarias são agora agrupadas pelo **Número de Imobilizado**.
      - Verá apenas uma entrada principal (geralmente o PC) com a indicação de que se trata de um **CONJUNTO**.
      - Ao resolver ou alterar o estado da avaria principal, o técnico deve estar ciente de que todos os itens do kit estão em processo de manutenção.

      ### Filtros de Trabalho:
      - **Pendentes (Default)**: Mostra tudo o que requer atenção técnica (A Rever, Diagnosticado, Em Reparação, Aguarda Peças).
      - **Todos os Estados**: Inclui o histórico de reparações concluídas ou equipamentos abatidos.
    `
  },
  '/listas': {
    title: 'Relatórios e Exportação (Listas)',
    content: `
      Ferramenta para extração de dados e auditoria.
      
      ### Auditoria de Conjuntos (Novo):
      Esta nova ferramenta permite detetar e corrigir erros de integridade na base de dados relacionados com os kits:
      - **Regra 'Substituido'**: Equipamentos com o estado "Substituido" são isolados. Eles só formam kits com outros equipamentos "Substituido" do mesmo imobilizado, garantindo que material de substituição não se misture com o inventário ativo.
      - **Deteção de Discrepâncias**: O sistema identifica todos os conjuntos (mesmo imobilizado) onde os equipamentos têm estados diferentes. Kits com mais de 2 itens aparecem no topo da lista para priorização.
      - **Sincronização Completa de Registos**: Ao corrigir um conjunto (Seguir Mestre ou Slave), o sistema não apenas atualiza o estado do equipamento, mas também **cria automaticamente os registos necessários** (Empréstimos ou Avarias) para que o histórico coincida com o estado final, copiando datas e informações do item de origem.
      - **Botões de Ação**:
        - **Seguir Mestre (PC)**: Aplica o estado e cria os registos baseados no PC do conjunto.
        - **Seguir Slave (Hotspot)**: Aplica o estado e cria os registos baseados num acessório (ex: Hotspot).
      - **Correção em Massa**: Pode selecionar vários conjuntos e aplicar a correção baseada no Mestre ou no Slave para todos em simultâneo.

      ### Relatórios Disponíveis:
      - **Empréstimos a Pessoas Inativas**: O relatório mais importante. Mostra quem já não pertence à escola mas ainda detém material. Útil para processos de recuperação.
        - **Novo Filtro de Email**: Pode agora filtrar por "Sem email*" para identificar pessoas que não têm um email institucional (@djoaoii.com) registado nem no seu contacto pessoal nem no do Encarregado de Educação.
      - **Equipamentos por Estado**: Listagem total para inventário físico.
      - **Relatório de Avarias**: Listagem técnica para controlo de custos e intervenções.
      - **Equipamentos / Armazém**: Listagem focada na localização física do material (Em armazém, Fora de armazém ou Desconhecido).

      ### Funcionalidades de Exportação:
      - **Excel**: Gera um ficheiro formatado com cabeçalhos e colunas ajustadas.
      - **PDF**: Documento profissional em formato paisagem (A4) pronto para impressão.
      
      ### Filtros e Ordenação:
      - **IMPORTANTE**: O sistema exporta exatamente o que vê no ecrã. Se ordenar por "Nome" ou filtrar por "Pendentes", o PDF/Excel respeitará essa ordem e filtro.
      - Os filtros aplicados aparecem escritos no cabeçalho do documento exportado.
    `
  },
  '/armazem': {
    title: 'Controlo de Armazém',
    content: `
      Módulo dedicado ao controlo físico de entrada e saída de equipamentos do armazém da escola.
      
      ### Movimentação de Conjuntos (Novo):
      O armazém é agora inteligente na deteção de kits.
      - **Leitura de S/N ou Imobilizado**: Ao ler qualquer item de um conjunto, o sistema identifica todos os "irmãos" que partilham o mesmo número de imobilizado.
      - **Ação em Bloco**: Ao confirmar uma **Entrada**, **Saída** ou **Entrada com Avaria**, a ação é aplicada automaticamente a todos os itens do conjunto.
      - **Feedback Visual**: O sistema informa quantos itens foram processados no conjunto (ex: "Conjunto de 3 itens processado com sucesso").

      ### Funcionalidades Principais:
      1. **Entrada em Armazém**: Regista a chegada física. O conjunto passa para "Em armazém".
      2. **Entrada com Avaria**: Regista a chegada com danos. O conjunto passa para "Em armazém" e o estado operacional de todos os itens muda para **Manutenção**.
      3. **Saída de Armazém**: Regista a saída física para o utilizador ou reparação externa.
    `
  },
  '/pedidos': {
    title: 'Gestão de Pedidos',
    content: `
      Registo de solicitações que ainda não são empréstimos ou avarias formais.
      - Utilize este módulo para filas de espera ou pedidos de esclarecimento.
      - Um pedido pode ser "Resolvido" ou cancelado.
    `
  },
  '/utilizadores': {
    title: 'Gestão de Acessos',
    content: `
      Administração de quem pode utilizar o sistema.
      - **Administrador**: Acesso total, incluindo configurações e gestão de utilizadores.
      - **Staff**: Acesso operacional (Equipamentos, Pessoas, Empréstimos, etc.), mas sem acesso a configurações críticas.
    `
  },
  '/configuracoes': {
    title: 'Configurações do Sistema',
    content: `
      Área reservada para personalização da plataforma.
      
      ### Backups (Novo):
      Esta nova secção permite exportar e importar dados da base de dados em formato Excel:
      
      **Exportar Dados**:
      - Selecione uma ou várias tabelas para exportar.
      - Clique em "Exportar Selecionadas / Todas" para gerar um ficheiro Excel com todas as tabelas selecionadas (ou todas, se nenhuma for selecionada).
      - Cada tabela será uma folha (sheet) separada no ficheiro Excel.
      - Pode também exportar uma única tabela clicando no ícone de download ao lado do nome da tabela.
      
      **Importar Dados**:
      - Selecione um ou vários ficheiros Excel para importar.
      - O sistema identificará as tabelas presentes nos ficheiros com base no nome das folhas (sheets).
      - Ao importar, o sistema apaga todos os dados das tabelas correspondentes e importa os novos dados.
      - A importação é feita pela ordem correta para manter a integridade referencial (ex: Tipos de Equipamento antes de Equipamentos, Equipamentos antes de Empréstimos).
      - Clique em "Importar" para iniciar o processo (será pedido uma confirmação).
      
      Outras secções disponíveis:
      - **Horários**: Definição do horário de atendimento que aparece nos emails.
      - **Templates**: Gestão de textos e modelos de documentos.
      - **Segurança**: Opções avançadas de sistema.
    `
  },
  'geral': {
    title: 'Conceitos Gerais e Atalhos',
    content: `
      ### Instalação (PWA):
      Este sistema pode ser instalado como uma aplicação nativa:
      - **No iPhone**: No Safari, clique em "Partilhar" > "Adicionar ao Ecrã Principal".
      - **No Mac/PC**: No Chrome ou Edge, clique no ícone de instalação na barra de endereço.

      ### Smart Scanner:
      Sempre que vir o ícone de uma câmara junto a um campo de texto, pode clicar para abrir a câmara do seu dispositivo e ler o texto automaticamente. Isto é ideal para números de série ou nomes longos.

      ### Ativação de Pessoas:
      Lembre-se que o sistema é proativo: se importar um equipamento que está com alguém desconhecido, o sistema cria essa pessoa mas marca-a como **Inativa** para que saiba que precisa de validar os dados desse utilizador mais tarde.
    `
  }
};
