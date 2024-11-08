# Changelog

## [2.5.0](https://github.com/myriadsocial/myriad-api/compare/2.4.0...2.5.0) (2024-11-08)


### Features

* add authentication with personal access token ([#926](https://github.com/myriadsocial/myriad-api/issues/926)) ([b662acb](https://github.com/myriadsocial/myriad-api/commit/b662acb8ab504c5ea8b04c33003293872771ce03))
* add exclusiveness to timeline model ([#974](https://github.com/myriadsocial/myriad-api/issues/974)) ([b67661c](https://github.com/myriadsocial/myriad-api/commit/b67661cc9efcf0b0dfb65d5f6d518497f6bdf885))
* add new reference type ([#975](https://github.com/myriadsocial/myriad-api/issues/975)) ([c495d1f](https://github.com/myriadsocial/myriad-api/commit/c495d1fb1188de9c5c7b3fefabfc65a89ea50ac5))
* add YouTube video fetching and embedding support ([#976](https://github.com/myriadsocial/myriad-api/issues/976)) ([05e53b0](https://github.com/myriadsocial/myriad-api/commit/05e53b0fbcf4fa92bc9a248fc1651de287f45203))
* enable editors in timeline for multi user timeline ([#931](https://github.com/myriadsocial/myriad-api/issues/931)) ([bdf2167](https://github.com/myriadsocial/myriad-api/commit/bdf2167d04335339d6b6f4503baf821f657f9e47))


### Bug Fixes

* CRUD operation involving multi user timeline editors ([#932](https://github.com/myriadsocial/myriad-api/issues/932)) ([8eaa4f6](https://github.com/myriadsocial/myriad-api/commit/8eaa4f6ad65c7b567b454ae23448614462011426))
* email leak on find post by id api ([#947](https://github.com/myriadsocial/myriad-api/issues/947)) ([e30dde9](https://github.com/myriadsocial/myriad-api/commit/e30dde91ee8bcda398a302e1dcfc798a22442cb4))
* email showing on api request ([#906](https://github.com/myriadsocial/myriad-api/issues/906)) ([2ab5aac](https://github.com/myriadsocial/myriad-api/commit/2ab5aac15ea9954457b83a9d4bbd30a41e93f977))
* embedded url ([#966](https://github.com/myriadsocial/myriad-api/issues/966)) ([f7403af](https://github.com/myriadsocial/myriad-api/commit/f7403af7ba9252a804c1ae8d558bd967fa0cead2))
* error on creating multi user timeline ([#958](https://github.com/myriadsocial/myriad-api/issues/958)) ([6c83e79](https://github.com/myriadsocial/myriad-api/commit/6c83e797e01ab18213d539ea99f665b38f329ab4))
* error when importing from twitter ([#895](https://github.com/myriadsocial/myriad-api/issues/895)) ([1cae52f](https://github.com/myriadsocial/myriad-api/commit/1cae52f9e5fd1613f2b124f89be7c4b1854b82d7))
* fetch twitter ([#893](https://github.com/myriadsocial/myriad-api/issues/893)) ([f0ab8e7](https://github.com/myriadsocial/myriad-api/commit/f0ab8e72b562e58f9f528d6e46f1d43639ae2d70))
* fetch twitter ([#894](https://github.com/myriadsocial/myriad-api/issues/894)) ([0a5016e](https://github.com/myriadsocial/myriad-api/commit/0a5016e504b7029374b1da47af1e1daab1d39a30))
* get posts by profile ([#967](https://github.com/myriadsocial/myriad-api/issues/967)) ([ed271af](https://github.com/myriadsocial/myriad-api/commit/ed271af0ee6b7eca3ae61c6a7456ca82f43378d9))
* get posts by profile ([#968](https://github.com/myriadsocial/myriad-api/issues/968)) ([a226514](https://github.com/myriadsocial/myriad-api/commit/a22651449ed610ffe335bd2bfec96478ffdac325))
* issue with private timeline ([#951](https://github.com/myriadsocial/myriad-api/issues/951)) ([2ad03f3](https://github.com/myriadsocial/myriad-api/commit/2ad03f34ac1870020ad3eeaa659fc57f82e323fd))
* issue with uploading image ([#963](https://github.com/myriadsocial/myriad-api/issues/963)) ([1a361e2](https://github.com/myriadsocial/myriad-api/commit/1a361e28e7bdf2a484c69f5b80a7a5b6c855891d))
* mention notification ([#957](https://github.com/myriadsocial/myriad-api/issues/957)) ([d7255d6](https://github.com/myriadsocial/myriad-api/commit/d7255d68d2d0368e9ec04bd731e9b5a075254e09))
* mongo index user email ([#892](https://github.com/myriadsocial/myriad-api/issues/892)) ([71eff2c](https://github.com/myriadsocial/myriad-api/commit/71eff2ca6378a598666fd258df56f8050d36023f))
* multi user timeline dto ([#934](https://github.com/myriadsocial/myriad-api/issues/934)) ([ff77366](https://github.com/myriadsocial/myriad-api/commit/ff77366994f02edcb1e124c213b095bf151e28e9))
* patch database helper error ([#982](https://github.com/myriadsocial/myriad-api/issues/982)) ([badec41](https://github.com/myriadsocial/myriad-api/commit/badec41b67d070ff2ef7ef2818e57a4f897f8473))
* patch issue with minio url ([#965](https://github.com/myriadsocial/myriad-api/issues/965)) ([dc2d7c3](https://github.com/myriadsocial/myriad-api/commit/dc2d7c3bd58c1ed36f1af7e16c780e9bb5db1ad4))
* prevent anonymous user to generate personal access token ([#929](https://github.com/myriadsocial/myriad-api/issues/929)) ([908d17a](https://github.com/myriadsocial/myriad-api/commit/908d17a2784852ddf0bccb3494921f71da5a352f))
* profile ([#890](https://github.com/myriadsocial/myriad-api/issues/890)) ([8a3b7d9](https://github.com/myriadsocial/myriad-api/commit/8a3b7d9be344b10a7e1f2143547506bb4c383abe))
* rate limit ([#907](https://github.com/myriadsocial/myriad-api/issues/907)) ([1938cd5](https://github.com/myriadsocial/myriad-api/commit/1938cd555e86cab875e2b6d730ea8b89af6fc0f1))
* remove email from get post request ([#902](https://github.com/myriadsocial/myriad-api/issues/902)) ([6a1ef00](https://github.com/myriadsocial/myriad-api/commit/6a1ef0016e10d1ef1d0f4cbd202ccd011d04bd0b))
* replace firebase with minio ([#964](https://github.com/myriadsocial/myriad-api/issues/964)) ([8d58fac](https://github.com/myriadsocial/myriad-api/commit/8d58fac8c80e9751befb30189bf4fbd39cd3173c))
* return empty array when timeline is exclusive ([#978](https://github.com/myriadsocial/myriad-api/issues/978)) ([dd7e5ea](https://github.com/myriadsocial/myriad-api/commit/dd7e5ea279ee254dcbcd5fc737b4924ab0863778))
* update access token API ([#973](https://github.com/myriadsocial/myriad-api/issues/973)) ([f343f73](https://github.com/myriadsocial/myriad-api/commit/f343f73c4eebe7ab7614a939744fbcaf82332b38))
* update comment notification message ([#953](https://github.com/myriadsocial/myriad-api/issues/953)) ([20ce7dc](https://github.com/myriadsocial/myriad-api/commit/20ce7dcc75d21f7d85330e9a31893d4d74d3827b))
* update exclusive timeline exclusion logic to fetch transaction ([#981](https://github.com/myriadsocial/myriad-api/issues/981)) ([98c713e](https://github.com/myriadsocial/myriad-api/commit/98c713efd44ad57ace530b620922d013ea0b6eec))
* update transaction search for exclusive timeline ([#983](https://github.com/myriadsocial/myriad-api/issues/983)) ([fa6432c](https://github.com/myriadsocial/myriad-api/commit/fa6432cfa90612a36d0d56c2417ca9193793fc16))

## [2.4.0](https://github.com/myriadsocial/myriad-api/compare/2.3.1...2.4.0) (2023-06-15)


### Features

* add find profile post ([#885](https://github.com/myriadsocial/myriad-api/issues/885)) ([86ea28e](https://github.com/myriadsocial/myriad-api/commit/86ea28eaa73db898344db53e97ef72806ea05b70))
* advanced search ([#816](https://github.com/myriadsocial/myriad-api/issues/816)) ([0d11f80](https://github.com/myriadsocial/myriad-api/commit/0d11f8066caf6a98c8d06b5cbed1c35fd224d52c))
* mapping Post Visibility to Timeline ([#803](https://github.com/myriadsocial/myriad-api/issues/803)) ([7fc67b1](https://github.com/myriadsocial/myriad-api/commit/7fc67b168ea35efcb3780d7e8db48eeb45a0f83a))
* setting notification ([#853](https://github.com/myriadsocial/myriad-api/issues/853)) ([7e5e86a](https://github.com/myriadsocial/myriad-api/commit/7e5e86a6d058fe1d15844932a784381afb5b8140))
* update timeline query ([#802](https://github.com/myriadsocial/myriad-api/issues/802)) ([f8ab1a3](https://github.com/myriadsocial/myriad-api/commit/f8ab1a3f26b6dda4ed23620399c25483da94568f))


### Bug Fixes

* acceptance-test ([#859](https://github.com/myriadsocial/myriad-api/issues/859)) ([0fc5a6d](https://github.com/myriadsocial/myriad-api/commit/0fc5a6d7d56a1605220eb94e532b16b6c8be800a))
* advance search ([#819](https://github.com/myriadsocial/myriad-api/issues/819)) ([35e148f](https://github.com/myriadsocial/myriad-api/commit/35e148fd3643bee7bd62e92df8e30b322e9dcb3f))
* advanced filter where ([#820](https://github.com/myriadsocial/myriad-api/issues/820)) ([d9988c7](https://github.com/myriadsocial/myriad-api/commit/d9988c7e42aa0e073bb23ad00756fe1bace301f9))
* advanced search ([#845](https://github.com/myriadsocial/myriad-api/issues/845)) ([de0861a](https://github.com/myriadsocial/myriad-api/commit/de0861a0ad3999b17855f0a731c2ae4f44e3effe))
* bug fix error add post to timeline ([#824](https://github.com/myriadsocial/myriad-api/issues/824)) ([019240c](https://github.com/myriadsocial/myriad-api/commit/019240c4ec7080406106e5aeae5b9f1952e816d7))
* change advanced search ([#826](https://github.com/myriadsocial/myriad-api/issues/826)) ([3135e10](https://github.com/myriadsocial/myriad-api/commit/3135e10d4f70335cb2855de5f14af3d089b2c585))
* change-notif-message ([#823](https://github.com/myriadsocial/myriad-api/issues/823)) ([4d4622e](https://github.com/myriadsocial/myriad-api/commit/4d4622eed9ef376bbc0fddc508b446f12e762de4))
* create migration ([#827](https://github.com/myriadsocial/myriad-api/issues/827)) ([a587daf](https://github.com/myriadsocial/myriad-api/commit/a587daf23dfe066f872364035cbcfcedd8705a43))
* date format when update user experience ([#848](https://github.com/myriadsocial/myriad-api/issues/848)) ([dfb24cc](https://github.com/myriadsocial/myriad-api/commit/dfb24cc8af312d1d21783cb3c3272b22549dcddf))
* experience by created by ([#836](https://github.com/myriadsocial/myriad-api/issues/836)) ([85212b4](https://github.com/myriadsocial/myriad-api/commit/85212b4de27a7fea8bb5fc5d1064a30d96ff5511))
* experience find ([#833](https://github.com/myriadsocial/myriad-api/issues/833)) ([4380092](https://github.com/myriadsocial/myriad-api/commit/4380092e881670965b98bd61b742950898ca9380))
* experience timeline ([#839](https://github.com/myriadsocial/myriad-api/issues/839)) ([44dde19](https://github.com/myriadsocial/myriad-api/commit/44dde19d5597aedfad40665bb28ce903aa072adf))
* expirience ([#835](https://github.com/myriadsocial/myriad-api/issues/835)) ([948e926](https://github.com/myriadsocial/myriad-api/commit/948e926569c71de2a8f3e69d197c79f6d74b71ef))
* find by createdby ([#834](https://github.com/myriadsocial/myriad-api/issues/834)) ([df5551a](https://github.com/myriadsocial/myriad-api/commit/df5551adfd0aa1590847f3aca3196a7f07293ab0))
* follower notif count ([#825](https://github.com/myriadsocial/myriad-api/issues/825)) ([dcf235f](https://github.com/myriadsocial/myriad-api/commit/dcf235f52521140b28962876bd330213c8e0a778))
* follower notif count ([#828](https://github.com/myriadsocial/myriad-api/issues/828)) ([2355f3d](https://github.com/myriadsocial/myriad-api/commit/2355f3deb0e8c4c5ecc52709161dfc3311ecd2ea))
* handle claim reference on debio network ([#811](https://github.com/myriadsocial/myriad-api/issues/811)) ([566eedc](https://github.com/myriadsocial/myriad-api/commit/566eedc292bf66bceadae972bcec96b4884a0efa))
* handle claim reference with debio ([#813](https://github.com/myriadsocial/myriad-api/issues/813)) ([452afb7](https://github.com/myriadsocial/myriad-api/commit/452afb7e5814af505f8a358ac66217aef3dd8b02))
* handle empty selectedTimelineIds when creating post ([#838](https://github.com/myriadsocial/myriad-api/issues/838)) ([65d9c63](https://github.com/myriadsocial/myriad-api/commit/65d9c6346b7a2948345f358964d4af41e18b62bf))
* handle error txFeeInsufficient when claim debio ([#814](https://github.com/myriadsocial/myriad-api/issues/814)) ([33e01ba](https://github.com/myriadsocial/myriad-api/commit/33e01ba374f9c9de0c019086fde27ffa48036280))
* handle get post by originPostId ([#866](https://github.com/myriadsocial/myriad-api/issues/866)) ([ccd2fe1](https://github.com/myriadsocial/myriad-api/commit/ccd2fe1ee6074397f2df222fa3d25179fc0668e5))
* improve timeline query ([#849](https://github.com/myriadsocial/myriad-api/issues/849)) ([5c17d23](https://github.com/myriadsocial/myriad-api/commit/5c17d236799708c1ae1640534f2adf477c83192c))
* include @ and # on filter post ([#815](https://github.com/myriadsocial/myriad-api/issues/815)) ([8a1c21c](https://github.com/myriadsocial/myriad-api/commit/8a1c21cfbb8af5b52ffa635f8e61abfb958012a6))
* include @ and # on filter search post query ([8a1c21c](https://github.com/myriadsocial/myriad-api/commit/8a1c21cfbb8af5b52ffa635f8e61abfb958012a6))
* pagination advanced search ([#829](https://github.com/myriadsocial/myriad-api/issues/829)) ([1c3af7e](https://github.com/myriadsocial/myriad-api/commit/1c3af7e2d7717721a00d09ee63d48f9decca78a0))
* reddit service added user agent ([#882](https://github.com/myriadsocial/myriad-api/issues/882)) ([4ce273c](https://github.com/myriadsocial/myriad-api/commit/4ce273c635af13ab19889b04b07415f29ac91ddb))
* resolve create post ([#857](https://github.com/myriadsocial/myriad-api/issues/857)) ([a9a78c1](https://github.com/myriadsocial/myriad-api/commit/a9a78c1993d591eef095afbe0febb5caf3e85fb3))
* resolve filter query on search timeiline ([#856](https://github.com/myriadsocial/myriad-api/issues/856)) ([e48b060](https://github.com/myriadsocial/myriad-api/commit/e48b060a7f470d315a525c21a05e508bf2086ac9))
* timeline filter ([#844](https://github.com/myriadsocial/myriad-api/issues/844)) ([7642891](https://github.com/myriadsocial/myriad-api/commit/76428910a3c815f98ab4102f7f28853d0c483571))
* timeline filter for single experience ([#832](https://github.com/myriadsocial/myriad-api/issues/832)) ([513dfa8](https://github.com/myriadsocial/myriad-api/commit/513dfa888edb838e94a4ac1fa16184fa8b2c0e14))
* twitter v2 base url ([#886](https://github.com/myriadsocial/myriad-api/issues/886)) ([670f486](https://github.com/myriadsocial/myriad-api/commit/670f486041ab2c0e3b92834f6c2d310a7be32da2))
* upvote notification ([#821](https://github.com/myriadsocial/myriad-api/issues/821)) ([b58bef8](https://github.com/myriadsocial/myriad-api/commit/b58bef8ac5699afde0dd2620d274873e3f8ab1dc))
* user experience ([#864](https://github.com/myriadsocial/myriad-api/issues/864)) ([08c22ee](https://github.com/myriadsocial/myriad-api/commit/08c22ee0ab2affa95df79712a91368953f90206d))
* user experience by people user id ([#842](https://github.com/myriadsocial/myriad-api/issues/842)) ([ace7e7e](https://github.com/myriadsocial/myriad-api/commit/ace7e7e97adf0d42be7aaf8ca8b3bb7dab192f1a))
* weekly change ([#877](https://github.com/myriadsocial/myriad-api/issues/877)) ([f80deef](https://github.com/myriadsocial/myriad-api/commit/f80deefa0efacca07de04395b88e992d1c4a3c9e))
* weekly trending tags ([#870](https://github.com/myriadsocial/myriad-api/issues/870)) ([f92dbdb](https://github.com/myriadsocial/myriad-api/commit/f92dbdbe10ab9e248030d5c435f6b7bb7962fdd5))
* weekly trending topic ([#878](https://github.com/myriadsocial/myriad-api/issues/878)) ([c4357bb](https://github.com/myriadsocial/myriad-api/commit/c4357bb254940fb7de6bb70888c49b583e9599a1))

## [2.3.1](https://github.com/myriadsocial/myriad-api/compare/2.3.0...2.3.1) (2023-03-09)


### Bug Fixes

* remove create post limitaion ([#799](https://github.com/myriadsocial/myriad-api/issues/799)) ([5dab00c](https://github.com/myriadsocial/myriad-api/commit/5dab00cf2cb0e48e5447813924c997d679efe646))
* remove create timeline limitation ([#801](https://github.com/myriadsocial/myriad-api/issues/801)) ([2ba4301](https://github.com/myriadsocial/myriad-api/commit/2ba430149c4197ab9f0f0bee6dfd5b09ca7d1c18))

## [2.3.0](https://github.com/myriadsocial/myriad-api/compare/2.2.8...2.3.0) (2023-02-24)


### Features

* post timeline visibility ([#776](https://github.com/myriadsocial/myriad-api/issues/776)) ([0b388f4](https://github.com/myriadsocial/myriad-api/commit/0b388f4ca29cd6d49cc2a26ad5accb0d09616056))
* seed data ([#760](https://github.com/myriadsocial/myriad-api/issues/760)) ([1fcfa0d](https://github.com/myriadsocial/myriad-api/commit/1fcfa0d8081466582db300c14eaaa011c65da64d))


### Bug Fixes

* data seed ([#758](https://github.com/myriadsocial/myriad-api/issues/758)) ([9b1a009](https://github.com/myriadsocial/myriad-api/commit/9b1a009e21a3814d4985dd703f322f2b164a4401))
* fixed average calculation ([#767](https://github.com/myriadsocial/myriad-api/issues/767)) ([456405a](https://github.com/myriadsocial/myriad-api/commit/456405acc2cdf58975477d27dbbf525e3e5a7303))
* handle added post to timeline ([#768](https://github.com/myriadsocial/myriad-api/issues/768)) ([90cbf4e](https://github.com/myriadsocial/myriad-api/commit/90cbf4ead416b3480e83147b2f56cd4d1d52ed57))
* handle claim reference of a big number ([#772](https://github.com/myriadsocial/myriad-api/issues/772)) ([49cf0cb](https://github.com/myriadsocial/myriad-api/commit/49cf0cb7a20929a5a937811aafca486f1f4bc99a))
* handle filter post query ([#780](https://github.com/myriadsocial/myriad-api/issues/780)) ([657141a](https://github.com/myriadsocial/myriad-api/commit/657141a4c15b5cfff4a6b1c30b7597e9205134a9))
* improve auth response when login ([#773](https://github.com/myriadsocial/myriad-api/issues/773)) ([9f3755b](https://github.com/myriadsocial/myriad-api/commit/9f3755b2d12f86e35f8cf78e90b75276be075647))
* improve timeline filter ([#791](https://github.com/myriadsocial/myriad-api/issues/791)) ([5bf15dc](https://github.com/myriadsocial/myriad-api/commit/5bf15dca83bb89736949ac79e413a73e70c93846))
* improved post filter query ([#781](https://github.com/myriadsocial/myriad-api/issues/781)) ([0e258bd](https://github.com/myriadsocial/myriad-api/commit/0e258bde9d6dea449ff7a069f9fb10cc72fa1701))
* include instance id on server seed data ([#757](https://github.com/myriadsocial/myriad-api/issues/757)) ([b12c558](https://github.com/myriadsocial/myriad-api/commit/b12c558d13d7f80556a0ed250e5f10a960e93ace))
* included total amount on exlusive content ([#770](https://github.com/myriadsocial/myriad-api/issues/770)) ([538dc4b](https://github.com/myriadsocial/myriad-api/commit/538dc4b45dccf42c8c33a97a7cdb5879efe7ba81))
* invalid environment name ([#797](https://github.com/myriadsocial/myriad-api/issues/797)) ([f2d5f06](https://github.com/myriadsocial/myriad-api/commit/f2d5f063e5c54dbedc72e1a6741168c82774557d))
* selected post by timeline id ([#779](https://github.com/myriadsocial/myriad-api/issues/779)) ([1f58ca5](https://github.com/myriadsocial/myriad-api/commit/1f58ca5184dad084367f50279df69884066587aa))
* update order filter ([#774](https://github.com/myriadsocial/myriad-api/issues/774)) ([33ce251](https://github.com/myriadsocial/myriad-api/commit/33ce2518d459516f293d6bf80b653705379c57c0))
* update order filter on post ([#775](https://github.com/myriadsocial/myriad-api/issues/775)) ([4fd145f](https://github.com/myriadsocial/myriad-api/commit/4fd145fd5c7294ce5a7b4239d70c72f0952da08e))
* update post created at when add post to experience ([#766](https://github.com/myriadsocial/myriad-api/issues/766)) ([b368155](https://github.com/myriadsocial/myriad-api/commit/b3681550d89bb45fbb7258aa6750d7fba23d1568))
* update reference id when fetch wallet address ([#771](https://github.com/myriadsocial/myriad-api/issues/771)) ([c85aaf6](https://github.com/myriadsocial/myriad-api/commit/c85aaf6fad3596bcc3ea10eadc2b636708e35ca6))
* visibility timeline ([#777](https://github.com/myriadsocial/myriad-api/issues/777)) ([2738fd2](https://github.com/myriadsocial/myriad-api/commit/2738fd2de370514701a4d60f4823b23fde321b3e))
* visibility timeline ([#778](https://github.com/myriadsocial/myriad-api/issues/778)) ([65ee21a](https://github.com/myriadsocial/myriad-api/commit/65ee21a3f4e2f4ef38178dc0f7ea259ef35dc054))
