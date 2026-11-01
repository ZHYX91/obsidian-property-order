# Property Order

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md)

Controle as sugestões e os valores de listas nas propriedades do Obsidian.

- **[Sugestões de nomes de propriedades](#sugestões-de-nomes-de-propriedades):** fixe, oculte, agrupe e ordene nomes como `status` e `owner` ao adicionar uma propriedade.
- **[Sugestões de valores de propriedades](#sugestões-de-valores-de-propriedades):** escolha como os valores são sugeridos para cada propriedade, incluindo valores predefinidos como `todo`, `doing` e `done`.
- **[Reordenar valores de listas](#reordenar-valores-de-listas):** arraste ou use a paleta de comandos para reordenar itens ou movê-los entre propriedades compatíveis na mesma nota.

As funções são independentes. Property Order gerencia sugestões e valores de listas; ele não reorganiza os próprios campos de propriedades da nota. Requer Obsidian 1.12.7 ou superior, no computador ou dispositivo móvel.

## Sugestões de nomes de propriedades

Encontre os nomes que você usa com mais facilidade nas sugestões nativas de **Adicionar propriedade** do Obsidian.

1. Abra **Configurações → Property Order → Sugestões de nomes**.
2. Fixe os nomes frequentes no início, coloque os ocasionais no final e oculte nomes indesejados por nome exato ou regras com curingas.
3. Escolha Nome, Usados recentemente ou Notas com esta propriedade. O **agrupamento por tipo de propriedade**, opcional, agrupa as sugestões comuns por tipo do Obsidian, mantendo os nomes fixados no início e os destinados ao final nessa posição.

Por exemplo, fixe `status` e `owner` e oculte `legacy_code`. Abra **Adicionar propriedade** em uma nota para ver o resultado. Essas regras organizam os nomes que o Obsidian já oferece; fixar um nome não cria uma nova sugestão nem move um campo na nota.

Sugestões nativas antes de aplicar as regras:

![Sugestões nativas de nomes antes da personalização](../assets/property-order-key-suggestions-before.png)

As mesmas sugestões com nomes frequentes fixados e um nome indesejado oculto:

![Sugestões com status e owner fixados e legacy_code oculto](../assets/property-order-key-suggestions-after.png)

Usados recentemente corresponde à ordem das adições confirmadas, não à passagem do ponteiro ou à navegação pelas sugestões. A ordenação por nome e uso recente não percorre o cofre. A contagem de notas usa metadados em cache para contar as notas Markdown que contêm cada propriedade.

## Sugestões de valores de propriedades

Controle os valores oferecidos após selecionar uma propriedade, como `todo` e `done` para `status`. Esse recurso fica **desativado por padrão** e é independente das sugestões de nomes.

1. Abra **Configurações → Property Order → Sugestões de valores** e ative **Personalizar sugestões de valores de propriedades**.
2. Defina o comportamento padrão das propriedades sem regra ou atribua a um nome de propriedade exato: Ordem do Obsidian, Nome, Frequência de seleção, Notas com este valor, Sem sugestões ou Sugestões personalizadas.
3. Para criar uma lista reutilizável para `status`, adicione um cartão de regra **Sugestões personalizadas**, inclua `status` e use **Adicionar sugestão predefinida** para inserir `todo`, `doing` e `done`.

![Valores predefinidos de status ao editar o valor de uma propriedade](../assets/property-order-value-suggestions.png)

As sugestões personalizadas têm três seções: fixadas, comuns e no final. Valores explicitamente definidos continuam disponíveis mesmo antes de qualquer nota usá-los, e são filtrados pelo que você digita. **↔ (Mover para sugestões comuns)** remove a posição fixa, mantendo a sugestão disponível. Remover um valor predefinido das configurações não exclui conteúdo das notas.

A frequência de seleção só conta escolhas depois que o Obsidian confirma a gravação do valor. A contagem de notas mede as notas Markdown que contêm o valor, não quantas vezes você o escolheu. **Sem sugestões** continua permitindo digitação manual. Alterar apenas as regras de sugestões não edita as notas.

## Reordenar valores de listas

Reordene diretamente nas propriedades valores de listas de texto YAML de nível superior compatíveis, ou mova um valor para outra propriedade de lista na mesma nota. Arrastar entre propriedades vem ativado por padrão e pode ser desativado em **Ordem dos valores**.

![Mover um valor entre propriedades](../assets/property-order-cross-property-drag.gif)

- **Computador:** arraste um valor para a nova posição ou outra propriedade de lista compatível.
- **Dispositivo móvel:** pressione um valor por alguns instantes, escolha **Reordenar** ou **Reordenar ou mover** no menu nativo do Obsidian e arraste esse valor. Se o menu não puder ser estendido, a edição nativa continua disponível e o plugin não o substitui por uma imitação.
- **Teclado:** execute **Property Order: Reordenar valores de propriedades** pela paleta de comandos. Escolha a propriedade de origem e o valor e mova-o para cima, para baixo, para uma posição começando em 1, para o início, para o fim ou para o fim de outra propriedade. Não há atalho padrão. O comando funciona com o arraste desativado; a opção entre propriedades afeta apenas o arraste com o ponteiro.

Cada reordenação ou movimento concluído é uma única edição que pode ser desfeita. Antes de iniciar a atualização, **Escape** ou **Cancelar** deixa a nota intacta. Depois do início, aguarde a conclusão e use Desfazer no editor se necessário. O arraste oferece suporte a valores com quebra de linha, layouts da direita para a esquerda, rolagem nas bordas de painéis compatíveis e avisos de estado para leitores de tela.

**Confira os tipos antes de reordenar:** itens não textuais em listas de texto compatíveis podem virar strings, como `true` virar `"true"` e `123` virar `"123"`. O tipo do valor pode mudar; confira o resultado se tipos numéricos ou booleanos forem importantes.

**Manter o formato atual é o padrão.** Em **Ordem dos valores**, você pode escolher listas entre colchetes ou um item por linha. Mudar para colchetes pode eliminar comentários ou linhas vazias; mantenha o formato atual quando eles forem importantes. Expanda **Exemplos de formato** ao lado de **Formato da lista após reordenar** para comparar as opções.

## Instalação

### Plugins da comunidade (recomendado)

No Obsidian, abra **Configurações → Plugins da comunidade → Selecionar**, busque **Property Order** e selecione **Instalar** e **Ativar**. Você também pode abrir a [página do plugin na comunidade](https://obsidian.md/plugins?id=property-order). Use as instruções do ZIP abaixo apenas se precisar fazer a instalação manual.

### Instalação manual

Baixe `property-order-<version>.zip` na [versão mais recente](https://github.com/ZHYX91/obsidian-property-order/releases/latest) e extraia o arquivo em `Vault/.obsidian/plugins/`. O arquivo contém a pasta `property-order/` com `main.js`, `manifest.json` e `styles.css`. Recarregue o Obsidian e ative o Property Order em Plugins da comunidade.

### Atualização

Se `Vault/.obsidian/plugins/property-order/data.json` existir, faça uma cópia de segurança e preserve o arquivo. Substitua apenas `main.js`, `manifest.json` e `styles.css`; exclua `data.json` somente se quiser redefinir todas as preferências do plugin.

## Referência de configurações

Todas as versões compatíveis do Obsidian usam as mesmas quatro abas:

| Aba | O que controla |
| --- | --- |
| **Geral** | Idioma do plugin e avisos de diagnóstico opcionais. **Usar o idioma do Obsidian** usa o idioma correspondente, ou inglês se ele não estiver disponível. |
| **Ordem dos valores** | Arraste dentro da mesma propriedade e entre propriedades, além do formato da lista após reordenar. Desativar o arraste preserva a preferência independente entre propriedades. |
| **Sugestões de nomes** | Nomes fixados, no final e ocultos; ordenação por nome, uso recente e contagem de notas; agrupamento opcional por tipo; limpeza do histórico recente e campo de teste de regras. |
| **Sugestões de valores** | Comportamento padrão que exige ativação, regras por propriedade, valores predefinidos e limpeza dos contadores de seleção. |

**Ordem das propriedades nestas configurações** organiza somente as propriedades nos cartões de regras e no editor personalizado. Não altera os campos das notas nem a ordem das sugestões de valores.

A interface e o README oferecem inglês, chinês simplificado, chinês tradicional, alemão, francês, espanhol, português do Brasil, russo, japonês, coreano, vietnamita e árabe.

## Compatibilidade e limitações

- O arraste de valores oferece suporte a linhas comuns de propriedades YAML de nível superior que o Obsidian mostra como listas de texto. Não há suporte a documentos inteiros como mapeamentos `{ ... }`, listas de objetos, listas aninhadas, sequências entre colchetes em várias linhas, arraste de linhas no modo fonte ou movimentos entre arquivos.
- Valores vazios ou escalares podem participar quando o Obsidian identifica a propriedade como lista. Algumas linhas com incompatibilidade de tipo também funcionam quando cada valor é claro. Linhas ambíguas com valores mistos são tratadas com cautela e podem aceitar somente acréscimos ao final.
- O comando de teclado precisa de um painel de propriedades visível e compatível no painel Markdown ativo. Se o arquivo ou os valores mudarem com a caixa de diálogo aberta, reabra o comando.
- Valores predefinidos aparecem apenas durante a edição de valores nas propriedades. Se não houver uma janela nativa de sugestões, o plugin pode mostrá-los ao lado da entrada. Se não puder identificar o editor ou a interface nativa de sugestões com segurança, a digitação normal ou as sugestões nativas continuam disponíveis.
- A reordenação verifica o YAML antes de pedir ao Obsidian para salvar. Conteúdo não compatível ou conflitante fica intacto. Selecionar ou editar uma propriedade no Obsidian pode alterar a nota; configurar apenas as sugestões não altera.

## Privacidade e segurança

Property Order funciona localmente. Não exige conta, não envia conteúdo das notas e não chama serviços remotos. Reordenar ou mover valores altera apenas as propriedades envolvidas.

A contagem de notas usa metadados de frontmatter em cache em vez de ler o corpo de cada nota. O histórico recente de nomes (até 100) e os contadores confirmados de seleção de valores ficam apenas no armazenamento local deste cofre no dispositivo atual, separados de `data.json`. Não são sincronizados e podem ser apagados nas configurações. Passar o ponteiro, navegar, cancelar e fazer edições não confirmadas não os atualiza.

## Desenvolvimento e suporte

Use Node.js 24.19.0 e npm 11.17.0. Instale as versões das dependências registradas em `package-lock.json` e execute todas as verificações do repositório:

```bash
npm ci
npm run check
```

### Documentação

- [Requisitos do produto (English)](../product-requirements.en.md)
- [Especificação de experiência do usuário (English)](../ux-spec.en.md)
- [Arquitetura (English)](../architecture.en.md)
- [Estratégia de testes (English)](../testing-strategy.en.md)
- [Histórico de alterações (English)](../../CHANGELOG.md)
- [Guia de contribuição (English)](../../CONTRIBUTING.md)
- [Política de segurança (English)](../../SECURITY.md)

- [Perguntas e respostas](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/q-a): dúvidas sobre uso e configuração.
- [Ideias](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/ideas): ideias iniciais para recursos e formas de uso.
- [Compartilhe seu trabalho](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/show-and-tell): dicas, formas de uso e implementações de referência.
- Use os [formulários de issues do GitHub](https://github.com/ZHYX91/obsidian-property-order/issues/new/choose) para relatar erros reproduzíveis e solicitar recursos específicos.
- Relate vulnerabilidades de forma privada seguindo a [política de segurança](https://github.com/ZHYX91/obsidian-property-order/security/policy) do repositório.

Antes de publicar, remova caminhos privados do cofre, conteúdo de notas, valores YAML e credenciais.

## Licença

[MIT](../../LICENSE) © ZhengYX
