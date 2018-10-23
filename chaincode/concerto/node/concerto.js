/*
# Copyright Clause Inc. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

const shim = require('fabric-shim');
const ModelManager = require('composer-concerto').ModelManager;
const Serializer = require('composer-concerto').Serializer;
const Factory = require('composer-concerto').Factory;
const ModelUtil = require('composer-concerto').ModelUtil;
const ModelFile = require('composer-concerto').ModelFile;
const util = require('util');

// declare our system model
const systemModel = `namespace io.clause.system
abstract asset Asset {  }
abstract participant Participant {   }
abstract transaction Transaction identified by transactionId {
  o String transactionId
  o DateTime timestamp
}
abstract event Event identified by eventId {
  o String eventId
  o DateTime timestamp
}`;

/**
 * Instantiates a ModelManager with all the deployed model files
 * @param {*} stub the HLF stub
 */
async function getModelManager(stub) {
  const modelManager = new ModelManager();
  modelManager.addModelFile(systemModel, 'io.clause.system.cto', false, true);

  const modelsIterator = await stub.getStateByPartialCompositeKey('ModelManager', []);

  while(true) {
    let modelReponse = await modelsIterator.next();
    if (!modelReponse || !modelReponse.value || !modelReponse.value.key) {
      break;
    }

    let objectType;
    let attributes;
      ({
        objectType,
        attributes
      } = await stub.splitCompositeKey(modelReponse.value.key));

    let ns = attributes[0];
    console.log(`${objectType} namespace: ${ns}`);    
    const contents = modelReponse.value.value.toString('utf8')
    console.log(`contents: ${contents}`);
    modelManager.addModelFile(contents, false);
  }

  modelManager.validateModelFiles();
  return modelManager;
}

/**
 * Chaincode that performs model-based validation of puts and gets of JSON instances.
 * The data model is defined using Concerto.
 */
var Chaincode = class {

  // Initialize the chaincode
  async Init(stub) {
    console.info('=========== Instantiated concerto chaincode ===========');
    return shim.success();  
  }

  async Invoke(stub) {
    let ret = stub.getFunctionAndParameters();
    console.info(ret);
    let method = this[ret.fcn];
    if (!method) {
      console.log('no method of name:' + ret.fcn + ' found');
      return shim.success();
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
   * Adds a model file to the model manager
   * @param {*} stub the HLF stub
   * @param {Array} args function arguments
   * <ol>
   *   <li>contents (string), the contents of the modelfile
   * </ol>
   */
  async addModelFile(stub, args) {
    if (args.length != 1) {
      throw new Error('Incorrect number of arguments. Expecting 1 (contents)');
    }

    const contents = args[0];

    const modelManager = await getModelManager(stub);
    const modelFile = new ModelFile(modelManager, contents);

    // save the model file, using the namespace in the composite key
    const key = stub.createCompositeKey(`ModelManager`, [modelFile.getNamespace()]);
    await stub.putState(key, contents);

    // return a message
    return Buffer.from(`Successfully added model namespace ${modelFile.getNamespace()}`);
  }

  /**
   * Puts a new instance. The instance is validated using the model manager.
   * @param {*} stub the HLF stub
   * @param {Array} args function arguments
   * <ol>
   *   <li>contents (JSON string), the JSON contents of the instance
   * </ol>
   */
  async put(stub, args) {
    if (args.length != 1) {
      throw new Error('Incorrect number of arguments. Expecting 1 (JSON)');
    }

    const modelManager = await getModelManager(stub);
    const factory = new Factory(modelManager);
    const serializer = new Serializer(factory, modelManager);
    const instance = serializer.fromJSON(JSON.parse(args[0]));
    const key = stub.createCompositeKey(instance.getNamespace(), [instance.getType(), instance.getIdentifier()]);
    stub.putState(key, Buffer.from(JSON.stringify(serializer.toJSON(instance))));
    return Buffer.from(`Successfully put instance ${instance.getFullyQualifiedIdentifier()}`);
  }

   /**
   * Gets all the definitions for all the model files that have been added
   * @param {*} stub the HLF stub
   * @param {Array} args function arguments
   */
  async getModelFiles(stub, args) {
    if (args.length != 0) {
      throw new Error('Incorrect number of arguments. Expecting 0.');
    }

    const modelManager = await getModelManager(stub);
    const modelDefinitions = modelManager.getModelFiles()
      .filter((modelFile) => {
          return !modelFile.isSystemModelFile();
      }).map((modelFile) => {
        return modelFile.getDefinitions()
      });

    return Buffer.from(JSON.stringify(modelDefinitions));
  }

  /**
   * Get an instance
   * @param {*} stub the HLF stub
   * @param {Array} args function arguments
   * <ol>
   *   <li>fqn (string), the fully qualified type name of the instance
   *   <li>id (string), the identifier of the instance
   * </ol>
   */
  async get(stub, args) {
    if (args.length != 2) {
      throw new Error('Incorrect number of arguments. Expecting 2 (fqn, id)');
    }

    const fqn = args[0];
    const id = args[1];
    const ns = ModelUtil.getNamespace(fqn);
    const typeName = ModelUtil.getShortName(fqn);
    const key = stub.createCompositeKey(ns, [typeName, id]);
    const data = await stub.getState(key);
    return Buffer.from(data);
  }
};

shim.start(new Chaincode());