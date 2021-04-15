import {
  lifeCycleObserver,
  LifeCycleObserver
} from '@loopback/core';
import {repository} from '@loopback/repository';
import {ApiPromise, WsProvider} from '@polkadot/api';
import {TransactionRepository} from '../repositories';

/**
 * This class will be bound to the application as a `LifeCycleObserver` during
 * `boot`
 */
@lifeCycleObserver('')
export class TransactionWatcherObserver implements LifeCycleObserver {

  constructor(
    @repository(TransactionRepository)
    public transactionRepository: TransactionRepository,
  ) { }


  /**
   * This method will be invoked when the application initializes. It will be
   * called at most once for a given application instance.
   */
  async init(): Promise<void> {
    // Add your logic for init
  }

  /**
   * This method will be invoked when the application starts.
   */
  async start(): Promise<void> {
    // Add your logic for start
    const wsProvider = new WsProvider('wss://rpc.myriad.systems')
    const api = await ApiPromise.create({provider: wsProvider})
    await api.isReady
    console.log('RPC isReady for TransactionWatcher');

    // Subscribe to system events via storage
    api.query.system.events((events) => {
      // Loop through the Vec<EventRecord>
      events.forEach((record) => {
        // Extract the phase, event and the event types
        const {event} = record;

        // Show what we are busy with
        if (event.section == 'balances' && event.method == 'Transfer') {
          const hash = event.hash.toString()
          const from = event.data[0].toString();
          const to = event.data[1].toString();
          const value = event.data[2].toString();

          this.transactionRepository.create({
            trxHash: hash,
            from: from,
            to: to,
            value: parseInt(value),
            createdAt: new Date().toString()
          })
        }
      });
    });
  }

  /**
   * This method will be invoked when the application stops.
   */
  async stop(): Promise<void> {
    // Add your logic for stop
  }
}
