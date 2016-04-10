# lambda-cnamer
An AWS Lambda function to update a Route53 `CNAME` record with the public DNS of an EC2 instance when it enters a `RUNNING` state. The `CNAME` is stored in DynamoDB and the lambda function is executed by an AWS CloudWatch Rule.

## Installation

You must have `npm` installed to install the dependencies for lambda-cnamer. This is only required because as of 2016-04-10, Nodejs 4.3 AWS Lambda functions use `aws-sdk@2.2.48`. `aws-sdk@2.3` or greater is required for built-in promise support.

### 1. Setup IAM Role for lambda function

**Create the lambda-cnamer policy**

```
aws iam create-policy --policy-name lambda-cnamer-policy --policy-document file://<LOCAL PATH>/lambda-cnamer-pol.json
```

**Create the lambda-cnamer role with the appropriate trust policy**

```
aws iam create-role --role-name lambda-cnamer-role --assume-role-policy-document file://<LOCAL PATH>/lambda-cnamer-trust.json
```

**Attach the policy to the role**

```
aws iam attach-role-policy --role-name lambda-cnamer-role --policy-arn <enter policy arn here>
```

### 2. Create DynamoDB table

```
aws dynamodb create-table --table-name lambda-cnamer --attribute-definitions AttributeName=instanceId,AttributeType=S --key-schema AttributeName=instanceId,KeyType=HASH --provisioned-throughput ReadCapacityUnits=1,WriteCapacityUnits=1
```

### 3. Build your lambda-cnamer zip

If you deploy in a region other than `us-east-1` or create a DynamoDB table named other than `lambda-cnamer` be sure to update the `index.js` before building your zip.

**NOTE** npm install is only required because as of 2016-04-10, Nodejs 4.3 AWS Lambda functions use `aws-sdk@2.2.48`. `aws-sdk@2.3` or greater is required for built-in promise support.

```
# clone the repository
git clone https://github.com/CU-CloudCollab/lambda-cnamer.git
cd lambda-cnamer

# install dependencies based on npm-shrinkwrap.json
npm install

# OPTIONAL: Edit index.js with your deployed region & dynamoTableName in CONFIG

# build your zip with only the min required files
zip -r ../lambda-cnamer.zip index.js node_modules
```

### 4. Create Lambda Function

Using the AWS Console:

0. Select Lambda -> Create a lambda function
0. Select blueprint: **Skip** (bottom of page)
0. Configure function:
   * Name: lambda-cnamer
   * Description: (whatever you want)
   * Runtime: Node.js 4.3
   * Code entry type: Upload a ZIP. Specify your lambda-cnamer.zip
   * Handler: index.handler
   * Role: use existing role (lambda-cnamer-role)
0. Click Next
0. Click "Create Function"


### 5. Create CloudWatch Event Rule

Using the AWS Console:

0. Select CloudWatch -> Rules -> Create rule
0. Event selector -> Select Event Source -> `EC2 instance state change notification`
0. Specific state(s): `Running`
0. Targets -> Add Targets -> Lambda Function
0. Function: `lambda-cnamer`
0. Click "Configure details"
0. Assign a name and description, make sure State is "Enabled"
0. Click "Create Rule"

### 6. Create DynamoDB CNAME item

Using the AWS Console:

0. Select DynamoDB -> Tables -> Select Table
0. Click the Items tab
0. Click "Create item"
0. Click the plus under instanceId
0. Click Append,String
    * Field: **cname**, String: [servername.fqdn]
0. Click Save

#### Testing

Be sure to use an instance that has receives a *public* IP when it enters `RUNNING` state.

## Customizing lambda-cnamer

If you have different needs, fork the repository. Consider using [lambda-local](https://www.npmjs.com/package/lambda-local) during your tests. *NOTE: lambda-local does not yet support callback emulation*

```
# the event-samples/ directory may be helpful to you
lambda-local -l index.js -h handler -e event-samples/ec2-running.js
```
