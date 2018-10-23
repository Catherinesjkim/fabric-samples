# Hyperledger Fabric Client for Concerto Chaincode

This sample shows how you can use [Concerto](https://github.com/hyperledger/composer-concerto) from within Hyperledger Fabric v1.3 Node.js chaincode.

The chaincode itself is under the `chaincode` directory of this repository.

## Install

To get started you need to `git clone` or download this fork of the official Hyperledger Fabric samples repository. A Concerto client and chaincode sample have been added.

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

### Deploy Models

Next we deploy the Concerto model in `models/domain.cto` to Fabric:

```
node deploy.js
```

You should see output similar to this:

```
$ node deploy.js 
Store path:/Users/dselman/dev/fabric-samples-clause/concerto/hfc-key-store
(node:37361) DeprecationWarning: grpc.load: Use the @grpc/proto-loader module with grpc.loadPackageDefinition instead
Successfully loaded user1 from persistence
Assigning transaction_id:  2a9ead4c1dad08b3990050bd48ee96ddb05faadda01e6e83eda22eafe8b25519
Transaction proposal was good
Response payload: Successfully added model namespace io.clause
Successfully sent Proposal and received ProposalResponse: Status - 200, message - ""
The transaction has been committed on peer localhost:7051
Send transaction promise and event listener promise have completed
Successfully sent transaction to the orderer.
Successfully committed the change to the ledger by the peer
```

The interesting part is: `Response payload: Successfully added model namespace io.clause`. This shows that the domain model was validated by the chaincode and stored.

### Creating an Instance

We submit a transaction to store an instance of the domain model in Fabric:

```
node invoke.js
```

You should see output similar to this:

```
$ node invoke.js 
Store path:/Users/dselman/dev/fabric-samples-clause/concerto/hfc-key-store
(node:37366) DeprecationWarning: grpc.load: Use the @grpc/proto-loader module with grpc.loadPackageDefinition instead
Successfully loaded user1 from persistence
Assigning transaction_id:  aabfaf0f7274a5a7826eaacc15941056d7ce17864392418d68755b0df72fc052
Transaction proposal was good
Successfully sent Proposal and received ProposalResponse: Status - 200, message - ""
Response payload: Successfully put instance io.clause.Employee#bob@clause.io
The transaction has been committed on peer localhost:7051
Send transaction promise and event listener promise have completed
Successfully sent transaction to the orderer.
Successfully committed the change to the ledger by the peer
```

The reponse payload shows that the instances was stored.

### Trying to Create an Invalid Instance

Open up invoke.js and remove the `firstName` attribute so it looks like this:

```
	const json = {
		$class : 'io.clause.Employee',
		email : 'bob@clause.io',
		lastName: 'Concerto',
		gender: 'MALE',
		startDate : Date.now()
	}
```

Rerun `node invoke.js`. It should now fail with the following message:

```
$ node invoke.js 
Store path:/Users/dselman/dev/fabric-samples-clause/concerto/hfc-key-store
(node:37374) DeprecationWarning: grpc.load: Use the @grpc/proto-loader module with grpc.loadPackageDefinition instead
Successfully loaded user1 from persistence
Assigning transaction_id:  8708213796b62e0fcfb035510e7fb4aec677a1e7c0e1f16479b41997bc179bb1
Transaction proposal was bad
Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...
Failed to invoke successfully :: Error: Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...
```

If you look at the logs for the chaincode container (using `docker logs`) you see that the instance without the `firstName` property fails model validation:

```
{ fcn: 'put',
  params: 
   [ '{"$class":"io.clause.Employee","email":"bob@clause.io","firstName":"Bob","lastName":"Concerto","gender":"MALE","startDate":1540231711553}' ] }
ModelManager namespace: io.clause
contents: namespace io.clause

enum Gender {
  o MALE
  o FEMALE
  o OTHER
}

asset Employee identified by email {
  o String email
  o String firstName
  o String lastName
  o String middleName optional
  o Gender gender
  o DateTime startDate
  o DateTime terminationDate optional
}
{ fcn: 'put',
  params: 
   [ '{"$class":"io.clause.Employee","email":"bob@clause.io","lastName":"Concerto","gender":"MALE","startDate":1540231844509}' ] }
ModelManager namespace: io.clause
contents: namespace io.clause

enum Gender {
  o MALE
  o FEMALE
  o OTHER
}

asset Employee identified by email {
  o String email
  o String firstName
  o String lastName
  o String middleName optional
  o Gender gender
  o DateTime startDate
  o DateTime terminationDate optional
}
{ ValidationException: Instance io.clause.Employee#bob@clause.io missing required field firstName
    at Function.reportMissingRequiredProperty (/usr/local/src/node_modules/composer-concerto/lib/serializer/resourcevalidator.js:481:15)
    at ResourceValidator.visitClassDeclaration (/usr/local/src/node_modules/composer-concerto/lib/serializer/resourcevalidator.js:179:39)
    at ResourceValidator.visit (/usr/local/src/node_modules/composer-concerto/lib/serializer/resourcevalidator.js:74:25)
    at AssetDeclaration.accept (/usr/local/src/node_modules/composer-concerto/lib/introspect/decorated.js:65:24)
    at ValidatedResource.validate (/usr/local/src/node_modules/composer-concerto/lib/model/validatedresource.js:124:26)
    at Serializer.fromJSON (/usr/local/src/node_modules/composer-concerto/lib/serializer.js:181:22)
    at put (/usr/local/src/concerto.js:143:33)
    at <anonymous>
    at process._tickCallback (internal/process/next_tick.js:188:7) name: 'ValidationException' }
2018-10-22T18:10:44.570Z ERROR [lib/handler.js] [mychannel-87082137]Calling chaincode Invoke() returned error response [ValidationException: Instance io.clause.Employee#bob@clause.io missing required field firstName]. Sending ERROR message back to peer 
```

### Retrieving an Instance

If you modify `invoke.js` to use the `getRequest` instead of `putRequest` you can retrieve the previously stored (valid) instance by running `node invoke.js`:

```
$ node invoke.js 
Store path:/Users/dselman/dev/fabric-samples-clause/concerto/hfc-key-store
(node:37381) DeprecationWarning: grpc.load: Use the @grpc/proto-loader module with grpc.loadPackageDefinition instead
Successfully loaded user1 from persistence
Assigning transaction_id:  428e5a588e312569a8e1f422b48bedc54f64f7f6bead70269191454d9d970453
Transaction proposal was good
Successfully sent Proposal and received ProposalResponse: Status - 200, message - ""
Response payload: {"$class":"io.clause.Employee","email":"bob@clause.io","firstName":"Bob","gender":"MALE","lastName":"Concerto","startDate":"2018-10-22T18:00:52.833Z"}
The transaction has been committed on peer localhost:7051
Send transaction promise and event listener promise have completed
Successfully sent transaction to the orderer.
Successfully committed the change to the ledger by the peer
```

### Retrieving Models

You can run `query.js` to retrieve all the deployed models from the blockchain.

```
$ node query.js 
Store path:/Users/dselman/dev/fabric-samples-clause/concerto/hfc-key-store
(node:38206) DeprecationWarning: grpc.load: Use the @grpc/proto-loader module with grpc.loadPackageDefinition instead
Successfully loaded user1 from persistence
Query has completed, checking results
Response is  ["namespace io.clause\n\nenum Gender {\n  o MALE\n  o FEMALE\n  o OTHER\n}\n\nasset Employee identified by email {\n  o String email\n  o String firstName\n  o String lastName\n  o String middleName optional\n  o Gender gender\n  o DateTime startDate\n  o DateTime terminationDate optional\n}"]
```


## Editing Chaincode

If you would like to make changes to the cicero chaincode be aware that Docker caches the docker image for the chaincode. If you edit the source and run `./startFabric` you will *not* see your changes.

For your code changes to take effect you need to `docker stop` the peer (use `docker ps` to get the container id) and then `docker rmi -f` your docker chaincode image. The image name should look something like `dev-peer0.org1.example.com-concerto-1.0-598263b3afa0267a29243ec2ab8d19b7d2016ac628f13641ed1822c4241c5734`.
