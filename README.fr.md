<p align="center">
  <img alt="logo codus" src="https://kodus.io/wp-content/uploads/2026/06/codus-thumb-git-scaled.png">
</p>

<p align="center">
   <a href="http://makeapullrequest.com">
      <img alt="PRs bienvenues" src="https://img.shields.io/badge/PRs-welcome-darkgreen.svg?style=shields" />
   </a>
   <a href="https://github.com/elchapita43/codus-ai" target="_blank">
      <img src="https://img.shields.io/github/stars/elchapita43/codus-ai" alt="Étoiles Github" />
   </a>
   <a href="./license.md">
      <img src="https://img.shields.io/badge/license-AGPLv3-red" alt="Licence" />
   </a>
</p>

---

<p align="center">
   <a href="https://kodus.io">Site web</a> ·
   <a href="https://discord.gg/6WbWrRbsH7">Communauté</a> ·
   <a href="https://docs.kodus.io">Docs</a> ·
   <a href="https://docs.kodus.io/how_to_use/en/cli/overview">Docs CLI</a> ·
   <strong><a href="https://app.kodus.io">Essayer Codus Cloud </a></strong> ·
   <strong><a href="https://docs.kodus.io/how_to_deploy/en/deploy_codus/generic_vm">Guide d'auto-hébergement</a></strong>
</p>

<p align="center">
   🌐
   <a href="./README.md">English</a> ·
   <a href="./README.pt-BR.md">Português (BR)</a> ·
   <a href="./README.es.md">Español</a> ·
   <a href="./README.ja.md">日本語</a> ·
   <a href="./README.zh-CN.md">简体中文</a> ·
   <a href="./README.fr.md">Français</a>
</p>

## Pourquoi les équipes choisissent Codus

- **Agnostique au modèle** : Utilisez Claude, GPT-5, Gemini, Llama, GLM, Kimi ou tout endpoint compatible OpenAI.
- **Aucune majoration sur les coûts LLM** : Vous payez directement les fournisseurs de modèles. Aucun multiplicateur caché.
- **Apprend de votre contexte** : Cody s'adapte à votre architecture, vos standards et votre workflow.
- **Vous définissez les règles** : Créez des règles de revue personnalisées en langage naturel.
- **Confidentialité et sécurité** : Le code source n'est pas utilisé pour entraîner les modèles, les données sont chiffrées en transit et au repos, et les runners auto-hébergés sont pris en charge. Les instances auto-hébergées envoient un heartbeat anonyme par jour (compteurs agrégés uniquement — aucun code, nom ou identifiant) ; désactivez-le avec `CODUS_TELEMETRY_DISABLED=true`. Voir [Télémétrie anonyme](https://docs.kodus.io/how_to_deploy/en/deploy_codus/telemetry).
- **Workflow Git natif** : Fonctionne directement dans les PR avec GitHub, GitLab, Bitbucket et Azure Repos.
- **CLI + CI/CD prêt** : Lancez des revues localement et dans vos pipelines.
- **Impact opérationnel** : Suivez la dette technique et les métriques de livraison tout en maintenant une haute qualité de revue.

## Points forts du produit

<details>
  <summary><strong>🔑 Apportez Votre Propre Clé (BYOK)</strong></summary>
<br />
Connectez vos propres identifiants de fournisseur et choisissez les modèles derrière les revues Codus : OpenAI, Anthropic, Google Gemini, Vertex AI, Novita, ou tout endpoint compatible OpenAI. Gardez la facturation et l'utilisation sous votre propre compte fournisseurs, sans majoration LLM cachée.

<br />
<br />

<p align="center">
  <img src="https://kodus.io/wp-content/uploads/2026/06/byok-scaled.png" alt="Configuration du fournisseur de modèle Codus BYOK" width="900">
</p>

</details>

<br />

<details>
  <summary><strong>📈 Utilisation des tokens</strong></summary>
<br />
Suivez la consommation de tokens across les revues de code IA, comprenez les facteurs de coût, et gardez les dépenses de modèle prévisibles à mesure que l'adoption augmente.

<br />
<br />

<p align="center">
  <img src="https://kodus.io/wp-content/uploads/2026/06/token-usage-scaled.png" alt="Dashboard d'utilisation des tokens Codus" width="900">
</p>

</details>

<br />

<details>
  <summary><strong>⚙️ Cody Rules</strong></summary>
<br />
Cody Rules permet aux équipes de définir des instructions de revue en langage naturel et de les appliquer au niveau des organisations, dépôts, chemins ou portées de revue spécifiques. Cody utilise ces règles comme contexte lors de la revue des pull requests, aidant à faire respecter les décisions d'architecture, les attentes de sécurité, les pratiques de test et les conventions spécifiques au dépôt sans dépendre des relecteurs pour répéter manuellement le même feedback.

<br />
<br />

<p align="center">
  <img src="https://kodus.io/wp-content/uploads/2026/06/rules-scaled.png" alt="Règles Cody" width="900">
</p>
</details>
<br />
<details>
  <summary><strong>📊 Cockpit</strong></summary>
<br />
Cockpit aide les équipes à mesurer l'efficacité des revues Codus, la santé des Cody Rules, la santé des dépôts et les métriques de livraison à travers le workflow d'ingénierie.

<br />
<br />

<p align="center">
  <img src="https://kodus.io/wp-content/uploads/2026/06/cockpit-codus-scaled.png" alt="Cockpit Codus montrant la santé du pipeline de revue de code IA" width="900">
</p>

</details>

<br />

<details>
  <summary><strong>🧩 Cody Issues</strong></summary>
<br />
Suivez automatiquement les suggestions non implémentées issues des pull requests fermées, gérez-les par statut, sévérité, catégorie et dépôt, et laissez Cody les résoudre lorsque le correctif apparaît dans une future PR.
<br />
<br />

<p align="center">
  <img src="https://kodus.io/wp-content/uploads/2026/06/issues-scaled.png" alt="Dashboard Cody Issues" width="900">
</p>

</details>

<br />
<details>
  <summary><strong>🔎 Voir Cody reviewer une vraie pull request</strong></summary>
<br />
Cody fait bien plus que résumer les diffs. Il examine le code avec contexte, signale les risques par sévérité, et suggère des correctifs concrets directement dans la pull request.

<br />
<br />

<p align="center">
  <img
    src="https://kodus.io/wp-content/uploads/2025/12/review-cody-.png"
    alt="Cody détectant un problème de sécurité IDOR critique dans une revue de pull request"
    width="700"
  />
</p>

Dans cet exemple, Cody intercepte un risque IDOR critique où un paramètre de requête `organizationId` pourrait contourner la protection tenant lorsqu'il est passé sous forme de tableau, puis suggère une validation explicite à l'exécution avant que le code ne soit mergé.

</details>

## Pour commencer

Choisissez le workflow qui correspond à la façon dont vous souhaitez utiliser Codus.

<table>
  <tr>
    <td width="50%">
      <strong>Essayer Codus Cloud</strong>
      <br />
      Commencez à reviewer des pull requests sans gérer d'infrastructure.
      <br />
      <br />
      <a href="https://app.kodus.io/signup">Créer un compte gratuit</a>
      ·
      <a href="https://kodus.io/pricing">Voir les tarifs</a>
    </td>
    <td width="50%">
      <strong>Auto-héberger Codus</strong>
      <br />
      Déployez Codus sur votre propre infrastructure avec le contrôle des données, des modèles,
      et de la configuration d'exécution.
      <br />
      <br />
      <a href="https://docs.kodus.io/how_to_deploy/en/deploy_codus/generic_vm">Guide d'installation</a>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>Utiliser la CLI</strong>
      <br />
      Lancez des revues de code IA depuis votre terminal sur un working tree, un diff staged,
      une branche ou un commit.
      <br />
      <br />
      <code>codus review</code>
      <br />
      <code>codus review --staged</code>
      <br />
      <code>codus review --prompt-only</code>
      <br />
      <br />
      <a href="https://docs.kodus.io/how_to_use/en/cli/introduction">Aperçu de la CLI</a>
      ·
      <a href="https://docs.kodus.io/how_to_use/en/cli/commands">Référence des commandes</a>
      ·
      <a href="https://docs.kodus.io/how_to_use/en/cli/ci_cd">CI/CD</a>
    </td>
    <td width="50%">
      <strong>Contribuer localement</strong>
      <br />
      Exécutez le monorepo Codus localement pour le développement sur l'API, le worker,
      le service webhooks, l'application web et l'infrastructure locale.
      <br />
      <br />
      <code>git clone https://github.com/elchapita43/codus-ai.git</code>
      <br />
      <code>cd codus-ai</code>
      <br />
      <code>yarn setup</code>
      <br />
      <br />
      <a href="https://docs.kodus.io/how_to_deploy/en/local_quickstart/orchestrator">Démarrage rapide local</a>
    </td>
  </tr>
</table>

## Structure du monorepo

Codus est un monorepo avec plusieurs applications, des bibliothèques de domaine partagées et des packages publiés.

```txt
codus-ai/
├── apps/
│   ├── api/          # API NestJS
│   ├── web/          # Dashboard Next.js
│   ├── worker/       # Exécution des revues et consommateurs de queue
│   └── webhooks/     # Ingestion des webhooks des fournisseurs Git
├── libs/             # Modules de domaine NestJS partagés
├── packages/
│   ├── codus-flow/   # SDK d'orchestration d'agents IA
│   └── codus-common/ # Package d'abstraction LLM
└── scripts/          # Scripts de dev, deploy, benchmark et automatisation
```

| Chemin | Objectif |
| --- | --- |
| `apps/api` | API NestJS principale pour l'authentification, les organisations, les équipes, les Cody Rules, les intégrations, les permissions et l'orchestration des revues de code. |
| `apps/web` | Application web Next.js pour le dashboard Codus. |
| `apps/worker` | Service en arrière-plan pour l'exécution des revues de code, le traitement des queues, les vérifications de suggestions, les jobs d'automatisation et les tâches de monitoring. |
| `apps/webhooks` | Service d'ingestion de webhooks pour les événements GitHub, GitLab, Azure Repos, Bitbucket et Forgejo. |
| `libs` | Modules de domaine NestJS partagés utilisés à travers les applications Codus. |
| `packages/codus-flow` | SDK pour l'orchestration d'agents IA. |
| `packages/codus-common` | Package d'abstraction LLM partagé pour les fournisseurs de modèles. |

Pour des instructions d'installation complètes, suivez le [Démarrage rapide local](https://docs.kodus.io/how_to_deploy/en/local_quickstart/orchestrator).

## Open Source vs. Teams vs. Enterprise

| Fonctionnalité | <img src="https://kodus.io/wp-content/uploads/2026/06/cody-community2-scaled.webp" alt="Cody Community" width="110" /><br>Community | <img src="https://kodus.io/wp-content/uploads/2026/06/cody-team-scaled.webp" alt="Cody Teams" width="110" /><br>Teams | <img src="https://kodus.io/wp-content/uploads/2026/06/cody-enterprise-scaled.webp" alt="Cody Enterprise" width="110" /><br>Enterprise |
| :--- | :---: | :---: | :---: |
| Prix | Gratuit | 10 $/dev mensuel ou 8 $/dev annuel (+ tokens/dev) | Sur mesure |
| Hébergement | Auto-hébergé **ou** hébergé par Codus | Hébergé par Codus | Auto-hébergé **ou** hébergé par Codus |
| Apportez Votre Propre Clé (BYOK) | ✅ | ✅ | ✅ |
| Utilisation de PR | PR illimitées avec votre propre clé API | PR illimitées avec votre propre clé API | PR illimitées avec la clé API Codus AI Tokens |
| Utilisateurs | Illimités | Illimités | Illimités |
| Cody Rules | Jusqu'à 10 | Illimitées | Illimitées |
| Plugins actifs | Jusqu'à 3 | Illimités | Illimités |
| Cody Learnings et mémoire | ✅ | ✅ | ✅ |
| Issues Quality Radar | Illimités | Illimités | Illimités |
| File prioritaire pour les Cody Agents | ❌ | ✅ | ✅ |
| Métriques d'ingénierie / Cockpit | ❌ | ✅ | ✅ |
| SSO | ❌ | ❌ | ✅ |
| RBAC + logs d'audit + analytics | ❌ | ❌ | ✅ |
| Conformité | ❌ | ❌ | SOC 2 |
| Support | Support Communauté Discord | Support Communauté + Email Discord | Discord privé + Email + jusqu'à 5 h/mois d'onboarding/support dédié |

[Comparer tous les plans →](https://kodus.io/pricing)

## Ressources

| Ressource | Description |
| --- | --- |
| [Site web](https://kodus.io) | En savoir plus sur Codus, les capacités produit et les tarifs. |
| [Documentation](https://docs.kodus.io) | Guides d'installation, docs produit, utilisation CLI et instructions d'auto-hébergement. |
| [Codus Cloud](https://app.kodus.io) | Commencez à utiliser Codus sans gérer d'infrastructure. |
| [Guide d'auto-hébergement](https://docs.kodus.io/how_to_deploy/en/deploy_codus/generic_vm) | Déployez Codus dans votre propre environnement. |
| [Docs CLI](https://docs.kodus.io/how_to_use/en/cli/overview) | Lancez des revues de code IA localement, en CI/CD, ou dans des agents de codage. |
| [Communauté Discord](https://discord.gg/6WbWrRbsH7) | Posez des questions, obtenez de l'aide à l'installation et échangez avec l'équipe Codus. |
| [Tarifs](https://kodus.io/pricing) | Comparez les éditions Community, Teams et Enterprise. |
| [Planifier un appel](https://cal.com/gabrielmalinosqui/30min) | Discutez avec l'équipe Codus de l'installation, de l'auto-hébergement ou des besoins enterprise. |



## Contribuer

<p align="left">
  <img src="https://kodus.io/wp-content/uploads/2026/06/cody-contributing-scaled.png" alt="Cody contribuant" width="230" />
</p>

Nous accueillons les contributions de toutes tailles 🧡

Corrigez une faute de frappe, améliorez la documentation, signalez un bug, suggérez une fonctionnalité, ou ouvrez une pull request pour quelque chose qui devrait selon vous exister.

Vous ne savez pas par où commencer ? Ouvrez une issue ou rejoignez la communauté. Nous sommes ravis de vous aider.