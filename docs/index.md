## Contracts API
The contracts are upgradable, following the Open Zeppelin Proxy Upgrade Pattern. Each contract will be explained in brief detail below.

[**_EraManager_**](./contracts/EraManager.md)
> Produce epochs based on a period to coordinate contracts.

[**_IndexerRegistry_**](./contracts/IndexerRegistry.md)
> The IndexerRegistry contract store and track all registered Indexers and related status for these Indexers. It also provide the entry for Indexers to register, unregister, and config their metedata.

[**_InflationController_**](./contracts/InflationController.md)
>

[**_PermissionedExchange_**](./contracts/PermissionedExchange.md)
>

[**_PlanManager_**](./contracts/PlanManager.md)
> The Plan Manager Contract tracks and maintains all the Plans and PlanTemplates. It is the place Indexer create and publish a Plan for a specific deployment. And also the place Consumer can search and take these Plan.

[**_PurchaseOfferMarket_**](./contracts/PurchaseOfferMarket.md)
> The Purchase Offer Market Contract tracks all purchase offers for Indexers and Consumers. It allows Consumers to create/cancel purchase offers, and Indexers to accept the purchase offer to make the service agreements. It is the place Consumer publish a purchase offer for a specific deployment. And also the place indexers can search and take these purchase offers.

[**_QueryRegistry_**](./contracts/QueryRegistry.md)
> This contract tracks all query projects and their deployments. At the beginning of the network, we will start with the restrict mode which only allow permissioned account to create and update query project. Indexers are able to start and stop indexing with a specific deployment from this conttact. Also Indexers can update and report  their indexing status from this contarct.

[**_RewardsDistributer_**](./contracts/RewardsDistributer.md)
> The Rewards distributer contract tracks and distriubtes the rewards Era by Era. In each distribution, Indexers can take the commission part of rewards, the remaining rewards are distributed according to the staking amount of indexers and delegators.

[**_RewardsHelper_**](./contracts/RewardsHelper.md)
>

[**_RewardsPool_**](./contracts/RewardsPool.md)
> The Rewards Pool using the Cobb-Douglas production function for PAYG and Open Agreement.

[**_RewardsStaking_**](./contracts/RewardsStaking.md)
> Keep tracing the pending staking and commission rate and last settled era.

[**_ServiceAgreementRegistry_**](./contracts/ServiceAgreementRegistry.md)
> This contract tracks all service Agreements for Indexers and Consumers.

[**_Settings_**](./contracts/Settings.md)
>

[**_SQToken_**](./contracts/SQToken.md)
>

[**_Staking_**](./contracts/Staking.md)
> The Staking contract hold and track the changes of all staked SQT Token, It provides entry for the indexers and delegators to stake/unstake, delegate/undelegate to available Indexers and withdraw their SQT Token.

[**_StateChannel_**](./contracts/StateChannel.md)
> The contact for Pay-as-you-go service for Indexer and Consumer.

[**_Vesting_**](./contracts/Vesting.md)
>

[**_VSQToken_**](./contracts/VSQToken.md)
>