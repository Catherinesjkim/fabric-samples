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

'use strict';

var Fabric_Client = require('fabric-client');
var path = require('path');
var util = require('util');
const KafkaService = require('@clausehq/clause-core').KafkaService;

/**
 * 
 */
class ClauseHlfClient {

	/**
	 * 
	 */
	constructor() {
		this.fabric_client = null;
		this.channel = null;
	}

	/**
	 * 
	 */
	async run() {
		await this.connect();
		await this.subscribe();
	}

	/**
	 * 
	 */
	async connect() {

		this.fabric_client = new Fabric_Client();

		// setup the fabric network
		this.channel = this.fabric_client.newChannel('mychannel');
		const peer = this.fabric_client.newPeer('grpc://localhost:7051');
		this.channel.addPeer(peer);
		const order = this.fabric_client.newOrderer('grpc://localhost:7050')
		this.channel.addOrderer(order);

		let member_user = null;
		const store_path = path.join(__dirname, 'hfc-key-store');
		console.log('Store path:' + store_path);

		// create the key value store as defined in the fabric-client/config/default.json 'key-value-store' setting
		const state_store = await Fabric_Client.newDefaultKeyValueStore({
			path: store_path
		});

		// assign the store to the fabric client
		this.fabric_client.setStateStore(state_store);
		const crypto_suite = Fabric_Client.newCryptoSuite();
		// use the same location for the state store (where the users' certificate are kept)
		// and the crypto store (where the users' keys are kept)
		const crypto_store = Fabric_Client.newCryptoKeyStore({
			path: store_path
		});
		crypto_suite.setCryptoKeyStore(crypto_store);
		this.fabric_client.setCryptoSuite(crypto_suite);

		// get the enrolled user from persistence, this user will sign all requests
		const user_from_store = await this.fabric_client.getUserContext('user1', true);

		if (user_from_store && user_from_store.isEnrolled()) {
			console.log('Successfully loaded user1 from persistence');
			member_user = user_from_store;
		} else {
			throw new Error('Failed to get user1.... run registerUser.js');
		}

		// get an eventhub once the fabric client has a user assigned. The user
		// is required bacause the event registration must be signed
		this.event_hub = this.fabric_client.newEventHub();
		this.event_hub.setPeerAddr('grpc://localhost:7053');
		this.event_hub.connect();
		console.log('Connected to HLF.');
	}

	/**
	 * 
	 */
	async subscribe() {
		await KafkaService.subscribe(
			[process.env.KAFKA_TOPIC],
			this.submit.bind(this),
			{
				'group.id': 'clause-hlf',
			  },
		  );

		  console.log(`Subscribed to ${process.env.KAFKA_TOPIC}`);
	}

	/**
	 * 
	 * @param {*} event 
	 */
	async submit(event) {
		// get a transaction id object based on the current user assigned to fabric client
		const auditEvent = JSON.parse(event.value.toString());
		console.log('Received event: ' + JSON.stringify(auditEvent, null, 4));

		const tx_id = this.fabric_client.newTransactionID();
		console.log("Assigning transaction_id: ", tx_id._transaction_id);

		var request = {
			//targets: let default to the peer assigned to the client
			chaincodeId: 'clause',
			fcn: 'storeAuditEvent',
			args: [auditEvent.contractId,  JSON.stringify(auditEvent)],
			chainId: 'mychannel',
			txId: tx_id
		};

		// send the transaction proposal to the peers
		const results = await this.channel.sendTransactionProposal(request);

		const proposalResponses = results[0];
		// console.log('Proposal response: ' + JSON.stringify(proposalResponses));
		const proposal = results[1];
		let isProposalGood = false;
		if (proposalResponses && proposalResponses[0].response &&
			proposalResponses[0].response.status === 200) {
			isProposalGood = true;
			console.log('Transaction proposal was good');
			console.log('Response payload: ' + proposalResponses[0].response.payload);
		} else {
			console.error('Transaction proposal was bad');
		}
		if (isProposalGood) {
			console.log(util.format(
				'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s"',
				proposalResponses[0].response.status, proposalResponses[0].response.message));

			// build up the request for the orderer to have the transaction committed
			var request = {
				proposalResponses: proposalResponses,
				proposal: proposal
			};

			// set the transaction listener and set a timeout of 30 sec
			// if the transaction did not get committed within the timeout period,
			// report a TIMEOUT status
			var transaction_id_string = tx_id.getTransactionID(); //Get the transaction ID string to be used by the event processing
			var promises = [];

			await this.channel.sendTransaction(request);

			this.event_hub.registerTxEvent(transaction_id_string, (tx, code) => {
				// this is the callback for transaction event status
				// first some clean up of event listener
				// clearTimeout(handle);
				this.event_hub.unregisterTxEvent(transaction_id_string);
				// event_hub.disconnect();

				if (code !== 'VALID') {
					console.error('The transaction was invalid, code = ' + code);
				} else {
					console.log('The transaction has been committed on peer ' + this.event_hub._ep._endpoint.addr);
				}
			}, (err) => {
				reject(new Error('There was a problem with the eventhub ::' + err));
			});
		} else {
			console.error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
			throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
		}
	}
}

module.exports = ClauseHlfClient;