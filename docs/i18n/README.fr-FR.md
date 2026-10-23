# Property Order

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md)

Property Order permet de faire glisser les valeurs de listes dans le panneau des propriétés d’Obsidian et de choisir les noms et les valeurs de propriétés suggérés pendant la saisie. Il trie les valeurs des listes et les suggestions de saisie, mais ne déplace pas les champs de propriétés eux-mêmes dans la note.

## Démonstration

Sur ordinateur, faites glisser un élément d’une propriété de type liste vers une autre dans la même note :

![Déplacer une valeur entre propriétés](../assets/property-order-cross-property-drag.gif)

Le déplacement entre propriétés est activé par défaut. Vous pouvez le désactiver dans les paramètres **Ordre des valeurs**.

## Fonctionnalités

- Réordonnez les valeurs en les faisant glisser dans une liste YAML de premier niveau prise en charge.
- Déplacez des valeurs entre les propriétés de type liste prises en charge d’une même note. Cette fonction est activée par défaut et peut être désactivée.
- Lorsqu’Obsidian traite une valeur vide ou une valeur unique comme une propriété de type liste, Property Order peut y déplacer des valeurs ou les en retirer en toute sécurité. Les éléments autres que du texte sont convertis en texte en conservant leur écriture YAML d’origine.
- Conservez le format actuel de chaque liste ou choisissez des listes entre crochets ou un élément par ligne. Chaque déplacement réussi constitue une seule modification annulable.
- Le glissement fonctionne aussi avec des valeurs réparties sur plusieurs lignes et dans les interfaces de droite à gauche (RTL). Il peut faire défiler les zones de propriétés prises en charge lorsque vous approchez du bord et annonce les changements d’état aux lecteurs d’écran.
- Personnalisez les suggestions de noms d’Obsidian : épinglage, placement en fin de liste, masquage, tri par nom, utilisation récente ou nombre de notes, avec un regroupement par type de propriété facultatif.
- Gérez, si vous le souhaitez, les suggestions de valeurs pour chaque propriété : ordre d’Obsidian, tri par nom, fréquence des sélections confirmées, nombre de notes, aucune suggestion ou suggestions personnalisées.
- Les suggestions personnalisées peuvent être épinglées, rester dans la section normale ou être placées en fin de liste. Les valeurs explicitement prédéfinies restent disponibles même si aucune note ne les utilise encore.
- L’historique des noms récents et les compteurs de sélection des valeurs ne changent qu’après confirmation de la modification par Obsidian. Le survol, la navigation, l’annulation et les modifications non confirmées ne comptent pas.
- Si Property Order ne peut pas interpréter le YAML ou reconnaître l’interface de suggestions d’Obsidian en toute sécurité, il laisse la note ou l’interface d’origine inchangée.

## Prérequis et compatibilité

- Obsidian 1.12.7 ou version ultérieure.
- Sur ordinateur, les valeurs se déplacent directement par glissement. Sur mobile, il faut d’abord choisir une action dans le menu d’appui long d’Obsidian.
- Le glissement des valeurs fonctionne uniquement avec les propriétés YAML de premier niveau qu’Obsidian reconnaît comme des listes de texte. La personnalisation des suggestions de valeurs réordonne généralement les propositions existantes d’Obsidian. Les règles personnalisées peuvent aussi proposer des valeurs explicitement prédéfinies dans le même éditeur de propriété. Les limites détaillées figurent plus bas.

## Installation

### Modules complémentaires (recommandé)

Dans Obsidian, ouvrez **Paramètres → Modules complémentaires → Parcourir**, recherchez **Property Order**, puis choisissez **Installer** et **Activer**. Vous pouvez aussi ouvrir sa [page dans le catalogue des modules complémentaires](https://obsidian.md/plugins?id=property-order). Suivez les instructions ZIP ci-dessous uniquement si une installation manuelle est nécessaire.

### Installation manuelle

Téléchargez `property-order-<version>.zip` depuis la [dernière version publiée](https://github.com/ZHYX91/obsidian-property-order/releases/latest) et décompressez-le dans `Vault/.obsidian/plugins/`. L’archive contient le dossier `property-order/` avec `main.js`, `manifest.json` et `styles.css`. Rechargez Obsidian, puis activez Property Order dans les modules complémentaires.

### Mise à jour

Sauvegardez et conservez `Vault/.obsidian/plugins/property-order/data.json` si ce fichier existe. Remplacez uniquement `main.js`, `manifest.json` et `styles.css`. Ne supprimez `data.json` que si vous souhaitez explicitement réinitialiser toutes les préférences du module.

## Utilisation

1. Activez Property Order dans **Paramètres → Modules complémentaires**.
2. Ouvrez une note contenant des propriétés de type liste YAML de premier niveau dans le panneau des propriétés d’Obsidian.
3. Sur ordinateur, faites directement glisser une valeur. Sur mobile, faites un appui long sur une valeur, choisissez **Réordonner** ou **Réordonner ou déplacer**, puis faites-la glisser.
4. Configurez **Noms suggérés** pour les propositions de noms de propriétés. Si besoin, activez **Valeurs suggérées** pour ordonner les propositions existantes d’Obsidian à l’aide d’un réglage par défaut et de règles par propriété.


**Avant de déplacer une valeur :** dans une liste de texte prise en charge, des valeurs YAML non textuelles peuvent devenir des chaînes : `true` devient `"true"`, et `123` devient `"123"`. Le type peut donc changer, pas seulement l'ordre. Vérifiez le résultat si les types comptent.

**Sur mobile :** le déplacement exige que le menu natif d'appui long d'Obsidian affiche **Réordonner** ou **Réordonner ou déplacer**. Si ce menu ne peut pas être étendu, le module ne crée pas de faux menu ; les commandes natives restent accessibles.

**Quel réglage de suggestions choisir ?** Lorsque vous ajoutez une propriété et saisissez son **nom**, **Noms suggérés** détermine si des noms tels que `status` ou `owner` sont épinglés, masqués ou réordonnés. Une fois `status` choisi, quand vous modifiez sa **valeur**, **Valeurs suggérées** contrôle les valeurs existantes proposées, comme `todo` ou `done`, ainsi que les valeurs prédéfinies que vous avez éventuellement ajoutées. Les suggestions de valeurs sont désactivées par défaut. Aucun de ces réglages ne modifie la note tant que vous ne sélectionnez ou ne modifiez pas une valeur.

**Exemple : ajouter des valeurs courantes pour `status`.** Ouvrez **Valeurs suggérées**, activez **Personnaliser les valeurs de propriétés suggérées** et ajoutez un groupe de règles **Suggestions personnalisées**. Ajoutez `status` à ce groupe. Dans **Suggestions épinglées**, saisissez `todo`, puis choisissez **Ajouter une valeur prédéfinie**. Répétez l’opération pour `doing` et `done`. Ces valeurs seront proposées lorsque vous modifierez `status`, en fonction du texte saisi. Pour inclure une valeur prédéfinie dans le tri normal, cliquez sur **↔ (Placer parmi les suggestions normales)** à côté de celle-ci.

## Paramètres

Toutes les versions prises en charge d’Obsidian utilisent les mêmes quatre onglets de paramètres :

- **Général** permet de choisir la langue du module et d’activer les messages de diagnostic facultatifs. L’interface et le README sont disponibles en anglais, chinois simplifié, chinois traditionnel, allemand, français, espagnol, portugais brésilien, russe, japonais, coréen, vietnamien et arabe. **Suivre Obsidian** choisit la langue correspondante, ou l’anglais si elle n’est pas disponible.
- **Ordre des valeurs** contrôle le format des listes après un déplacement, les déplacements entre propriétés et le comportement du glissement. Désactiver le glissement des valeurs ne supprime pas le réglage distinct des déplacements entre propriétés. Forcer la conversion d'une liste à un élément par ligne vers des crochets peut perdre les commentaires ou lignes vides. Conservez le format d'origine si ces éléments sont importants.
- **Noms suggérés** gère les noms épinglés, placés en fin de liste ou masqués, ainsi que le tri par nom, utilisation récente ou nombre de notes. Le regroupement par type de propriété facultatif répartit les suggestions normales entre Texte, Liste, Nombre, Case à cocher, Date, Date et heure, Mots-clés et Automatique / non précisé. Le tri choisi continue de s’appliquer dans chaque groupe.
- **Valeurs suggérées** doit être activé explicitement. Les propriétés sans règle particulière suivent le réglage par défaut. Chaque nom de propriété peut être associé à **Par nom**, **Fréquence de sélection**, **Nombre de notes contenant la valeur**, **Ordre d’Obsidian**, **Aucune suggestion** ou **Suggestions personnalisées**.
- Les règles personnalisées comportent les sections **Suggestions épinglées**, **Suggestions normales** et **Suggestions en fin de liste**. Les valeurs prédéfinies peuvent être saisies directement ; elles restent ainsi sélectionnables avant même d’apparaître dans une note.
- **Ordre des propriétés sur cette page** modifie uniquement l’ordre dans les groupes de règles et dans l’éditeur de suggestions personnalisées. Il ne réordonne ni les propriétés des notes ni les valeurs qu’elles proposent.
- L’historique des noms de propriétés récents est limité à 100 noms sur l’appareil actuel. La fréquence de sélection reste elle aussi propre à cet appareil. Ces deux données sont séparées de `data.json`, ne sont pas synchronisées et peuvent être effacées dans les paramètres.

## Limites

- Le frontmatter doit utiliser des lignes de propriétés ordinaires au premier niveau. Le glissement ne prend pas en charge un document YAML entièrement entouré de `{ ... }`.
- Le glissement des valeurs fonctionne uniquement avec les propriétés YAML de premier niveau qu’Obsidian affiche sous forme de listes de texte.
- Les listes d’objets, les listes imbriquées, les listes entre crochets écrites sur plusieurs lignes, le déplacement de lignes en mode source et les déplacements entre fichiers ne sont pas pris en charge.
- Sur mobile, choisissez d’abord **Réordonner** ou **Réordonner ou déplacer** dans le menu d’appui long d’Obsidian, puis faites glisser la valeur. Les actions d’origine pour modifier, retirer de la liste et copier restent disponibles.
- Certaines propriétés affichant un avertissement de type incompatible peuvent participer lorsqu’Obsidian les identifie clairement comme des listes. Les champs ambigus contenant des valeurs de plusieurs types sont traités avec prudence et peuvent seulement accepter l’ajout d’une valeur à la fin.
- Les valeurs prédéfinies personnalisées sont proposées uniquement pendant la modification des valeurs dans le panneau des propriétés. Si Obsidian n’affiche pas de liste de suggestions, Property Order peut les présenter à côté du champ de saisie. Si le champ ne peut pas être identifié avec certitude, vous pouvez continuer à saisir du texte normalement.
- Convertir une liste avec un élément par ligne en liste entre crochets peut supprimer les commentaires et les lignes vides que la syntaxe entre crochets ne permet pas de conserver.
- Il n’est pas encore possible de réordonner directement les valeurs de propriétés au clavier. Le déplacement au pointeur fournit toutefois des annonces d’état aux lecteurs d’écran.

## Confidentialité et sécurité

Property Order fonctionne localement. Il ne nécessite pas de compte, ne téléverse pas le contenu des notes et n’appelle aucun service distant.

Un déplacement modifie uniquement les propriétés concernées. Le module vérifie le résultat avant de demander à Obsidian d’enregistrer la note. Il n’écrit pas les structures qu’il ne peut pas traiter en toute sécurité.

Pour le tri par nombre de notes, Property Order recense les fichiers Markdown et lit les métadonnées de propriétés mises en cache ; il ne lit pas le corps de chaque note. L’historique des noms de propriétés récents et les compteurs de sélections confirmées sont conservés uniquement dans le stockage local d’Obsidian propre à chaque coffre sur l’appareil actuel, séparément de `data.json`. Ils peuvent être effacés dans les paramètres.

## Développement

Utilisez Node.js 24.19.0 et npm 11.17.0. Installez les versions des dépendances consignées dans `package-lock.json`, puis exécutez toutes les vérifications du dépôt :

```bash
npm ci
npm run check
```

### Documentation

- [Exigences du produit (English)](../product-requirements.en.md)
- [Spécification des interactions (English)](../ux-spec.en.md)
- [Architecture (English)](../architecture.en.md)
- [Stratégie de test (English)](../testing-strategy.en.md)
- [Journal des modifications (English)](../../CHANGELOG.md)
- [Guide de contribution (English)](../../CONTRIBUTING.md)
- [Politique de sécurité (English)](../../SECURITY.md)

## Assistance

- [Questions et réponses (Q&A)](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/q-a) : questions sur l’utilisation et la configuration.
- [Idées (Ideas)](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/ideas) : premières idées de fonctionnalités et de méthodes de travail.
- [Partages (Show and tell)](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/show-and-tell) : astuces, méthodes de travail et exemples de mise en œuvre.
- Utilisez les [formulaires de signalement GitHub](https://github.com/ZHYX91/obsidian-property-order/issues/new/choose) pour les bugs reproductibles et les demandes de fonctionnalités précises.
- Signalez les vulnérabilités en privé selon la [politique de sécurité](https://github.com/ZHYX91/obsidian-property-order/security/policy) du dépôt.

Retirez les chemins privés de vos coffres, le contenu des notes, les valeurs YAML et les identifiants d’accès avant de publier.

## Licence

[MIT](../../LICENSE) © ZhengYX
