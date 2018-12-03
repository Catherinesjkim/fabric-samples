/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const FabricClient = require('fabric-client');
const path = require('path');
const util = require('util');

const config = require('./config.json');

//
const client = new FabricClient();

// setup the fabric network
const channel = client.newChannel(config.chainId);
const peer = client.newPeer(config.peerHost);
channel.addPeer(peer);
const order = client.newOrderer(config.ordererHost);
channel.addOrderer(order);

//
const storePath = path.join(__dirname, 'hfc-key-store');
console.log(`Store path:${storePath}`);
let txId = null;

const proposeAndCommitTransaction = tx => FabricClient.newDefaultKeyValueStore({ path: storePath })
  .then((stateStore) => {
    // assign the store to the fabric client
    client.setStateStore(stateStore);
    const cryptoSuite = FabricClient.newCryptoSuite();
    // use the same location for the state store (where the users' certificate are kept)
    // and the crypto store (where the users' keys are kept)
    const cryptoStore = FabricClient.newCryptoKeyStore({ path: storePath });
    cryptoSuite.setCryptoKeyStore(cryptoStore);
    client.setCryptoSuite(cryptoSuite);

    // get the enrolled user from persistence, this user will sign all requests
    return client.getUserContext(config.username, true);
  }).then(async (userFromStore) => {
    if (userFromStore && userFromStore.isEnrolled()) {
      console.log(`Successfully loaded ${config.username} from persistence`);
    } else {
      throw new Error(`Failed to get ${config.username}.... run registerUser.js`);
    }

    // get a transaction id object based on the current user assigned to fabric client
    txId = client.newTransactionID();
    console.log('Assigning transaction_id: ', txId._transaction_id);

    const request = Object.assign(tx, {
      txId,
      chaincodeId: config.chaincodeId,
      chainId: config.chainId,
    });

      // send the transaction proposal to the peers
    return channel.sendTransactionProposal(request);
  }).then((results) => {
    const proposalResponses = results[0];
    // console.log('Proposal response: ' + JSON.stringify(proposalResponses));
    const proposal = results[1];
    let isProposalGood = false;
    if (proposalResponses && proposalResponses[0].response
            && proposalResponses[0].response.status === 200) {
      isProposalGood = true;
      console.log('Transaction proposal was good');
      console.log(`Response payload: ${proposalResponses[0].response.payload}`);
    } else {
      console.log(JSON.stringify(proposalResponses, null, 4));
      console.error('Transaction proposal was bad');
    }
    if (isProposalGood) {
      console.log(util.format(
        'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s"',
        proposalResponses[0].response.status, proposalResponses[0].response.message,
      ));

      // build up the request for the orderer to have the transaction committed
      const request = {
        proposalResponses,
        proposal,
      };

        // set the transaction listener and set a timeout of 30 sec
        // if the transaction did not get committed within the timeout period,
        // report a TIMEOUT status
      const transactionIdString = txId.getTransactionID(); // Get the transaction ID string to be used by the event processing
      const promises = [];

      const sendPromise = channel.sendTransaction(request);
      promises.push(sendPromise); // we want the send transaction first, so that we know where to check status

      // get an eventhub once the fabric client has a user assigned. The user
      // is required bacause the event registration must be signed
      const eventHub = channel.newChannelEventHub(peer);

      // using resolve the promise so that result status may be processed
      // under the then clause rather than having the catch clause process
      // the status
      const txPromise = new Promise((resolve, reject) => {
        const handle = setTimeout(() => {
          eventHub.unregisterTxEvent(transactionIdString);
          eventHub.disconnect();
          resolve({ event_status: 'TIMEOUT' }); // we could use reject(new Error('Trnasaction did not complete within 30 seconds'));
        }, 30000);
        eventHub.registerTxEvent(transactionIdString,
          (_, code) => {
            // this is the callback for transaction event status
            // first some clean up of event listener
            clearTimeout(handle);

            // now let the application know what happened
            const returnStatus = { event_status: code, tx_id: transactionIdString };
            if (code !== 'VALID') {
              console.error(`The transaction was invalid, code = ${code}`);
              // we could use reject(new Error('Problem with the tranaction, event status ::'+code));
              resolve(returnStatus);
            } else {
              console.log(`The transaction has been committed on peer ${eventHub.getPeerAddr()}`);
              resolve(returnStatus);
            }
          }, (err) => {
            // this is the callback if something goes wrong with the event registration or processing
            reject(new Error(`There was a problem with the eventhub ::${err}`));
          },
          { disconnect: true });
        eventHub.connect();
      });
      promises.push(txPromise);

      return Promise.all(promises);
    }
    console.error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
    throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
  })
  .then((results) => {
    console.log('Send transaction promise and event listener promise have completed');
    // check the results in the order the promises were added to the promise all list
    if (results && results[0] && results[0].status === 'SUCCESS') {
      console.log('Successfully sent transaction to the orderer.');
    } else {
      console.error(`Failed to order the transaction. Error code: ${results[0].status}`);
    }

    if (results && results[1] && results[1].event_status === 'VALID') {
      console.log('Successfully committed the change to the ledger by the peer');
    } else {
      console.log(`Transaction failed to be committed to the ledger due to ::${results[1].event_status}`);
    }
  })
  .catch((err) => {
    console.error(`Failed to invoke successfully :: ${err}`);
    console.error(err);
  });
module.exports = {
  proposeAndCommitTransaction,
};
