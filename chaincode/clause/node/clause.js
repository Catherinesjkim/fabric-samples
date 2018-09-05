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
const shim = require('fabric-shim');
const util = require('util');

/**
 * Hyperledger Fabric chaincode to deploy and execute an Accord Project
 * Cicero Smart Legal Contract on-chain.
 */
class Chaincode {

  /**
   * Called by the stub to initialize the chaincode.
   * @param {*} stub the HLF stub
   */
  async Init(stub) {
    console.info('=========== Instantiated Clause chaincode ===========');
    return shim.success();
  }

  /**
   * Called by the stub when a transaction is submitted.
   * @param {*} stub the HLF stub
   */
  async Invoke(stub) {
    let ret = stub.getFunctionAndParameters();
    console.info(ret);

    let method = this[ret.fcn];
    if (!method) {
      console.error('no function of name:' + ret.fcn + ' found');
      throw new Error('Received unknown function ' + ret.fcn + ' invocation');
    }
    try {
      let payload = await method(stub, ret.params);
      return shim.success(payload);
    } catch (err) {
      console.log(err);
      return shim.error(err);
    }
  }

  /**
   * Initializes the ledger.
   * @param {*} stub the HLF stub
   * @param {Array} args function arguments
   */
  async initLedger(stub, args) {
    console.info('============= START : Initialize Ledger ===========');
    console.info('============= END : Initialize Ledger ===========');
  }

  /**
   * Executes a previously deployed Smart Legal Contract, returning results and emitting events.
   * @param {*} stub the HLF stub
   * @param {Array} args function arguments
   * <ol>
   *   <li>contractId (string), the identifier of the contract. 
   *   <li>event (JSON string), the JSON object (as a string) for the audit event for the contract.
   * </ol>
   */
  async storeAuditEvent(stub, args) {
    console.info('============= START : Execute storeAuditEvent ===========');
    if (args.length != 2) {
      throw new Error('Incorrect number of arguments. Expecting 2 (Contract ID, Event)');
    }

    const contractId = args[0];
    const eventText = args[1];

    // save the event
    await stub.putState(`${contractId}-AuditEvent`, Buffer.from(eventText));
    
    // return the response
    console.info('============= END : Execute storeAuditEvent ===========');
    return Buffer.from(`Saved audit event for ${contractId}`);
  }
}

shim.start(new Chaincode());
