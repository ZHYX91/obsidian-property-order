# Property Order

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md)

O Property Order permite reordenar valores de listas no painel Propriedades do Obsidian arrastando ou usando a paleta de comandos e escolher quais nomes e valores de propriedades são sugeridos enquanto você digita. Ele ordena valores de listas e sugestões de digitação, mas não reorganiza os campos de propriedades da nota.

## Demonstração

No computador, arraste um item de uma propriedade de lista para outra na mesma nota:

![Mover um valor entre propriedades](../assets/property-order-cross-property-drag.gif)

O arraste entre propriedades vem ativado e pode ser desativado nas configurações de **Ordem dos valores**.

## Recursos

- Reordene os valores de uma lista YAML de nível superior compatível arrastando ou usando a paleta de comandos.
- Mova valores entre propriedades de lista compatíveis na mesma nota. O arraste entre propriedades vem ativado e pode ser desativado.
- Quando o Obsidian trata um valor vazio ou um valor único como uma propriedade de lista, o Property Order também permite mover valores para ela ou para fora dela com segurança. Itens que não são texto são convertidos em texto usando a escrita original do YAML.
- Mantenha o formato atual da lista de cada propriedade ou escolha listas entre colchetes ou com um item por linha. Cada reordenação ou movimento concluído gera uma única edição que pode ser desfeita.
- O arraste funciona com itens que quebram em várias linhas na interface e com layouts da direita para a esquerda (RTL). Ele pode rolar áreas compatíveis do painel Propriedades quando o ponteiro se aproxima da borda e anuncia mudanças de estado aos leitores de tela.
- Personalize as sugestões nativas de nomes de propriedades: fixe nomes, coloque-os no final, oculte-os ou ordene-os por nome, uso recente ou quantidade de notas, com agrupamento por tipo de propriedade opcional.
- Se desejar, configure as sugestões de valores de cada propriedade: ordem do Obsidian, ordem por nome, frequência de seleções confirmadas, quantidade de notas, sem sugestões ou sugestões personalizadas.
- As sugestões personalizadas podem ficar fixadas, na seção de sugestões comuns ou no final. Valores predefinidos continuam disponíveis mesmo quando nenhuma nota os utiliza.
- O histórico de nomes usados recentemente e as contagens de seleção de valores só mudam depois que o Obsidian confirma a edição. Passar o ponteiro, navegar pelas opções, cancelar ou deixar uma edição sem confirmação não conta.
- Quando o Property Order não consegue interpretar o YAML ou a interface de sugestões do Obsidian com segurança, ele mantém a nota ou a interface nativa sem alterações.

## Requisitos e compatibilidade

- Obsidian 1.12.7 ou posterior.
- No computador, os valores podem ser arrastados diretamente. No celular, é preciso escolher uma ação no menu nativo de toque longo do Obsidian antes de arrastar.
- Para arrastar valores, o Property Order funciona apenas com propriedades YAML de nível superior que o Obsidian identifica como listas de texto. A personalização das sugestões de valores normalmente reordena as opções do Obsidian; o modo personalizado também pode oferecer valores predefinidos no mesmo editor de propriedades. Os limites detalhados estão descritos abaixo.

## Instalação

### Plugins da comunidade (recomendado)

No Obsidian, abra **Configurações → Plugins da comunidade → Selecionar**, busque **Property Order** e selecione **Instalar** e **Ativar**. Você também pode abrir a [página do plugin na comunidade](https://obsidian.md/plugins?id=property-order). Use as instruções do ZIP abaixo apenas se precisar fazer a instalação manual.

### Instalação manual

Baixe `property-order-<version>.zip` na [versão mais recente](https://github.com/ZHYX91/obsidian-property-order/releases/latest) e extraia o arquivo em `Vault/.obsidian/plugins/`. O arquivo contém a pasta `property-order/` com `main.js`, `manifest.json` e `styles.css`. Recarregue o Obsidian e ative o Property Order em Plugins da comunidade.

### Atualização

Se `Vault/.obsidian/plugins/property-order/data.json` existir, faça uma cópia de segurança e preserve o arquivo. Substitua apenas `main.js`, `manifest.json` e `styles.css`; exclua `data.json` somente se quiser redefinir todas as preferências do plugin.

## Uso

1. Ative o Property Order em **Configurações → Plugins da comunidade**.
2. Abra uma nota com propriedades de lista YAML de nível superior no painel Propriedades do Obsidian.
3. No computador, arraste um valor diretamente. No celular, mantenha um valor pressionado, selecione **Reordenar** (ou **Reordenar ou mover**) e arraste esse valor.
4. Configure **Sugestões de nomes** para os nomes de propriedades. Se desejar, ative **Sugestões de valores** para ordenar as opções de valores já oferecidas pelo Obsidian, com uma configuração padrão e regras por propriedade.

**Pelo teclado:** Abra a paleta de comandos do Obsidian e execute **Property Order: Reordenar valores de propriedades**. Selecione a propriedade de origem e o valor, depois escolha **Mover para cima**, **Mover para baixo** ou **Mover para a propriedade**. Ao mover para outra propriedade, o valor é acrescentado ao final. O comando funciona mesmo com o arraste desativado; a opção de arrastar entre propriedades afeta apenas o ponteiro. Antes de iniciar o movimento, **Escape** ou **Cancelar** mantém a nota intacta. Após o início, espere a conclusão; você pode desfazer o movimento no editor. Nenhum atalho vem definido.

Em listas longas, informe uma posição a partir de 1 e escolha **Mover para a posição**, ou use **Mover para o início** / **Mover para o fim**. Cada movimento concluído pode ser desfeito em uma única etapa.

**Antes de mudar a ordem:** Reordenar ou mover valores em uma lista de texto compatível pode transformar valores YAML que não são texto em strings: `true` vira `"true"` e `123` vira `"123"`. O tipo do valor pode mudar; confira o resultado se esses tipos forem importantes.

**No celular:** só é possível arrastar quando o menu nativo de toque longo do Obsidian mostra **Reordenar** ou **Reordenar ou mover**. Se o menu não puder ser estendido, o plugin não cria um menu parecido; a edição nativa continua disponível.

**Qual configuração de sugestões usar?** Ao adicionar uma nova propriedade e digitar seu **nome**, **Sugestões de nomes** controla se nomes como `status` ou `owner` ficam fixados, ocultos ou em outra ordem. Depois que você escolhe `status` e edita seu **valor**, **Sugestões de valores** controla as opções existentes, como `todo` ou `done`, e pode incluir valores predefinidos por você. As sugestões de valores vêm desativadas. Alterar as configurações de sugestões não modifica as notas. Selecionar ou editar uma propriedade no Obsidian pode modificar a nota.

**Exemplo: adicionar valores frequentes para `status`.** Abra **Sugestões de valores**, ative **Personalizar sugestões de valores de propriedades** e adicione um cartão de regras do tipo **Sugestões personalizadas**. Adicione `status` a esse cartão. Em **Sugestões fixadas**, digite `todo` e selecione **Adicionar sugestão predefinida**; repita para `doing` e `done`. Esses valores serão oferecidos ao editar `status`, filtrados pelo que você digitar. Para incluir uma sugestão predefinida na ordenação comum, clique em **↔ (Mover para sugestões comuns)** ao lado dela.

## Configurações

Todas as versões compatíveis do Obsidian usam as mesmas quatro abas de configurações:

- **Geral** controla o idioma do plugin e os avisos opcionais de diagnóstico. A interface e o README estão disponíveis em inglês, chinês simplificado, chinês tradicional, alemão, francês, espanhol, português do Brasil, russo, japonês, coreano, vietnamita e árabe. **Usar o idioma do Obsidian** seleciona o idioma correspondente ou o inglês quando esse idioma não está disponível.
- **Ordem dos valores** controla o formato das listas após reordenar e o arraste dentro de uma propriedade ou entre propriedades. Desativar o arraste de valores não apaga a preferência separada de arraste entre propriedades. Forçar uma lista com um item por linha para o formato entre colchetes pode eliminar comentários ou linhas vazias. Preserve o formato original quando necessário. Expanda **Exemplos de formato** ao lado de **Formato da lista após reordenar** para comparar a mesma entrada nos três formatos antes de escolher.
- **Sugestões de nomes** controla os nomes de propriedades fixados, colocados no final ou ocultos, além das ordenações **Nome**, **Usados recentemente** e **Notas com esta propriedade**. O agrupamento por tipo de propriedade opcional organiza as sugestões comuns em **Texto**, **Lista**, **Número**, **Caixa de seleção**, **Data**, **Data e hora**, **Tags** e **Automático / não especificado**; a ordenação escolhida continua valendo dentro de cada grupo.
- A personalização em **Sugestões de valores** precisa ser ativada. Propriedades sem uma regra própria usam o comportamento padrão, enquanto nomes exatos de propriedades podem ser atribuídos a **Nome**, **Frequência de seleção**, **Notas com este valor**, **Ordem do Obsidian**, **Sem sugestões** ou **Sugestões personalizadas**.
- As regras de sugestões personalizadas usam as seções **Sugestões fixadas**, **Sugestões comuns** e **Sugestões no final**. Os valores predefinidos podem ser digitados diretamente e continuam disponíveis para seleção mesmo antes de aparecerem em alguma nota.
- **Ordem das propriedades nestas configurações** muda apenas a ordem das propriedades nos cartões de regras e no editor de sugestões personalizadas. Não reordena propriedades nas notas nem suas sugestões de valores.
- O histórico de nomes de propriedades usados recentemente tem um limite de 100 nomes no dispositivo atual. A frequência de seleção também é local ao dispositivo. Ambos ficam separados de `data.json`, não são sincronizados e podem ser limpos nas configurações.

## Limitações

- O frontmatter deve usar linhas de propriedades comuns no nível superior. Não é possível arrastar valores quando todo o documento YAML está entre `{ ... }`.
- O arraste de valores funciona apenas com propriedades YAML de nível superior que o Obsidian apresenta como listas de texto.
- Listas de objetos, listas aninhadas, listas entre colchetes distribuídas em várias linhas, arraste de linhas no modo de código-fonte e movimento entre arquivos não são compatíveis.
- No celular, primeiro selecione **Reordenar** ou **Reordenar ou mover** no menu nativo de toque longo do Obsidian e depois arraste o valor. As ações nativas, como Editar, Remover da lista e Copiar, continuam disponíveis.
- Algumas linhas com incompatibilidade de tipo podem participar quando o Obsidian as identifica claramente como propriedades de lista. Linhas com valores mistos ambíguos são tratadas com cautela e podem permitir apenas adicionar um valor ao final.
- As sugestões predefinidas personalizadas só se aplicam à edição de valores no painel Propriedades. Se o Obsidian não mostrar um menu de sugestões, o Property Order pode exibir as predefinições ao lado do campo. Se não conseguir identificar o campo com segurança, você pode continuar digitando normalmente.
- Converter listas com hífens em listas entre colchetes pode remover comentários ou linhas em branco que o formato entre colchetes não consegue representar.
- O comando de teclado precisa de um painel Propriedades visível e compatível no painel Markdown ativo. Se o arquivo ou os valores mudarem com o diálogo aberto, abra o comando novamente.

## Privacidade e segurança

O Property Order funciona localmente. Não exige uma conta, não envia o conteúdo das notas e não acessa serviços remotos.

Reordenar ou mover valores altera apenas as propriedades envolvidas. O plugin confere o resultado antes de pedir ao Obsidian que salve a nota. Ele não grava estruturas que não consegue tratar com segurança.

Para ordenar pela quantidade de notas, o Property Order lista os arquivos Markdown e consulta os metadados YAML já armazenados em cache; não lê o corpo de todas as notas. O histórico de nomes de propriedades usados recentemente e as contagens de seleções confirmadas de valores ficam apenas no armazenamento local do Obsidian para cada cofre, no dispositivo atual, separados de `data.json`, e podem ser limpos nas configurações.

## Desenvolvimento

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

## Suporte

- [Perguntas e respostas](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/q-a): dúvidas sobre uso e configuração.
- [Ideias](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/ideas): ideias iniciais para recursos e formas de uso.
- [Compartilhe seu trabalho](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/show-and-tell): dicas, formas de uso e implementações de referência.
- Use os [formulários de issues do GitHub](https://github.com/ZHYX91/obsidian-property-order/issues/new/choose) para relatar erros reproduzíveis e solicitar recursos específicos.
- Relate vulnerabilidades de forma privada seguindo a [política de segurança](https://github.com/ZHYX91/obsidian-property-order/security/policy) do repositório.

Antes de publicar, remova caminhos privados do cofre, conteúdo de notas, valores YAML e credenciais.

## Licença

[MIT](../../LICENSE) © ZhengYX
