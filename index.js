'use strict';

const CONFIG = {
    region: 'us-east-1',
    dynamoTableName: 'lambda-cnamer'
};

const AWS = require('aws-sdk');

AWS.config.region = CONFIG.region;
AWS.config.apiVersions = {
    ec2: '2015-10-01',
    dynamodb: '2012-08-10',
    route53: '2013-04-01',
};

var ec2 = new AWS.EC2();
var dynamodb = new AWS.DynamoDB();
var route53 = new AWS.Route53();

exports.handler = (event, context, callback) => {

    // Step 1 - get information about the running instance
    var params = {
        DryRun: false,
        InstanceIds: [event.detail['instance-id']],
    };
    var requestEc2 = ec2.describeInstances(params);
    var promiseEc2 = requestEc2.promise();

    var instanceId;
    var cname = '';
    var pubDnsName = '';
    var zoneId = '';

    promiseEc2.then(data => {
            var instanceDetail = data.Reservations[0].Instances[0];

            // sanity check if more than 1 instance
            if (data.Reservations[0].Instances.length > 1) {
                console.log('lambda-cnamer does not handle more than 1 instance at a time');
                console.log(data.Reservations[0].Instances);
                context.fail(event);
            }

            // do we have a public dns name on this instance?
            pubDnsName = instanceDetail.PublicDnsName;
            instanceId = instanceDetail.InstanceId;

            // handle if the instance does not have a public IP
            if (pubDnsName === '') {
                console.log('InstanceId "' + instanceId + '" does not have public ip.');
                context.fail(event);
            }

            // Step 2: look for cname in DynamoDB
            var params = {
                Key: {
                    'instanceId': {'S': instanceId},
                },
                TableName: CONFIG.dynamoTableName,
                AttributesToGet: [
                    'cname'
                ],
            };

            var requestDynamo = dynamodb.getItem(params);
            var promiseDynamodb = requestDynamo.promise();

            return promiseDynamodb;

        }, err => {
            console.log('EC2 error "' + err.message + '"');
            console.log(err);
            context.fail(event);
        }
    ).then(data => {

            // if record not found, exit quietly
            if (!Object.keys(data).length) {
                console.log('InstanceId "' + instanceId + '" not present in ' + CONFIG.dynamoTableName);
                context.succeed({});
            }

            cname = data.Item.cname.S;

            // Step 3: get list of all hosted zones to determine what is correct
            // zoneId for given cname
            var r53ZoneRequest = route53.listHostedZones();
            var r53ZonePromise = r53ZoneRequest.promise();

            return r53ZonePromise;

        }, err => {
            console.log('DynamoDB error "' + err.message + '"');
            console.log(err);
            context.fail(event);
        }
    ).then(data => {
            for (var i = 0; i < data.HostedZones.length; i++) {
                var hostedZone = data.HostedZones[i];
                if (cname.endsWith(hostedZone.Name)) {
                    zoneId = hostedZone.Id;
                }
            }
            if (zoneId === '') {
                console.log('R53 zone not found for: ' + cname);
                context.fail(event);
            }

            // Step 4: update r53
            var params53 = {
                ChangeBatch: {
                Changes: [
                  {
                    Action: 'UPSERT',
                    ResourceRecordSet: {
                      Name: cname,
                      Type: 'CNAME',
                      ResourceRecords: [
                        {
                          Value: pubDnsName,
                        },
                      ],
                      TTL: 60,
                    }
                  }
                ]
              },
              HostedZoneId: zoneId
            };

            var r53RecordRequest = route53.changeResourceRecordSets(params53);
            var r53RecordPromise = r53RecordRequest.promise();

            return r53RecordPromise;

        }, err => {
            console.log('R53 zone error "' + err.message + '"');
            console.log(err);
            context.fail(event);
        }
    ).then( data => {
            console.log('R53 record updated');
            context.succeed({instanceId: instanceId, cname: cname, target: pubDnsName, zoneId: zoneId});
        }, err => {
            console.log('R53 zone error "' + err.message + '"');
            console.log(err);
            context.fail(event);
        }
    );

    // callback(error, data);
}
