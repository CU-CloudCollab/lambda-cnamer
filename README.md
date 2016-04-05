# lambda-cnamer
Update R53 cname with EC2 public DNS when instance enters running state. Cname stored in DynamoDB.

## Requirements



### Role/policy setup


**Create the lambda-cnamer policy**

`aws iam create-policy --policy-name lambda-cnamer-policy --policy-document file://<LOCAL PATH>/lambda-cnamer-pol.json`


**Create the lambda-cnamer role with the appropriate trust policy**

`aws iam create-role --role-name lambda-cnamer-role --assume-role-policy-document file://<LOCAL PATH>/lambda-cnamer-trust.json`

**Attach the policy to the role**

`aws iam attach-role-policy --role-name lambda-cnamer-role --policy-arn <enter policy arn here>`

### 1. DynamoDB table creation

    aws dynamodb create-table --table-name lambda-cnamer --attribute-definitions AttributeName=instanceId,AttributeType=S --key-schema AttributeName=instanceId,KeyType=HASH --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5

### 2. Create Lambda Function 

AWS Console -> Lambda -> Create a lambda function

Select blueprint: **Skip**

Configure function:

   * Name: arbitrary
   
   * Description: arbitrary
   
   * Runtime: Node.js

   * Code entry type: Edit code inline (paste contents of lambda.js)


**NOTE:** Edit config parameters as needed (**region** and **dynamoTableName**)

   * Handler: index.handler

   * Role: use existing role (lambda-cnamer-role)

Click Next

Click "Create Function"


### 3. Create CloudWatch Event Rule


AWS Console -> CloudWatch -> Rules -> Create rule

Event selector -> Select Event Source -> EC2 instance state change notification

Specific state(s): Running

Targets -> Add Targets -> Lambda Function

Click "Configure details"

Assign a name and description, make sure State is "Enabled"

Click "Create Rule"


### 4. Create DynamoDB CNAME item

AWS Console -> DynamoDB -> Tables -> Select Table
Click the Items tab
Click "Create item"
Click the plus under instanceId
Click Append,String
Field: **cname**, String: [servername.fqdn]
Click Save


    

Test:

Create a new entry in DynamoDB mapping an existing instanceId to a CNAME in Dyna
