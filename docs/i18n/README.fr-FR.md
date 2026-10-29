# Property Order

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md)

Gérez les suggestions et les valeurs de liste dans les propriétés d’Obsidian.

- **[Suggestions de noms de propriétés](#suggestions-de-noms-de-propriétés)** : épinglez, masquez, regroupez et triez des noms tels que `status` et `owner` lors de l’ajout d’une propriété.
- **[Suggestions de valeurs de propriétés](#suggestions-de-valeurs-de-propriétés)** : choisissez les valeurs proposées pour chaque propriété, y compris des valeurs prédéfinies telles que `todo`, `doing` et `done`.
- **[Réorganiser les valeurs de liste](#réorganiser-les-valeurs-de-liste)** : réordonnez les éléments ou déplacez-les entre propriétés compatibles d’une même note, par glisser-déposer ou via la palette de commandes.

Ces fonctions sont indépendantes. Property Order gère les suggestions et les valeurs de liste ; il ne réorganise pas les champs de propriétés eux-mêmes dans une note. Nécessite Obsidian 1.12.7 ou ultérieur, sur ordinateur ou mobile.

## Suggestions de noms de propriétés

Retrouvez plus facilement les noms que vous utilisez dans les suggestions natives **Ajouter une propriété** d’Obsidian.

1. Ouvrez **Paramètres → Property Order → Noms suggérés**.
2. Épinglez les noms fréquents, placez les noms occasionnels en fin de liste et masquez les noms indésirables à l’aide de noms exacts ou de règles avec caractères génériques.
3. Choisissez Par nom, Utilisation récente ou Nombre de notes contenant la propriété. Le **regroupement par type de propriété**, facultatif, regroupe les suggestions normales selon leur type Obsidian, tout en gardant les noms épinglés au début et ceux de fin de liste à la fin.

Par exemple, épinglez `status` et `owner`, puis masquez `legacy_code`. Ouvrez **Ajouter une propriété** dans une note pour voir le résultat. Ces règles organisent les noms déjà proposés par Obsidian ; épingler un nom ne crée pas de nouvelle suggestion et ne déplace aucun champ dans la note.

Suggestions natives avant l’application de ces règles :

![Suggestions natives de noms de propriétés avant personnalisation](../assets/property-order-key-suggestions-before.png)

Les mêmes suggestions, avec les noms fréquents épinglés et un nom indésirable masqué :

![Suggestions avec status et owner épinglés et legacy_code masqué](../assets/property-order-key-suggestions-after.png)

L’utilisation récente correspond à l’ordre des ajouts confirmés, pas au survol ou à la consultation des suggestions. Le tri par nom et par utilisation récente ne parcourt pas le coffre. Le tri par nombre de notes compte les notes Markdown contenant chaque propriété à partir des métadonnées en cache.

## Suggestions de valeurs de propriétés

Gérez les valeurs proposées après la sélection d’une propriété, par exemple `todo` et `done` pour `status`. Cette fonction est **désactivée par défaut** et indépendante des suggestions de noms.

1. Ouvrez **Paramètres → Property Order → Valeurs suggérées** et activez **Personnaliser les valeurs de propriétés suggérées**.
2. Définissez le comportement par défaut des propriétés sans règle, ou affectez à un nom de propriété exact : Ordre d’Obsidian, Par nom, Fréquence de sélection, Nombre de notes contenant la valeur, Aucune suggestion ou Suggestions personnalisées.
3. Pour créer une liste réutilisable pour `status`, ajoutez une carte de règle **Suggestions personnalisées**, ajoutez `status`, puis saisissez `todo`, `doing` et `done` avec **Ajouter une valeur prédéfinie**.

![Valeurs prédéfinies de status proposées pendant la modification d’une propriété](../assets/property-order-value-suggestions.png)

Les suggestions personnalisées comprennent trois sections : épinglées, normales et en fin de liste. Les valeurs explicitement définies restent disponibles même si aucune note ne les utilise encore, et sont filtrées selon votre saisie. **↔ (Placer parmi les suggestions normales)** supprime la position fixe d’une valeur tout en la conservant parmi les suggestions. Retirer une valeur prédéfinie des paramètres ne supprime aucun contenu des notes.

La fréquence de sélection n’est comptée qu’après confirmation par Obsidian de l’écriture de la valeur. Le nombre de notes mesure les notes Markdown contenant la valeur, pas le nombre de fois où vous l’avez choisie. **Aucune suggestion** permet toujours la saisie manuelle. Modifier seulement les règles de suggestion ne modifie pas les notes.

## Réorganiser les valeurs de liste

Réordonnez directement dans les propriétés les valeurs de listes textuelles YAML de premier niveau prises en charge, ou déplacez une valeur vers une autre propriété de liste de la même note. Le glisser-déposer entre propriétés est activé par défaut et peut être désactivé dans **Ordre des valeurs**.

![Déplacer une valeur entre propriétés](../assets/property-order-cross-property-drag.gif)

- **Ordinateur :** faites glisser une valeur vers sa nouvelle position ou une autre propriété de liste compatible.
- **Mobile :** appuyez longuement sur une valeur, choisissez **Réordonner** ou **Réordonner ou déplacer** dans le menu natif d’Obsidian, puis faites glisser cette valeur. Si ce menu ne peut pas être étendu, l’édition native reste disponible et le plugin ne le remplace pas par une imitation.
- **Clavier :** lancez **Property Order: Réorganiser les valeurs des propriétés** depuis la palette de commandes. Choisissez la propriété source et la valeur, puis déplacez-la vers le haut, le bas, une position à partir de 1, le début, la fin ou la fin d’une autre propriété. Aucun raccourci n’est attribué par défaut. La commande fonctionne même si le glisser-déposer est désactivé ; le réglage entre propriétés ne concerne que le glisser-déposer au pointeur.

Chaque réorganisation ou déplacement terminé constitue une seule modification annulable. Avant le début de la mise à jour, **Escape** ou **Annuler** laisse la note inchangée. Une fois la mise à jour commencée, attendez sa fin et utilisez Annuler dans l’éditeur si nécessaire. Le glisser-déposer prend en charge les éléments sur plusieurs lignes à l’écran, les dispositions de droite à gauche, le défilement près des bords des panneaux compatibles et les annonces d’état pour lecteurs d’écran.

**Vérifiez les types avant de réorganiser :** les éléments non textuels des listes textuelles compatibles peuvent devenir des chaînes, par exemple `true` devient `"true"` et `123` devient `"123"`. Le type peut donc changer ; vérifiez le résultat si les types numériques ou booléens sont importants.

**Conserver le format actuel est le réglage par défaut.** Dans **Ordre des valeurs**, vous pouvez choisir des listes entre crochets ou un élément par ligne. Le passage aux crochets peut faire perdre les commentaires ou lignes vides ; conservez le format actuel s’ils sont importants. Dépliez **Exemples de format** à côté de **Format des listes après réorganisation** pour comparer les options.

## Installation

### Modules complémentaires (recommandé)

Dans Obsidian, ouvrez **Paramètres → Modules complémentaires → Parcourir**, recherchez **Property Order**, puis choisissez **Installer** et **Activer**. Vous pouvez aussi ouvrir sa [page dans le catalogue des modules complémentaires](https://obsidian.md/plugins?id=property-order). Suivez les instructions ZIP ci-dessous uniquement si une installation manuelle est nécessaire.

### Installation manuelle

Téléchargez `property-order-<version>.zip` depuis la [dernière version publiée](https://github.com/ZHYX91/obsidian-property-order/releases/latest) et décompressez-le dans `Vault/.obsidian/plugins/`. L’archive contient le dossier `property-order/` avec `main.js`, `manifest.json` et `styles.css`. Rechargez Obsidian, puis activez Property Order dans les modules complémentaires.

### Mise à jour

Sauvegardez et conservez `Vault/.obsidian/plugins/property-order/data.json` si ce fichier existe. Remplacez uniquement `main.js`, `manifest.json` et `styles.css`. Ne supprimez `data.json` que si vous souhaitez explicitement réinitialiser toutes les préférences du module.

## Référence des paramètres

Toutes les versions d’Obsidian prises en charge utilisent les mêmes quatre onglets :

| Onglet | Réglages |
| --- | --- |
| **Général** | Langue du plugin et notifications de diagnostic facultatives. **Suivre Obsidian** utilise la langue correspondante, ou l’anglais si elle n’est pas disponible. |
| **Ordre des valeurs** | Glisser-déposer dans une propriété et entre propriétés, et format des listes après réorganisation. Désactiver le glisser-déposer conserve le réglage distinct entre propriétés. |
| **Noms suggérés** | Noms épinglés, placés en fin de liste et masqués ; tri par nom, utilisation récente et nombre de notes ; regroupement facultatif par type ; effacement de l’historique récent et champ de test des règles. |
| **Valeurs suggérées** | Comportement par défaut à activer, règles par propriété, valeurs prédéfinies et remise à zéro des compteurs de sélection. |

**Ordre des propriétés sur cette page** ne réorganise que les propriétés des cartes de règles et de l’éditeur personnalisé. Il ne change ni les champs des notes ni l’ordre des valeurs suggérées.

L’interface et le README sont disponibles en anglais, chinois simplifié, chinois traditionnel, allemand, français, espagnol, portugais du Brésil, russe, japonais, coréen, vietnamien et arabe.

## Compatibilité et limites

- Le glisser-déposer prend en charge les lignes de propriétés YAML ordinaires de premier niveau qu’Obsidian affiche comme listes textuelles. Les documents entièrement écrits comme mappings `{ ... }`, les listes d’objets, les listes imbriquées, les séquences entre crochets sur plusieurs lignes, le déplacement de lignes en mode source et les déplacements entre fichiers ne sont pas pris en charge.
- Les valeurs vides ou scalaires peuvent participer si Obsidian identifie leur propriété comme une liste. Certaines lignes signalant une incompatibilité de type fonctionnent aussi lorsque chaque valeur est clairement identifiable. Les lignes ambiguës à valeurs mixtes sont traitées avec prudence et peuvent n’accepter qu’un ajout en fin de liste.
- La commande clavier nécessite un panneau de propriétés visible et compatible dans le volet Markdown actif. Si le fichier ou les valeurs changent pendant que la boîte de dialogue est ouverte, relancez la commande.
- Les valeurs prédéfinies apparaissent uniquement lors de l’édition de valeurs dans les propriétés. Sans fenêtre native de suggestions, le plugin peut les afficher à côté du champ. S’il ne peut pas identifier l’éditeur ou l’interface native de suggestions de façon sûre, la saisie normale ou les suggestions natives restent disponibles.
- La réorganisation vérifie le YAML avant de demander à Obsidian de l’enregistrer. Les contenus non pris en charge ou conflictuels restent inchangés. Choisir ou modifier une propriété dans Obsidian peut modifier la note ; configurer seulement les suggestions ne le fait pas.

## Confidentialité et sécurité

Property Order fonctionne localement. Il ne nécessite aucun compte, ne téléverse pas le contenu des notes et n’appelle aucun service distant. Réorganiser ou déplacer des valeurs ne modifie que les propriétés concernées.

Le nombre de notes utilise les métadonnées frontmatter en cache plutôt que de lire le corps de chaque note. L’historique récent des noms (100 au maximum) et les compteurs de sélection confirmée des valeurs sont enregistrés uniquement dans le stockage local de ce coffre sur l’appareil actuel, séparément de `data.json`. Ils ne sont pas synchronisés et peuvent être effacés depuis les paramètres. Le survol, la consultation, l’annulation et les modifications non confirmées ne les mettent pas à jour.

## Développement et assistance

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

- [Questions et réponses (Q&A)](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/q-a) : questions sur l’utilisation et la configuration.
- [Idées (Ideas)](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/ideas) : premières idées de fonctionnalités et de méthodes de travail.
- [Partages (Show and tell)](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/show-and-tell) : astuces, méthodes de travail et exemples de mise en œuvre.
- Utilisez les [formulaires de signalement GitHub](https://github.com/ZHYX91/obsidian-property-order/issues/new/choose) pour les bugs reproductibles et les demandes de fonctionnalités précises.
- Signalez les vulnérabilités en privé selon la [politique de sécurité](https://github.com/ZHYX91/obsidian-property-order/security/policy) du dépôt.

Retirez les chemins privés de vos coffres, le contenu des notes, les valeurs YAML et les identifiants d’accès avant de publier.

## Licence

[MIT](../../LICENSE) © ZhengYX
