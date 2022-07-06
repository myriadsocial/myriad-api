import {authenticate, AuthenticationBindings} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {AnyObject, repository} from '@loopback/repository';
import {
  getModelSchemaRef,
  HttpErrors,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import {UserProfile, securityId} from '@loopback/security';
import {
  NetworkRepository,
  ServerRepository,
  UserSocialMediaRepository,
  WalletRepository,
} from '../repositories';
import {utils, providers, transactions} from 'near-api-js';
import {BN} from '@polkadot/util';
import {sha256} from 'js-sha256';
import {config} from '../config';
import {ClaimReference} from '../models';

const nearSeedPhrase = require('near-seed-phrase');

interface TxHash {
  txHash: string;
}

/* eslint-disable  @typescript-eslint/naming-convention */
@authenticate('jwt')
export class ClaimReferenceController {
  constructor(
    @repository(NetworkRepository)
    protected networkRepository: NetworkRepository,
    @repository(ServerRepository)
    protected serverRepository: ServerRepository,
    @repository(UserSocialMediaRepository)
    protected userSocialMediaRepository: UserSocialMediaRepository,
    @repository(WalletRepository)
    protected walletRepository: WalletRepository,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    protected currentUser: UserProfile,
  ) {}

  @post('/claim-references')
  @response(200, {
    description: 'Claim Reference',
  })
  async claim(
    @requestBody({
      'application/json': {
        schema: getModelSchemaRef(ClaimReference),
      },
    })
    claimReference: ClaimReference,
  ): Promise<TxHash> {
    if (!this.currentUser?.[securityId]) {
      throw new HttpErrors.Forbidden('UnathorizedUser');
    }

    if (parseInt(claimReference.txFee) === 0) {
      throw new HttpErrors.UnprocessableEntity('TxFeeMustLargerThanZero');
    }

    const wallet = await this.walletRepository.findOne({
      where: {
        userId: this.currentUser[securityId],
        primary: true,
      },
    });

    if (!wallet) throw new HttpErrors.NotFound('WalletNotFound');

    switch (wallet.networkId) {
      case 'near': {
        return this.claimNearReference(wallet.id, claimReference);
      }

      case 'myriad':
      default:
        throw new HttpErrors.NotFound('WalletNotFound');
    }
  }

  async claimNearReference(
    accountId: string,
    claimReference: ClaimReference,
  ): Promise<TxHash> {
    try {
      const {txFee, tippingContractId} = claimReference;
      const mainReferenceType = 'user';
      const mainReferenceId = this.currentUser[securityId];

      if (!tippingContractId) {
        throw new HttpErrors.UnprocessableEntity('ContractIdEmpty');
      }

      const [{rpcURL}, {accountId: account}, socialMedia] = await Promise.all([
        this.networkRepository.findById('near'),
        this.serverRepository.findById(config.MYRIAD_SERVER_ID),
        this.userSocialMediaRepository.find({where: {userId: mainReferenceId}}),
      ]);

      const referenceIds = socialMedia.map(e => e.peopleId);
      const serverId = account?.['near'] ?? 'myriad';
      const provider = new providers.JsonRpcProvider({url: rpcURL});
      const tipsBalanceInfo = {
        server_id: serverId,
        reference_type: mainReferenceType,
        reference_id: mainReferenceId,
        ft_identifier: 'native',
      };
      const data = JSON.stringify({tips_balance_info: tipsBalanceInfo});
      const buff = Buffer.from(data);
      const base64data = buff.toString('base64');
      const [{gas_price}, rawResult] = await Promise.all([
        provider.gasPrice(null),
        provider.query({
          request_type: 'call_function',
          account_id: claimReference.tippingContractId,
          method_name: 'get_tips_balance',
          args_base64: base64data,
          finality: 'final',
        }),
      ]);

      const result = JSON.parse(
        Buffer.from((rawResult as AnyObject).result).toString(),
      );

      const amount = result?.tips_balance?.amount ?? '0';
      const GAS = BigInt(300000000000000);
      const currentTxFee = GAS * BigInt(gas_price);

      if (BigInt(amount) < currentTxFee || BigInt(txFee) < currentTxFee) {
        throw new HttpErrors.UnprocessableEntity('TxFeeInsufficient');
      }

      const mnemonic = config.MYRIAD_ADMIN_MNEMONIC;
      const seedData = nearSeedPhrase.parseSeedPhrase(mnemonic);
      const privateKey = seedData.secretKey;
      const keyPair = utils.key_pair.KeyPairEd25519.fromString(privateKey);
      const publicKey = keyPair.getPublicKey();
      const sender = serverId;
      const receiverId = tippingContractId;
      const args = `access_key/${sender}/${publicKey.toString()}`;
      const accessKey = await provider.query(args, '');
      const {nonce, block_hash} = accessKey as AnyObject;
      const recentBlockHash = utils.serialize.base_decode(block_hash);
      const actions = [
        transactions.functionCall(
          'batch_claim_references',
          Buffer.from(
            JSON.stringify({
              reference_type: 'people',
              reference_ids: referenceIds,
              main_ref_type: 'user',
              main_ref_id: this.currentUser[securityId],
              account_id: accountId,
              tx_fee: txFee,
            }),
          ),
          new BN('300000000000000'),
          new BN('1'),
        ),
      ];
      const transaction = transactions.createTransaction(
        sender,
        publicKey,
        receiverId,
        nonce + 1,
        actions,
        recentBlockHash,
      );
      const serializedTx = utils.serialize.serialize(
        transactions.SCHEMA,
        transaction,
      );
      const serializedTxHash = new Uint8Array(sha256.array(serializedTx));
      const signature = keyPair.sign(serializedTxHash);
      const signedTransaction = new transactions.SignedTransaction({
        transaction,
        signature: new transactions.Signature({
          keyType: transaction.publicKey.keyType,
          data: signature.signature,
        }),
      });

      const txHash = await provider.sendTransactionAsync(signedTransaction);

      return {txHash: txHash.toString()};
    } catch (err) {
      if (err.type) {
        throw new HttpErrors.UnprocessableEntity(err.type);
      }

      throw err;
    }
  }
}
