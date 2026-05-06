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
      
      ### Regras de Negócio e Estados:
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

      ### O que esperar:
      - Ao pesquisar, pode usar termos parciais (ex: "HP 440") para encontrar rapidamente modelos específicos.
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
      
      ### Como realizar um empréstimo:
      1. **Identificar a Pessoa**: Pesquise pelo Nome ou NIF. O sistema impede empréstimos a pessoas inativas.
      2. **Selecionar Equipamento**: O sistema apenas mostrará equipamentos que estejam "Disponíveis" (Rececionado ou Recondicionamento).
      3. **Formalizar**: Clique em "Concluir Empréstimo".
      
      ### Importação de Autos (Novo):
      Pode agora criar empréstimos em massa a partir de ficheiros Word (.docx) dos Autos de Entrega:
      1. Clique em **Importar Auto**.
      2. Selecione **um ou mais ficheiros** Word.
      3. O sistema analisa cada documento, identifica o **Número de Série** e o **NIF** do aluno/docente.
      4. **Regras de Importação**:
         - São permitidos equipamentos nos estados: **Escola**, **Recondicionamento** ou **Rececionado**.
         - **Verificação de Duplicados**:
           - Se o equipamento já estiver no estado **Aluno** ou **Docente**, o sistema verifica se o empréstimo ativo pertence à mesma pessoa do ficheiro.
           - Se for a mesma pessoa, o registo é marcado como "Já importado".
           - Se for uma pessoa diferente, o registo é marcado como erro ("Já possui empréstimo ativo com outra pessoa").
         - **Auto-Upload e Renomeação (Novo)**: Durante a importação, o ficheiro Word é enviado automaticamente para a ficha do empréstimo. O sistema renomeia o ficheiro para um formato padrão (\`Auto_Entrega_[SN]_[Nome].docx\`) para facilitar a organização. Se o empréstimo já existia mas não tinha o documento, o sistema anexa-o agora.
         - **Sugestões Inteligentes (Novo)**: Se um equipamento não for encontrado pelo S/N exato, o sistema tenta detetar erros de digitação (troca de letras ou números, incluindo trocas de posição como "5CG" para "5GC"). Nestes casos, o sistema sugere o equipamento mais provável e permite-lhe confirmar a correção e criar o empréstimo com um clique no resumo final.
         - **Exportação de Falhas e Relatórios (Novo)**: No final da importação, pode descarregar um ficheiro ZIP com os documentos que falharam e também um **Relatório PDF detalhado** com todo o histórico da operação para fins de arquivo ou conferência manual.
         - **Impressão em Massa de Autos (Novo)**: No final da importação, pode selecionar os empréstimos criados com sucesso e gerar um único PDF contendo todos os Autos de Entrega prontos para impressão.
         - No final, será apresentado um **Resumo da Importação** detalhando os sucessos, as sugestões e os motivos de falha para cada ficheiro.

      ### Notificações de Devolução (Novo):
      - Clique no botão **Notificações** no topo da página para aceder à ferramenta de envio em massa de pedidos de devolução.
      - Esta ferramenta é ideal para o final do ano letivo ou cessação de contratos.

      ### O que acontece no sistema:
      - O estado do equipamento muda instantaneamente para **Aluno** ou **Docente**.
      - É criado um registo histórico que não pode ser apagado, apenas encerrado via Devolução.
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
      
      ### Passos para Devolução:
      1. **Pesquisa**: Introduza o Número de Série do equipamento ou o NIF da pessoa.
      2. **Verificação de Estado**:
         - **OK (Novo)**: Utilize quando o equipamento é devolvido em perfeitas condições. O sistema marca o equipamento como **Recondicionamento** (disponível para novo empréstimo) e **não abre avaria**.
         - **A Rever (Padrão)**: O equipamento necessita de uma verificação técnica simples antes de ser disponibilizado. Abre automaticamente uma Avaria.
         - **Com Problemas / Danos**: Utilize para danos visíveis. Abre automaticamente uma Avaria e coloca o equipamento em Manutenção.
      
      ### Regras Importantes:
      - Uma devolução com problemas marca o empréstimo original como "Entregue com Danos" no histórico da pessoa.
    `
  },
  '/avarias': {
    title: 'Gestão Técnica (Avarias)',
    content: `
      Fluxo de trabalho para reparação de equipamentos.
      
      ### Filtros de Trabalho:
      - **Pendentes (Default)**: Mostra tudo o que requer atenção técnica (A Rever, Diagnosticado, Em Reparação, Aguarda Peças).
      - **Todos os Estados**: Inclui o histórico de reparações concluídas ou equipamentos abatidos.

      ### Ciclo de Vida de uma Avaria:
      1. **A Rever**: Estado inicial após registo ou devolução com danos.
      2. **Diagnosticado/Em Reparação**: Para controlo interno do técnico.
      3. **Aguarda Peças**: Quando a reparação depende de fornecedores externos.
      4. **Arranjado**: Ao selecionar este estado, o equipamento passa para **Recondicionamento**.
      5. **Inutilizado**: Se a reparação for inviável, o equipamento é marcado como "Inutilizado" e sai do inventário ativo.

      ### Importação de Avarias (Novo):
      Pode agora importar avarias em massa a partir de um ficheiro Excel (.xlsx):
      - **Identificação**: O sistema procura o equipamento pelo "Nº Série". Se não encontrar, tenta pelo "Nº Imobilizado".
      - **Filtro de Resolução**: Registos com a coluna "Resolução" preenchida como "ARRANJADO" são ignorados automaticamente.
      - **Diagnóstico**: O campo de diagnóstico é formado pela junção das colunas "Info" e "Diagnóstico resolução".
      - **Componentes**: O estado dos componentes (Ecrã, Disco, RAM, etc.) é mapeado automaticamente: "ok" vira **OK**, "x" vira **Avariado** e "?" mantém-se como **?**.
      - **Estado Inicial**: Todas as avarias importadas entram no estado **A Rever** e colocam o equipamento automaticamente em **Manutenção**.

      ### Histórico de Estados:
      - Cada avaria guarda um log com a data e o utilizador que alterou o estado, permitindo auditar o tempo de reparação.
    `
  },
  '/listas': {
    title: 'Relatórios e Exportação (Listas)',
    content: `
      Ferramenta para extração de dados e auditoria.
      
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
      
      ### Funcionalidades Principais:
      - **Entrada em Armazém**: Utilize este campo para ler o Número de Série ou Imobilizado de um equipamento que acaba de chegar ou ser devolvido ao armazém. Ao premir Enter, o equipamento é marcado como "Em armazém".
      - **Entrada com Avaria (Novo)**: Utilize quando o equipamento é devolvido com danos visíveis ou problemas técnicos. 
        - Ao premir Enter, o equipamento é marcado como "Em armazém" e o seu estado operacional passa para **Manutenção**.
        - É aberta automaticamente uma nova avaria (ou associada a uma já aberta).
        - O sistema exibe o **Número da Avaria** em destaque e o seu **Estado**.
        - Pode verificar e editar o estado dos **Componentes** (Ecrã, Disco, RAM, etc.) diretamente nesta página e clicar em "Gravar Componentes".
        - O botão **Editar** permite saltar diretamente para a ficha detalhada da avaria no módulo de Avarias.
      - **Saída de Armazém**: Utilize este campo quando um equipamento sai fisicamente do armazém (ex: para ser entregue ou para reparação externa). Ao premir Enter, o equipamento é marcado como "Fora de armazém".
      - **Pesquisa Rápida**: Permite consultar a situação atual e o histórico de um equipamento sem alterar o seu estado.

      ### Histórico e Inventário (Novo):
      - **Exportar Inventário**: Clique em **Exportar** para gerar um ficheiro Excel com todos os equipamentos que estão "Em armazém" ou "Fora de armazém". Este ficheiro é ideal para auditorias físicas.
      - **Importação em Massa**: Pode atualizar a situação de vários equipamentos de uma só vez:
        1. Prepare um ficheiro Excel com as colunas "S/N" (ou Imobilizado) e "Situação Armazém".
        2. A coluna "Situação Armazém" deve conter exatamente o texto "Em armazém" ou "Fora de armazém".
        3. Clique em **Importar** e selecione o ficheiro. O sistema atualizará os registos e criará as respetivas entradas no histórico de cada equipamento.

      ### Dica de Eficiência:
      - Os campos de leitura rápida são limpos automaticamente após cada leitura bem-sucedida, permitindo processar dezenas de equipamentos rapidamente usando um leitor de códigos de barras.
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
