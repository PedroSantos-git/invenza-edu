# Regra de Sincronização com o Git e Vercel

Sempre que forem realizadas alterações no código-fonte, nos estilos ou nas configurações da aplicação, é obrigatório realizar o commit e push para o repositório Git para despoletar uma nova compilação no Vercel.

## Instruções para a IA:
1. **Versionamento Automático**: Antes de qualquer commit, executar o script de atualização de versão (`node scripts/update-version.js`).
2. **Identidade do Git**: Utilizar sempre as configurações locais do repositório (Pedro Santos <pedro.mf.santos@outlook.pt>).
3. **Frequência**: Após concluir uma tarefa ou um conjunto de alterações lógicas coerentes.
4. **Procedimento**:
   - Executar `node scripts/update-version.js`.
   - Verificar o estado dos ficheiros (`git status`).
   - Adicionar as alterações (`git add .`).
   - Criar um commit com uma mensagem descritiva em inglês (seguindo o padrão conventional commits, ex: `feat: ...`, `fix: ...`).
   - Enviar para o servidor remoto (`git push`).
5. **Exceção**: Nunca fazer commit de ficheiros contendo segredos ou chaves de API (ex: `.env.local`), a menos que seja explicitamente solicitado pelo utilizador.

**Esta regra deve ser executada em conjunto com a atualização do manual do utilizador.**
