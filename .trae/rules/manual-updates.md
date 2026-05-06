# Regra de Atualização do Manual do Utilizador

Sempre que forem realizadas alterações nas funcionalidades, fluxos de trabalho ou regras de negócio da aplicação, o manual do utilizador deve ser atualizado obrigatoriamente.

## Instruções para a IA:
1. **Localização do Manual**: O conteúdo do manual encontra-se em `src/docs/manual_content.js`.
2. **Contexto**: O manual está dividido por rotas (ex: `/equipamentos`, `/pessoas`).
3. **Procedimento**:
   - Após modificar qualquer componente ou página, verifica se a funcionalidade descrita no manual ainda é válida.
   - Se houver uma nova funcionalidade, adiciona-a à secção correspondente no manual.
   - Se uma regra de negócio mudar (ex: estados de equipamentos), reflete essa mudança na secção correspondente.
   - Mantém o tom educativo, prático e focado no utilizador final.
4. **Formato**: O conteúdo utiliza Markdown básico dentro das strings do objeto `MANUAL_CONTENT`.

**NUNCA entregues uma tarefa de alteração de funcionalidades sem verificar e atualizar este manual.**
