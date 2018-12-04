# Hyperledger Fabric Client for Cicero Chaincode

This sample shows how you can deploy and execute Smart Legal Contracts on-chain using Hyperledger Fabric v1.3.

Using this client you can deploy a [Smart Legal Contract Templates](https://templates.accordproject.org) from the Open Source [Accord Project](https://accordproject.org) to your HLF v1.3 blockchain. You can then submit transactions to the Smart Legal Contract, with the contract state persisted to the blockchain, and return values and emitted events propagated back to the client.

The chaincode itself is under the `chaincode` directory of this repository, here: https://github.com/accordproject/fabric-samples/blob/release-1.1/chaincode/cicero/node/cicero.js

## Install

To get started you need to `git clone` or download this fork of the official Hyperledger Fabric samples repository. A Cicero client and chaincode sample have been added.

You will need up to date versions of `git` and `node` for this sample to work. The sample has only been tested on Mac OS X. Pull requests welcome for other platforms.

## Running

```
./startFabric node
```

Wait for 2-3 minutes while HLF starts. Next install the npm dependencies for the client code:

```
npm install
```

You can then enroll the administrator into the network:

```
node enrollAdmin.js
```

And then register a user:

```
node registerUser.js
```

Next we deploy a Cicero Smart Legal Contract by invoking the `deploySmartLegalContract` chaincode function. 
The HelloWorld template is downloaded from https://templates.accordproject.org and then stored in the blockchain along 
with the contract text and the initial state of the contract.

```
node deploy.js helloworld.cta sample.txt
```

Where `sample.txt` is a file containing contract text that conforms to the template's grammar. See the template source for an example.

You should see output similar to this:

```
$ node deploy.js helloworld.cta sample.txt
Store path:/Users/matt/dev/clauseHQ/fabric-samples/cicero/hfc-key-store
(node:22481) DeprecationWarning: grpc.load: Use the @grpc/proto-loader module with grpc.loadPackageDefinition instead
Successfully loaded user1 from persistence
Assigning transaction_id:  ea4fe684dc6573f1eeb9ed1996c652d98a46870a511213fa9f112dd3eecc76bf
Transaction proposal was good
Response payload: {"$class":"org.accordproject.cicero.runtime.Response","transactionId":"761df52f-2a0e-47f4-ad21-9be15bf82016","timestamp":"2018-12-03T16:38:40.115Z"}
Successfully sent Proposal and received ProposalResponse: Status - 200, message - ""
The transaction has been committed on peer localhost:7051
Send transaction promise and event listener promise have completed
Successfully sent transaction to the orderer.
Successfully committed the change to the ledger by the peer
```

Finally we submit a transaction to HLF, the chaincode loads the template from the blockchain (including its logic), validates the incoming transaction against the data model (schema) and then executes the contract. The return value from the contract is returned to the client and any events emitted by the contract are pushed onto the HLF event bus for asynchronous delivery to connected clients. Finally the potentially updated state of the contract is persisted back to the ledger.

```
node submitRequest.js request.json
```

Where `request.json` is an JSON instance of a request transaction, see the template source for an example.

You should see output similar to this:

```
$ node submitRequest.js request.json
Store path:/Users/matt/dev/clauseHQ/fabric-samples/cicero/hfc-key-store
(node:22482) DeprecationWarning: grpc.load: Use the @grpc/proto-loader module with grpc.loadPackageDefinition instead
Successfully loaded user1 from persistence
Assigning transaction_id:  ecf5375e76c85224ae5ad27de04b2526e1b0699a3e72b8d22fc6101a8db02353
Transaction proposal was good
Response payload: {"$class":"org.accordproject.helloworld.MyResponse","output":"Hello Fred Blogs World","transactionId":"982b51f4-b945-4a71-be04-3e601a2d90a1","timestamp":"2018-12-03T16:38:53.104Z"}
Successfully sent Proposal and received ProposalResponse: Status - 200, message - ""
The transaction has been committed on peer localhost:7051
Send transaction promise and event listener promise have completed
Successfully sent transaction to the orderer.
Successfully committed the change to the ledger by the peer
```

The reponse payload shows that the logic of the template has run, combining data from the request with data from the template parameters.

## Editing Chaincode

If you would like to make changes to the cicero chaincode be aware that Docker caches the docker image for the chaincode. If you edit the source and run `./startFabric` you will *not* see your changes.

For your code changes to take effect you need to `docker stop` the peer (use `docker ps` to get the container id) and then `docker rmi -f` your docker chaincode image. The image name should look something like `dev-peer0.org1.example.com-cicero-1.0-598263b3afa0267a29243ec2ab8d19b7d2016ac628f13641ed1822c4241c5734`.
